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

    console.log('Generating pricing recommendations...');

    // Get all active products with their pricing data
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, sku, name, category, cost_price, current_price, currency, abc_category, is_private_label, tenant_id')
      .eq('status', 'active');

    if (productsError) throw productsError;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ error: 'No products found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${products.length} products...`);

    // Get competitor pricing data
    const { data: competitorPrices } = await supabase
      .from('competitor_price_history')
      .select(`
        id,
        price,
        date,
        competitor_product_id,
        competitor_products!inner(our_product_id)
      `)
      .order('date', { ascending: false });

    // Build competitor price map (product_id -> avg price)
    const competitorPriceMap = new Map<string, { min: number; avg: number; max: number; count: number }>();
    
    if (competitorPrices) {
      const pricesByProduct = new Map<string, number[]>();
      
      competitorPrices.forEach((cp: any) => {
        const productId = cp.competitor_products?.our_product_id;
        if (productId) {
          if (!pricesByProduct.has(productId)) {
            pricesByProduct.set(productId, []);
          }
          pricesByProduct.get(productId)!.push(Number(cp.price));
        }
      });

      pricesByProduct.forEach((prices, productId) => {
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        competitorPriceMap.set(productId, { min, avg, max, count: prices.length });
      });
    }

    // Get sales data for the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateStr = ninetyDaysAgo.toISOString().split('T')[0];

    const { data: salesData } = await supabase
      .from('sales_daily')
      .select('product_id, units_sold, revenue, date')
      .gte('date', dateStr);

    // Build sales map
    const salesMap = new Map<string, { units: number; revenue: number; trend: string }>();
    
    if (salesData) {
      salesData.forEach((sale: any) => {
        const existing = salesMap.get(sale.product_id) || { units: 0, revenue: 0, trend: 'stable' };
        existing.units += Number(sale.units_sold);
        existing.revenue += Number(sale.revenue);
        salesMap.set(sale.product_id, existing);
      });
    }

    // Generate recommendations
    const recommendations = [];
    const targetMargin = 25; // Default target margin %

    for (const product of products) {
      const costPrice = Number(product.cost_price);
      const currentPrice = Number(product.current_price);
      const currentMargin = ((currentPrice - costPrice) / currentPrice) * 100;
      
      const competitorData = competitorPriceMap.get(product.id);
      const salesInfo = salesMap.get(product.id);
      
      let recommendedPrice = currentPrice;
      let action = 'keep_price';
      let reasoning = '';

      // Pricing Engine Logic
      if (product.abc_category === 'A') {
        // Class A products: High revenue contributors
        if (competitorData && competitorData.avg >= currentPrice * 1.05 && salesInfo && salesInfo.units > 10) {
          // We're significantly cheaper than competitors and have good sales
          recommendedPrice = Math.min(currentPrice * 1.05, competitorData.avg * 0.98);
          action = 'increase_price';
          reasoning = `Class A product with strong sales (${salesInfo.units} units). Competitors average €${competitorData.avg.toFixed(2)}, you can increase price while staying competitive.`;
        } else if (currentMargin < targetMargin && (!competitorData || currentPrice <= competitorData.avg)) {
          // Low margin, room to increase
          recommendedPrice = costPrice / (1 - targetMargin / 100);
          action = 'increase_price';
          reasoning = `Current margin ${currentMargin.toFixed(1)}% is below target ${targetMargin}%. Increase to improve profitability.`;
        }
      } else if (product.abc_category === 'C') {
        // Class C products: Low revenue contributors
        if (competitorData && currentPrice >= competitorData.avg * 1.03 && salesInfo && salesInfo.units < 5) {
          // We're more expensive than average and have poor sales
          recommendedPrice = competitorData.avg * 0.95;
          action = 'decrease_price';
          reasoning = `Class C product with weak sales (${salesInfo?.units || 0} units). You're €${(currentPrice - competitorData.avg).toFixed(2)} above competitor average. Lower price to stimulate demand.`;
        }
      } else if (product.abc_category === 'B') {
        // Class B products: Medium performers
        if (currentMargin < targetMargin - 5) {
          recommendedPrice = costPrice / (1 - targetMargin / 100);
          action = 'increase_price';
          reasoning = `Margin ${currentMargin.toFixed(1)}% is significantly below target. Increase to ${targetMargin}%.`;
        } else if (competitorData && currentPrice > competitorData.max && salesInfo && salesInfo.units < 10) {
          recommendedPrice = competitorData.avg;
          action = 'decrease_price';
          reasoning = `You're more expensive than all competitors. Reduce to average market price to improve sales.`;
        }
      }

      // Private label products can have higher margins
      if (product.is_private_label && currentMargin < 35 && action === 'keep_price') {
        recommendedPrice = costPrice / (1 - 0.35);
        action = 'increase_price';
        reasoning = 'Private label product can sustain higher margins (35%+) without direct competitor comparison.';
      }

      // Only create recommendation if action is not keep_price or if there's a significant change
      if (action !== 'keep_price' || Math.abs(recommendedPrice - currentPrice) > 0.01) {
        const changePercent = ((recommendedPrice - currentPrice) / currentPrice) * 100;
        const newMargin = ((recommendedPrice - costPrice) / recommendedPrice) * 100;

        if (action === 'keep_price' && Math.abs(changePercent) < 1) {
          continue; // Skip if change is less than 1%
        }

        recommendations.push({
          product_id: product.id,
          tenant_id: product.tenant_id,
          current_price: currentPrice,
          current_cost_price: costPrice,
          competitor_avg_price: competitorData?.avg || null,
          recommended_price: recommendedPrice,
          recommended_change_percent: changePercent,
          reasoning: reasoning || `Current pricing is optimal at €${currentPrice.toFixed(2)} with ${currentMargin.toFixed(1)}% margin.`,
          abc_class: product.abc_category,
          status: 'new',
        });
      }
    }

    console.log(`Generated ${recommendations.length} recommendations`);

    // Clear old recommendations and insert new ones
    const { error: deleteError } = await supabase
      .from('pricing_recommendations')
      .delete()
      .eq('status', 'new');

    if (deleteError) console.error('Error deleting old recommendations:', deleteError);

    if (recommendations.length > 0) {
      // Insert in batches of 100
      for (let i = 0; i < recommendations.length; i += 100) {
        const batch = recommendations.slice(i, i + 100);
        const { error: insertError } = await supabase
          .from('pricing_recommendations')
          .insert(batch);
        
        if (insertError) {
          console.error('Error inserting recommendations:', insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: recommendations.length,
        message: `Generated ${recommendations.length} pricing recommendations`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
