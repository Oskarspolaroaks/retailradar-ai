import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Latvian retail sites product extraction patterns
const SITE_PATTERNS: Record<string, any> = {
  'rimi.lv': {
    productSelector: /class="[^"]*product[^"]*"[^>]*>[\s\S]*?<\/(?:div|article)/gi,
    namePattern: /"name":\s*"([^"]+)"/,
    pricePattern: /"price":\s*(\d+\.?\d*)/,
    brandPattern: /"brand":\s*\{[^}]*"name":\s*"([^"]+)"/,
  },
  'maxima.lv': {
    productSelector: /class="[^"]*product[^"]*"[^>]*>[\s\S]*?<\/(?:div|article)/gi,
    namePattern: /<h[23][^>]*>([^<]+)</,
    pricePattern: /(\d+[.,]\d{2})\s*€/,
  },
  'lidl.lv': {
    jsonLd: true,
    productSelector: /<script type="application\/ld\+json">[\s\S]*?<\/script>/gi,
  },
};

interface ScrapedProduct {
  name: string;
  brand?: string;
  regular_price?: number;
  promo_price?: number;
  size?: string;
  category?: string;
  url?: string;
}

function extractFromJsonLd(html: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  const jsonLdPattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let match;
  
  while ((match = jsonLdPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data['@type'] === 'Product') {
        products.push({
          name: data.name,
          brand: data.brand?.name,
          regular_price: data.offers?.price ? parseFloat(data.offers.price) : undefined,
          promo_price: data.offers?.lowPrice ? parseFloat(data.offers.lowPrice) : undefined,
        });
      }
      if (Array.isArray(data['@graph'])) {
        for (const item of data['@graph']) {
          if (item['@type'] === 'Product') {
            products.push({
              name: item.name,
              brand: item.brand?.name,
              regular_price: item.offers?.price ? parseFloat(item.offers.price) : undefined,
            });
          }
        }
      }
    } catch (e) {
      // Skip invalid JSON
    }
  }
  
  return products;
}

function extractFromMeta(html: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  
  // Extract og:product meta tags
  const productName = html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1];
  const productPrice = html.match(/<meta property="product:price:amount" content="([^"]+)"/i)?.[1];
  
  if (productName && productPrice) {
    products.push({
      name: productName,
      regular_price: parseFloat(productPrice),
    });
  }
  
  return products;
}

function extractWithPatterns(html: string, url: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  
  // Try JSON-LD first (most reliable)
  const jsonLdProducts = extractFromJsonLd(html);
  if (jsonLdProducts.length > 0) {
    return jsonLdProducts;
  }
  
  // Try meta tags
  const metaProducts = extractFromMeta(html);
  if (metaProducts.length > 0) {
    return metaProducts;
  }
  
  // Try common data attributes
  const dataProductPattern = /data-product[^>]*name="([^"]+)"[^>]*price="(\d+\.?\d*)"/gi;
  let match;
  while ((match = dataProductPattern.exec(html)) !== null) {
    products.push({
      name: match[1],
      regular_price: parseFloat(match[2]),
      url,
    });
  }
  
  // Try microdata
  const microdataPattern = /itemtype="[^"]*Product[^"]*"[\s\S]*?itemprop="name"[^>]*>([^<]+)[\s\S]*?itemprop="price"[^>]*content="(\d+\.?\d*)"/gi;
  while ((match = microdataPattern.exec(html)) !== null) {
    products.push({
      name: match[1].trim(),
      regular_price: parseFloat(match[2]),
      url,
    });
  }
  
  return products;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, competitor_id, use_ai = true } = await req.json();
    
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`AI Scraping: ${url}`);

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'lv,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    console.log(`Fetched ${html.length} bytes`);

    // Extract products
    let products = extractWithPatterns(html, url);
    console.log(`Extracted ${products.length} products`);

    // If we got products and have competitor_id, save to database
    if (competitor_id && products.length > 0) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get tenant_id from competitor
      const { data: competitor } = await supabase
        .from('competitors')
        .select('tenant_id')
        .eq('id', competitor_id)
        .single();

      const tenant_id = competitor?.tenant_id || null;

      for (const product of products.slice(0, 50)) { // Limit to 50 products
        // Add to competitor_product_mapping
        const { error: mappingError } = await supabase
          .from('competitor_product_mapping')
          .upsert({
            competitor_id,
            competitor_product_name: product.name,
            competitor_brand: product.brand,
            competitor_size: product.size,
            competitor_product_url: url,
            mapping_status: 'pending',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'competitor_product_name,competitor_id',
            ignoreDuplicates: true,
          });

        if (mappingError) {
          console.log(`Mapping insert note: ${mappingError.message}`);
        }
      }

      // Update competitor last_catalog_scrape
      await supabase
        .from('competitors')
        .update({ last_catalog_scrape: new Date().toISOString() })
        .eq('id', competitor_id);

      console.log(`Saved ${Math.min(products.length, 50)} products to mappings`);
    }

    // If no products found via standard extraction, provide demo data for testing
    if (products.length === 0) {
      console.log('No products found via extraction, URL might need JavaScript rendering');
      // Return informative response
      return new Response(
        JSON.stringify({
          success: true,
          products: [],
          scraped_at: new Date().toISOString(),
          url,
          message: 'Mājaslapa izmanto JavaScript rendering. Produkti netika automātiski izvilkti. Lūdzu pievienojiet manuāli vai izmantojiet API integrāciju.',
          html_size: html.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        products,
        count: products.length,
        scraped_at: new Date().toISOString(),
        url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Scraping error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        products: [],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
