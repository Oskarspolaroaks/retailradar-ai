import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { category, period_days = 90 } = await req.json();

    // Get tenant_id
    const { data: tenantData } = await supabase
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!tenantData) {
      return new Response(JSON.stringify({ error: 'No tenant found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenant_id = tenantData.tenant_id;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period_days);

    // Get categories to process
    const categoriesToProcess = category 
      ? [category]
      : await supabase
          .from('products')
          .select('category')
          .eq('tenant_id', tenant_id)
          .eq('status', 'active')
          .then(({ data }) => [...new Set(data?.map(p => p.category).filter(Boolean))]);

    const metricsResults = [];

    for (const cat of categoriesToProcess) {
      const metrics = await calculateCategoryMetrics(
        supabase,
        tenant_id,
        cat as string,
        startDate,
        endDate
      );

      if (metrics) {
        // Upsert category metrics
        await supabase
          .from('category_metrics')
          .upsert({
            tenant_id: tenant_id,
            category: cat,
            period_start: startDate.toISOString().split('T')[0],
            period_end: endDate.toISOString().split('T')[0],
            ...metrics,
          }, {
            onConflict: 'tenant_id,category,period_start'
          });

        metricsResults.push({ category: cat, ...metrics });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Calculated metrics for ${metricsResults.length} categories`,
        metrics: metricsResults
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error calculating category metrics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function calculateCategoryMetrics(
  supabase: any,
  tenant_id: string,
  category: string,
  startDate: Date,
  endDate: Date
) {
  // Get products in category
  const { data: products } = await supabase
    .from('products')
    .select('id, cost_price, current_price')
    .eq('tenant_id', tenant_id)
    .eq('category', category)
    .eq('status', 'active');

  if (!products || products.length === 0) {
    return null;
  }

  const productIds = products.map((p: any) => p.id);

  // Get sales data
  const { data: sales } = await supabase
    .from('sales_daily')
    .select('*')
    .in('product_id', productIds)
    .eq('tenant_id', tenant_id)
    .gte('reg_date', startDate.toISOString().split('T')[0])
    .lte('reg_date', endDate.toISOString().split('T')[0]);

  // Calculate revenue as (selling_price - purchase_price) * units_sold
  const totalRevenue = sales?.reduce((sum: number, s: any) => {
    const revenue = ((Number(s.selling_price) || 0) - (Number(s.purchase_price) || 0)) * (Number(s.units_sold) || 0);
    return sum + revenue;
  }, 0) || 0;
  const totalUnits = sales?.reduce((sum: number, s: any) => sum + Number(s.units_sold), 0) || 0;

  // Total margin is the same as revenue in this model (selling_price - purchase_price)
  const totalMarginValue = totalRevenue;

  // Calculate promo revenue share
  const promoRevenue = sales?.filter((s: any) => s.promo_flag).reduce((sum: number, s: any) => {
    const revenue = ((Number(s.selling_price) || 0) - (Number(s.purchase_price) || 0)) * (Number(s.units_sold) || 0);
    return sum + revenue;
  }, 0) || 0;
  const promoRevenueShare = totalRevenue > 0 ? (promoRevenue / totalRevenue) * 100 : 0;

  // Identify slow movers (products with very low sales)
  const productSales = new Map<string, number>();
  for (const sale of sales || []) {
    productSales.set(
      sale.product_id,
      (productSales.get(sale.product_id) || 0) + Number(sale.units_sold)
    );
  }

  const avgUnitsPerProduct = totalUnits / products.length;
  const slowMovers = Array.from(productSales.entries())
    .filter(([_, units]) => units < avgUnitsPerProduct * 0.2) // Less than 20% of average
    .length;

  // Calculate average rotation (simplified: days between sales)
  const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const avgRotationDays = totalUnits > 0 ? totalDays / totalUnits * products.length : null;

  return {
    total_revenue: Number(totalRevenue.toFixed(2)),
    total_margin: Number(totalMarginValue.toFixed(2)),
    total_units: Number(totalUnits.toFixed(0)),
    sku_count: products.length,
    slow_movers_count: slowMovers,
    promo_revenue_share: Number(promoRevenueShare.toFixed(2)),
    avg_rotation_days: avgRotationDays ? Number(avgRotationDays.toFixed(1)) : null,
  };
}