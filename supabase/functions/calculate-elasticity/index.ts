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

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { product_id, period_days = 90 } = await req.json();

    // Get tenant_id for the user
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

    // Calculate elasticity for one product or all products
    const productsToProcess = product_id 
      ? [product_id]
      : await supabase
          .from('products')
          .select('id')
          .eq('tenant_id', tenant_id)
          .then(({ data }) => data?.map(p => p.id) || []);

    let calculatedCount = 0;

    for (const pid of productsToProcess) {
      // Get historical price and sales data
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period_days);

      const { data: salesHistory } = await supabase
        .from('sales_daily')
        .select('reg_date, units_sold, selling_price, purchase_price, product_id')
        .eq('product_id', pid)
        .eq('tenant_id', tenant_id)
        .gte('reg_date', startDate.toISOString().split('T')[0])
        .order('reg_date', { ascending: true });

      if (!salesHistory || salesHistory.length < 10) {
        console.log(`Skipping product ${pid}: insufficient data points`);
        continue;
      }

      // Get price history
      const { data: priceHistory } = await supabase
        .from('price_history')
        .select('valid_from, regular_price')
        .eq('product_id', pid)
        .eq('tenant_id', tenant_id)
        .gte('valid_from', startDate.toISOString().split('T')[0])
        .order('valid_from', { ascending: true });

      // Calculate elasticity using simple regression
      const elasticity = calculateElasticity(salesHistory, priceHistory || []);

      if (elasticity) {
        // Upsert elasticity record
        await supabase
          .from('product_price_elasticity')
          .upsert({
            product_id: pid,
            tenant_id: tenant_id,
            elasticity_coefficient: elasticity.coefficient,
            confidence: elasticity.confidence,
            sensitivity_label: elasticity.label,
            data_points: salesHistory.length,
            calculated_at: new Date().toISOString(),
          }, {
            onConflict: 'product_id'
          });

        calculatedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Calculated elasticity for ${calculatedCount} products`,
        products_processed: calculatedCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error calculating elasticity:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function calculateElasticity(salesHistory: any[], priceHistory: any[]) {
  if (salesHistory.length < 10 || priceHistory.length < 2) {
    return null;
  }

  // Match sales with prices
  const dataPoints: Array<{ price: number; quantity: number }> = [];
  
  for (const sale of salesHistory) {
    const saleDate = new Date(sale.date);
    const price = priceHistory.find(ph => 
      new Date(ph.valid_from) <= saleDate
    )?.regular_price;

    if (price && price > 0 && sale.units_sold > 0) {
      dataPoints.push({
        price: Number(price),
        quantity: Number(sale.units_sold)
      });
    }
  }

  if (dataPoints.length < 5) {
    return null;
  }

  // Calculate percentage changes
  const changes: Array<{ priceChange: number; quantityChange: number }> = [];
  
  for (let i = 1; i < dataPoints.length; i++) {
    const prevPrice = dataPoints[i - 1].price;
    const currPrice = dataPoints[i].price;
    const prevQty = dataPoints[i - 1].quantity;
    const currQty = dataPoints[i].quantity;

    if (prevPrice !== currPrice && prevQty > 0 && currQty > 0) {
      const priceChange = (currPrice - prevPrice) / prevPrice;
      const quantityChange = (currQty - prevQty) / prevQty;
      
      if (Math.abs(priceChange) > 0.01) { // Only meaningful price changes
        changes.push({ priceChange, quantityChange });
      }
    }
  }

  if (changes.length < 3) {
    return null;
  }

  // Calculate average elasticity
  let sumElasticity = 0;
  let validChanges = 0;

  for (const change of changes) {
    const elasticity = change.quantityChange / change.priceChange;
    if (isFinite(elasticity) && !isNaN(elasticity)) {
      sumElasticity += elasticity;
      validChanges++;
    }
  }

  if (validChanges === 0) {
    return null;
  }

  const avgElasticity = sumElasticity / validChanges;
  const confidence = Math.min(validChanges / 10, 1); // More data points = higher confidence

  // Classify sensitivity
  let label: 'inelastic' | 'normal' | 'highly_elastic';
  if (avgElasticity > -0.8) {
    label = 'inelastic';
  } else if (avgElasticity > -1.5) {
    label = 'normal';
  } else {
    label = 'highly_elastic';
  }

  return {
    coefficient: Number(avgElasticity.toFixed(4)),
    confidence: Number(confidence.toFixed(2)),
    label
  };
}