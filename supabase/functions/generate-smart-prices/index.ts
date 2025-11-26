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

    const { product_ids, category, abc_class } = await req.json();

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

    // Get Smart Price configuration
    const { data: config } = await supabase
      .from('smart_price_config')
      .select('*')
      .eq('tenant_id', tenant_id)
      .single();

    const smartConfig = config || {
      global_min_margin_percent: 15,
      abc_a_max_discount_percent: 10,
      abc_b_max_discount_percent: 20,
      abc_c_max_discount_percent: 30,
      match_competitor_promo: true,
      never_below_competitor_min: true,
    };

    // Get products to process
    let query = supabase
      .from('products')
      .select('*, product_price_elasticity(*)')
      .eq('tenant_id', tenant_id)
      .eq('status', 'active');

    if (product_ids && product_ids.length > 0) {
      query = query.in('id', product_ids);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (abc_class) {
      query = query.eq('abc_category', abc_class);
    }

    const { data: products } = await query;

    if (!products || products.length === 0) {
      // Count total products to give helpful error message
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id);
      
      const message = count === 0 
        ? 'Nav atrasts neviens produkts. Lūdzu, vispirms ielādējiet produktu datus.'
        : 'Nav atrasts neviens produkts ar norādītajiem filtriem. Pārbaudiet filtru iestatījumus.';
      
      return new Response(JSON.stringify({ error: message, totalProducts: count || 0 }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const smartPrices = [];

    for (const product of products) {
      // Get competitor prices
      const { data: compPrices } = await supabase
        .from('competitor_product_mapping')
        .select(`
          competitor_prices:competitor_prices(regular_price, promo_price, is_on_promo)
        `)
        .eq('our_product_id', product.id)
        .eq('mapping_status', 'auto_matched');

      const competitorData = compPrices?.flatMap(cp => cp.competitor_prices || []) || [];
      const minCompPrice = Math.min(
        ...competitorData.map(cp => cp.is_on_promo ? cp.promo_price : cp.regular_price).filter(p => p > 0),
        Infinity
      );
      const avgCompPrice = competitorData.length > 0
        ? competitorData.reduce((sum, cp) => sum + (cp.is_on_promo ? cp.promo_price : cp.regular_price), 0) / competitorData.length
        : null;

      // Calculate smart promo price
      const result = calculateSmartPromoPrice(
        product,
        smartConfig,
        minCompPrice === Infinity ? null : minCompPrice,
        avgCompPrice
      );

      smartPrices.push(result);
    }

    return new Response(
      JSON.stringify({
        message: `Generated smart prices for ${smartPrices.length} products`,
        smart_prices: smartPrices
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error generating smart prices:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function calculateSmartPromoPrice(
  product: any,
  config: any,
  minCompPrice: number | null,
  avgCompPrice: number | null
) {
  const costPrice = Number(product.cost_price);
  const currentPrice = Number(product.current_price);
  const abcClass = product.abc_category || 'C';

  // Get max discount based on ABC class
  const maxDiscount = abcClass === 'A' 
    ? config.abc_a_max_discount_percent
    : abcClass === 'B'
    ? config.abc_b_max_discount_percent
    : config.abc_c_max_discount_percent;

  // Calculate minimum price based on margin requirement
  const minMarginPrice = costPrice / (1 - config.global_min_margin_percent / 100);

  // Calculate maximum discount price
  const maxDiscountPrice = currentPrice * (1 - maxDiscount / 100);

  // Start with the lower of the two constraints
  let promoPrice = Math.max(minMarginPrice, maxDiscountPrice);

  // Apply competitor-based adjustments
  if (config.match_competitor_promo && avgCompPrice !== null) {
    // Try to match competitor average, but respect constraints
    promoPrice = Math.max(minMarginPrice, Math.min(promoPrice, avgCompPrice));
  }

  if (config.never_below_competitor_min && minCompPrice !== null) {
    // Never go below minimum competitor price
    promoPrice = Math.max(promoPrice, minCompPrice);
  }

  // Calculate expected uplift using elasticity
  const elasticity = product.product_price_elasticity?.[0];
  const priceChangePercent = ((promoPrice - currentPrice) / currentPrice) * 100;
  let expectedUplift = 0;

  if (elasticity && elasticity.elasticity_coefficient) {
    // Volume change = elasticity * price change
    expectedUplift = Math.abs(elasticity.elasticity_coefficient * priceChangePercent);
  } else {
    // Default estimate: 2x the discount percentage
    expectedUplift = Math.abs(priceChangePercent) * 2;
  }

  const promoMargin = ((promoPrice - costPrice) / promoPrice) * 100;
  const currentMargin = ((currentPrice - costPrice) / currentPrice) * 100;

  return {
    product_id: product.id,
    product_name: product.name,
    sku: product.sku,
    cost_price: costPrice,
    current_price: currentPrice,
    current_margin: Number(currentMargin.toFixed(2)),
    promo_price: Number(promoPrice.toFixed(2)),
    promo_margin: Number(promoMargin.toFixed(2)),
    discount_percent: Number(priceChangePercent.toFixed(2)),
    expected_uplift_percent: Number(expectedUplift.toFixed(1)),
    min_comp_price: minCompPrice,
    avg_comp_price: avgCompPrice ? Number(avgCompPrice.toFixed(2)) : null,
    abc_class: abcClass,
    elasticity_coefficient: elasticity?.elasticity_coefficient || null,
    constraints_met: {
      min_margin: promoMargin >= config.global_min_margin_percent,
      max_discount: Math.abs(priceChangePercent) <= maxDiscount,
      above_comp_min: minCompPrice ? promoPrice >= minCompPrice : true,
    }
  };
}