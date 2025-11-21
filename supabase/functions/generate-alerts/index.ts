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

    console.log('Generating alerts...');

    const alerts = [];
    const targetMargin = 25; // Default target

    // Get products
    const { data: products } = await supabase
      .from('products')
      .select('id, sku, name, cost_price, current_price, abc_category')
      .eq('status', 'active');

    if (!products) {
      throw new Error('No products found');
    }

    // Check for low margin alerts
    for (const product of products) {
      const margin = ((Number(product.current_price) - Number(product.cost_price)) / Number(product.current_price)) * 100;
      
      if (margin < targetMargin - 10) {
        alerts.push({
          type: 'low_margin',
          title: `Low Margin Alert: ${product.name}`,
          description: `Product ${product.sku} has only ${margin.toFixed(1)}% margin, well below the ${targetMargin}% target.`,
          severity: 'warning',
          product_id: product.id,
        });
      }
    }

    // Check for competitor price drops (last 7 days vs previous 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: recentPrices } = await supabase
      .from('competitor_price_history')
      .select(`
        price,
        date,
        competitor_product_id,
        competitor_products!inner(our_product_id, competitor_name, competitors!inner(name))
      `)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0]);

    const { data: previousPrices } = await supabase
      .from('competitor_price_history')
      .select(`
        price,
        date,
        competitor_product_id,
        competitor_products!inner(our_product_id, competitor_name, competitors!inner(name))
      `)
      .gte('date', fourteenDaysAgo.toISOString().split('T')[0])
      .lt('date', sevenDaysAgo.toISOString().split('T')[0]);

    // Compare prices
    if (recentPrices && previousPrices) {
      const recentAvg = new Map<string, number>();
      const previousAvg = new Map<string, number>();

      recentPrices.forEach((p: any) => {
        const key = p.competitor_product_id;
        if (!recentAvg.has(key)) {
          recentAvg.set(key, Number(p.price));
        }
      });

      previousPrices.forEach((p: any) => {
        const key = p.competitor_product_id;
        if (!previousAvg.has(key)) {
          previousAvg.set(key, Number(p.price));
        }
      });

      recentAvg.forEach((currentPrice, compProdId) => {
        const prevPrice = previousAvg.get(compProdId);
        if (prevPrice && currentPrice < prevPrice * 0.9) {
          const priceDrop = ((prevPrice - currentPrice) / prevPrice * 100).toFixed(1);
          const compProd: any = recentPrices.find((p: any) => p.competitor_product_id === compProdId);
          const competitorName = compProd?.competitor_products?.competitors?.name || 'Competitor';
          const productName = compProd?.competitor_products?.competitor_name || 'product';
          const productId = compProd?.competitor_products?.our_product_id || null;
          
          alerts.push({
            type: 'competitor_price_drop',
            title: `Competitor Price Drop Detected`,
            description: `${competitorName} dropped price by ${priceDrop}% on ${productName}`,
            severity: 'info',
            product_id: productId,
          });
        }
      });
    }

    console.log(`Generated ${alerts.length} alerts`);

    // Insert alerts into database
    if (alerts.length > 0) {
      const { error: insertError } = await supabase
        .from('insights')
        .insert(alerts);
      
      if (insertError) {
        console.error('Error inserting alerts:', insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: alerts.length,
        message: `Generated ${alerts.length} alerts`,
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