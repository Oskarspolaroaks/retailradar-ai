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

    const { promotion_id } = await req.json();

    // Input validation
    if (!promotion_id || typeof promotion_id !== 'string') {
      return new Response(JSON.stringify({ error: 'promotion_id is required and must be a string' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate UUID format
    if (!UUID_REGEX.test(promotion_id)) {
      return new Response(JSON.stringify({ error: 'Invalid promotion_id format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`User ${user.id} parsing promotion:`, promotion_id);

    // Fetch promotion
    const { data: promotion, error: promoError } = await supabase
      .from('competitor_promotions')
      .select('*')
      .eq('id', promotion_id)
      .single();

    if (promoError || !promotion) {
      throw new Error('Promotion not found');
    }

    console.log('Promotion details:', promotion);

    let parsedItems: any[] = [];

    // Parse based on source type
    if (promotion.source_type === 'url' && promotion.source_url) {
      // Fetch and parse HTML
      console.log('Fetching promotion page:', promotion.source_url);

      // Add timeout for fetch
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      let response;
      try {
        response = await fetch(promotion.source_url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Limit response size
      if (html.length > 5000000) {
        throw new Error('Response too large');
      }
      
      parsedItems = extractProductsFromPromoHTML(html);
      
    } else if (promotion.source_type === 'pdf') {
      // For PDFs, we'd need OCR/PDF parsing
      // For MVP, mark as needs manual review
      console.log('PDF parsing not yet implemented - manual review needed');
      parsedItems = [];
      
    } else if (promotion.source_type === 'image') {
      // For images, we'd need OCR
      console.log('Image parsing not yet implemented - manual review needed');
      parsedItems = [];
    }

    // Save parsed items
    if (parsedItems.length > 0) {
      const itemsToInsert = parsedItems.map(item => ({
        promotion_id,
        competitor_product_name: item.name,
        competitor_product_url: item.url,
        competitor_brand: item.brand,
        competitor_size: item.size,
        regular_price: item.regular_price,
        promo_price: item.promo_price,
        currency: item.currency || 'EUR',
        unit_price: item.unit_price,
        promo_label: item.promo_label,
      }));

      const { error: insertError } = await supabase
        .from('competitor_promotion_items')
        .insert(itemsToInsert);

      if (insertError) {
        console.error('Error inserting promotion items:', insertError);
        throw insertError;
      }

      // Update promotion
      await supabase
        .from('competitor_promotions')
        .update({
          processed: true,
          items_count: parsedItems.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', promotion_id);
    }

    console.log(`Parsed ${parsedItems.length} promotion items`);

    return new Response(
      JSON.stringify({
        success: true,
        promotion_id,
        items_parsed: parsedItems.length,
        items: parsedItems,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Promotion parsing error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Extract products from promotion HTML
 */
function extractProductsFromPromoHTML(html: string): any[] {
  const products: any[] = [];
  
  // Simple regex-based extraction
  // Look for product blocks with promo indicators
  const promoBlockRegex = /<(?:div|article|li)[^>]*class="[^"]*(?:promo|akcija|offer|special)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|li)>/gi;
  const blocks = [...html.matchAll(promoBlockRegex)];
  
  for (const block of blocks) {
    try {
      const blockHtml = block[1];
      
      // Extract product name
      const nameMatch = blockHtml.match(/<(?:h2|h3|h4|span)[^>]*class="[^"]*(?:name|title|product)[^"]*"[^>]*>([^<]+)/i);
      const name = nameMatch ? nameMatch[1].trim() : null;
      if (!name) continue;
      
      // Extract brand
      const brandMatch = blockHtml.match(/<[^>]*class="[^"]*brand[^"]*"[^>]*>([^<]+)/i);
      const brand = brandMatch ? brandMatch[1].trim() : undefined;
      
      // Extract prices
      const priceMatches = [...blockHtml.matchAll(/<[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)/gi)];
      let regular_price: number | null = null;
      let promo_price: number | null = null;
      
      for (const priceMatch of priceMatches) {
        const priceText = priceMatch[1];
        const price = extractPrice(priceText);
        
        if (price) {
          const isPromo = priceMatch[0].toLowerCase().includes('promo') ||
                         priceMatch[0].toLowerCase().includes('special') ||
                         priceMatch[0].toLowerCase().includes('akcij');
          
          if (isPromo && !promo_price) {
            promo_price = price;
          } else if (!regular_price) {
            regular_price = price;
          }
        }
      }
      
      // Extract promo label
      const promoMatch = blockHtml.match(/<[^>]*class="[^"]*(?:promo|badge|label)[^"]*"[^>]*>([^<]+)/i);
      const promo_label = promoMatch ? promoMatch[1].trim() : undefined;
      
      // Extract size
      const sizeMatch = blockHtml.match(/(\d+(?:\.\d+)?)\s*(?:l|ml|g|kg)/i);
      const size = sizeMatch ? sizeMatch[0] : undefined;
      
      if (promo_price) {
        products.push({
          name,
          brand,
          size,
          regular_price,
          promo_price,
          currency: 'EUR',
          promo_label,
        });
      }
    } catch (err) {
      console.error('Error extracting product from promo block:', err);
    }
  }
  
  return products;
}

/**
 * Extract price from text
 */
function extractPrice(text: string): number | null {
  if (!text) return null;
  
  const cleaned = text
    .replace(/[€$£]/g, '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  
  const match = cleaned.match(/(\d+[.,]?\d{0,2})/);
  if (match) {
    return parseFloat(match[1].replace(',', '.'));
  }
  
  return null;
}
