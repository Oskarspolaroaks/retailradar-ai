import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    const { competitor_id, source } = await req.json();

    // Input validation
    if (!competitor_id || typeof competitor_id !== 'string') {
      return new Response(JSON.stringify({ error: 'competitor_id is required and must be a string' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate UUID format
    if (!UUID_REGEX.test(competitor_id)) {
      return new Response(JSON.stringify({ error: 'Invalid competitor_id format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate source
    const validSources = ['catalog', 'promotions'];
    if (source && !validSources.includes(source)) {
      return new Response(JSON.stringify({ error: 'Invalid source. Must be "catalog" or "promotions"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`User ${user.id} batch matching products for competitor:`, competitor_id);

    // Fetch all our products
    const { data: ourProducts, error: productsError } = await supabase
      .from('products')
      .select('id, name, brand, category, subcategory, size, sku, barcode, base_unit')
      .eq('status', 'active');

    if (productsError) throw productsError;

    console.log(`Loaded ${ourProducts.length} active products`);

    // Fetch competitor products to match
    let competitorProducts: any[] = [];
    
    if (source === 'catalog') {
      // From scrape history
      const { data: prices, error: pricesError } = await supabase
        .from('competitor_price_history')
        .select(`
          id,
          competitor_product_id,
          competitor_products!inner(
            id,
            competitor_name,
            competitor_sku,
            category_hint,
            barcode
          )
        `)
        .eq('competitor_products.competitor_id', competitor_id)
        .order('date', { ascending: false })
        .limit(1000);

      if (!pricesError && prices) {
        // Group by competitor_product_id to avoid duplicates
        const uniqueProducts = new Map();
        prices.forEach(p => {
          const compProd = p.competitor_products as any;
          if (!uniqueProducts.has(p.competitor_product_id)) {
            uniqueProducts.set(p.competitor_product_id, {
              id: p.competitor_product_id,
              name: compProd.competitor_name,
              sku: compProd.competitor_sku,
              category: compProd.category_hint,
              barcode: compProd.barcode,
            });
          }
        });
        competitorProducts = Array.from(uniqueProducts.values());
      }
    } else if (source === 'promotions') {
      // From promotion items
      const { data: promoItems, error: promoError } = await supabase
        .from('competitor_promotion_items')
        .select(`
          id,
          competitor_product_name,
          competitor_brand,
          competitor_size,
          competitor_product_url,
          competitor_promotions!inner(competitor_id)
        `)
        .eq('competitor_promotions.competitor_id', competitor_id)
        .is('linked_mapping_id', null);

      if (!promoError && promoItems) {
        competitorProducts = promoItems.map(item => ({
          id: item.id,
          name: item.competitor_product_name,
          brand: item.competitor_brand,
          size: item.competitor_size,
          url: item.competitor_product_url,
        }));
      }
    }

    console.log(`Found ${competitorProducts.length} competitor products to match`);

    // Match products
    const matches: any[] = [];
    
    for (const compProduct of competitorProducts) {
      for (const ourProduct of ourProducts) {
        const score = calculateMatchScore(ourProduct, compProduct);
        
        if (score >= 0.60) {
          matches.push({
            our_product_id: ourProduct.id,
            competitor_product_name: compProduct.name,
            competitor_product_url: compProduct.url,
            competitor_product_sku: compProduct.sku,
            competitor_brand: compProduct.brand,
            competitor_size: compProduct.size,
            ai_similarity_score: score,
            mapping_status: score >= 0.85 ? 'auto_matched' : 'pending',
          });
        }
      }
    }

    // Sort by score and keep best match per our product
    const bestMatches = new Map<string, any>();
    for (const match of matches.sort((a, b) => b.ai_similarity_score - a.ai_similarity_score)) {
      if (!bestMatches.has(match.our_product_id)) {
        bestMatches.set(match.our_product_id, match);
      }
    }

    // Save mappings
    const mappingsToSave = Array.from(bestMatches.values()).map(m => ({
      ...m,
      competitor_id,
    }));

    if (mappingsToSave.length > 0) {
      const { error: saveError } = await supabase
        .from('competitor_product_mapping')
        .upsert(mappingsToSave, {
          onConflict: 'our_product_id,competitor_id,competitor_product_url',
        });

      if (saveError) {
        console.error('Error saving mappings:', saveError);
      }
    }

    console.log(`Created ${mappingsToSave.length} product mappings`);

    return new Response(
      JSON.stringify({
        success: true,
        competitor_id,
        mappings_created: mappingsToSave.length,
        auto_matched: mappingsToSave.filter(m => m.mapping_status === 'auto_matched').length,
        pending_review: mappingsToSave.filter(m => m.mapping_status === 'pending').length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Batch matching error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Simplified matching algorithm
function calculateMatchScore(ourProduct: any, compProduct: any): number {
  const ourName = normalizeText(ourProduct.name);
  const compName = normalizeText(compProduct.name);
  
  // Token overlap
  const ourTokens = new Set(ourName.split(' '));
  const compTokens = new Set(compName.split(' '));
  const intersection = new Set([...ourTokens].filter(t => compTokens.has(t)));
  const union = new Set([...ourTokens, ...compTokens]);
  
  const tokenSim = union.size > 0 ? intersection.size / union.size : 0;
  
  // Brand match
  const brandSim = ourProduct.brand && compProduct.brand &&
    normalizeText(ourProduct.brand) === normalizeText(compProduct.brand) ? 1 : 0.5;
  
  // Combine
  return 0.7 * tokenSim + 0.3 * brandSim;
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text.toLowerCase().trim().replace(/[^\\w\\s]/g, ' ').replace(/\\s+/g, ' ');
}
