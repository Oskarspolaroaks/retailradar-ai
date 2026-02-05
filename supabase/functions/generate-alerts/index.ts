import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`User ${user.id} generating alerts...`);

    const alerts = [];
    const targetMargin = 25; // Default target

    // Get products
    const { data: products } = await supabase
      .from('products')
      .select('id, sku, name, cost_price, current_price, abc_category, tenant_id')
      .eq('status', 'active');

    if (!products) {
      throw new Error('No products found');
    }

    // Get competitor price data for comparison
    const { data: competitorPrices } = await supabase
      .from('competitor_price_history')
      .select(`
        *,
        competitor_products!inner(
          our_product_id,
          competitor_name,
          competitors(name)
        )
      `);

    // Build competitor price map by product
    const competitorPriceMap = new Map<string, any[]>();
    (competitorPrices || []).forEach((cp: any) => {
      const productId = cp.competitor_products?.our_product_id;
      if (productId) {
        if (!competitorPriceMap.has(productId)) {
          competitorPriceMap.set(productId, []);
        }
        competitorPriceMap.get(productId)!.push(cp);
      }
    });

    // Check for low margin and competitor pricing alerts
    for (const product of products) {
      const margin = ((Number(product.current_price) - Number(product.cost_price)) / Number(product.current_price)) * 100;
      
      // Low margin alert
      if (margin < targetMargin - 10) {
        alerts.push({
          type: 'low_margin',
          title: `Low Margin Alert: ${product.name}`,
          description: `Product ${product.sku} has only ${margin.toFixed(1)}% margin, well below the ${targetMargin}% target.`,
          severity: 'warning',
          product_id: product.id,
          tenant_id: product.tenant_id,
        });
      }

      // Competitor pricing alerts
      const compPrices = competitorPriceMap.get(product.id) || [];
      if (compPrices.length > 0) {
        const avgCompPrice = compPrices.reduce((sum, cp) => sum + Number(cp.price), 0) / compPrices.length;
        const priceGapVsAvg = ((Number(product.current_price) - avgCompPrice) / avgCompPrice) * 100;

        // Alert: We're 15%+ more expensive than competitor average
        if (priceGapVsAvg > 15) {
          alerts.push({
            type: 'competitor_pricing',
            title: `Overpriced vs Market: ${product.name}`,
            description: `Our price (€${product.current_price}) is ${priceGapVsAvg.toFixed(0)}% above competitor average (€${avgCompPrice.toFixed(2)})`,
            severity: 'warning',
            product_id: product.id,
            tenant_id: product.tenant_id,
          });
        }

        // Alert: Competitor has promotion running
        const competitorPromo = compPrices.find(cp => cp.promo_flag);
        if (competitorPromo && Number(product.current_price) > Number(competitorPromo.price)) {
          const compName = competitorPromo.competitor_products?.competitors?.name || 'Competitor';
          alerts.push({
            type: 'competitor_promo',
            title: `Competitor Promotion Active: ${product.name}`,
            description: `${compName} has promotion at €${competitorPromo.price}. Our price: €${product.current_price}`,
            severity: 'info',
            product_id: product.id,
            tenant_id: product.tenant_id,
          });
        }
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
          
          const product = products.find((p: any) => p.id === productId);
          alerts.push({
            type: 'competitor_price_drop',
            title: `Competitor Price Drop Detected`,
            description: `${competitorName} dropped price by ${priceDrop}% on ${productName}`,
            severity: 'info',
            product_id: productId,
            tenant_id: product?.tenant_id,
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