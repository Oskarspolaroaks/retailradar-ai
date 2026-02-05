import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Allowed domains for scraping
const ALLOWED_DOMAINS = ['rimi.lv', 'maxima.lv', 'lidl.lv', 'barbora.lv', 'citro.lv', 'nuko.lv', 'top.lv'];

function isAllowedUrl(urlString: string): boolean {
  try {
    const parsedUrl = new URL(urlString);
    
    // Block internal/local URLs
    if (parsedUrl.hostname === 'localhost' || 
        parsedUrl.hostname.startsWith('127.') ||
        parsedUrl.hostname.startsWith('192.168.') ||
        parsedUrl.hostname.startsWith('10.') ||
        parsedUrl.hostname.startsWith('172.') ||
        parsedUrl.hostname.endsWith('.internal') ||
        parsedUrl.hostname.endsWith('.local')) {
      return false;
    }
    
    // Check if domain is in allowed list
    return ALLOWED_DOMAINS.some(domain => parsedUrl.hostname.endsWith(domain));
  } catch {
    return false;
  }
}

interface ScrapedProduct {
  name: string;
  brand?: string;
  regular_price?: number;
  promo_price?: number;
  is_on_promo: boolean;
  promo_text?: string;
  in_stock: boolean;
  size?: string;
  url?: string;
}

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

function extractProductsFromHTML(html: string, baseUrl: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  
  // Simple regex-based extraction since we can't use DOM in Deno
  // Look for common product patterns in HTML
  
  // Extract product blocks (simplified approach)
  const productBlockRegex = /<(?:div|article|li)[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|li)>/gi;
  const blocks = [...html.matchAll(productBlockRegex)];
  
  for (const block of blocks) {
    try {
      const blockHtml = block[1];
      
      // Extract product name
      const nameMatch = blockHtml.match(/<(?:h2|h3|h4|span)[^>]*class="[^"]*(?:name|title)[^"]*"[^>]*>([^<]+)</i);
      const name = nameMatch ? nameMatch[1].trim() : null;
      if (!name) continue;
      
      // Extract brand
      const brandMatch = blockHtml.match(/<[^>]*class="[^"]*brand[^"]*"[^>]*>([^<]+)</i);
      const brand = brandMatch ? brandMatch[1].trim() : undefined;
      
      // Extract prices
      const priceMatches = [...blockHtml.matchAll(/<[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)</gi)];
      let regular_price: number | null = null;
      let promo_price: number | null = null;
      
      for (const priceMatch of priceMatches) {
        const priceText = priceMatch[1];
        const price = extractPrice(priceText);
        
        if (price) {
          const isPromo = priceMatch[0].toLowerCase().includes('sale') ||
                         priceMatch[0].toLowerCase().includes('promo') ||
                         priceMatch[0].toLowerCase().includes('discount');
          
          if (isPromo && !promo_price) {
            promo_price = price;
          } else if (!regular_price) {
            regular_price = price;
          }
        }
      }
      
      if (!regular_price && promo_price) {
        regular_price = promo_price;
        promo_price = null;
      }
      
      // Extract promo text
      const promoMatch = blockHtml.match(/<[^>]*class="[^"]*(?:promo|badge|tag)[^"]*"[^>]*>([^<]+)</i);
      const promo_text = promoMatch ? promoMatch[1].trim() : undefined;
      
      // Extract stock status
      const stockMatch = blockHtml.match(/<[^>]*class="[^"]*(?:stock|availability)[^"]*"[^>]*>([^<]+)</i);
      const stockText = stockMatch ? stockMatch[1].toLowerCase() : '';
      const in_stock = !stockText.includes('out') && !stockText.includes('sold out');
      
      // Extract size
      const sizeMatch = blockHtml.match(/<[^>]*class="[^"]*(?:size|volume)[^"]*"[^>]*>([^<]+)</i);
      const size = sizeMatch ? sizeMatch[1].trim() : undefined;
      
      if (regular_price) {
        products.push({
          name,
          brand,
          regular_price,
          promo_price: promo_price || undefined,
          is_on_promo: !!promo_price,
          promo_text,
          in_stock,
          size,
          url: baseUrl,
        });
      }
    } catch (err) {
      console.error('Error extracting product from block:', err);
    }
  }
  
  console.log(`Extracted ${products.length} products from HTML`);
  return products;
}

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

    const { url, competitor_id } = await req.json();

    // Input validation
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof url !== 'string' || url.length > 2000) {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate URL format and domain
    if (!isAllowedUrl(url)) {
      return new Response(JSON.stringify({ 
        error: 'Domain not allowed. Only Latvian retail sites are permitted.',
        allowed_domains: ALLOWED_DOMAINS 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate competitor_id format if provided
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (competitor_id && !uuidRegex.test(competitor_id)) {
      return new Response(JSON.stringify({ error: 'Invalid competitor_id format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`User ${user.id} scraping competitor URL:`, url);

    // Fetch the webpage
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Limit response size to prevent memory issues
    if (html.length > 5000000) { // 5MB limit
      throw new Error('Response too large');
    }
    
    console.log(`Fetched ${html.length} bytes of HTML`);

    // Extract products
    const products = extractProductsFromHTML(html, url);

    // If competitor_id provided, save to database
    if (competitor_id && products.length > 0) {
      // Get tenant_id from user
      const { data: userTenant } = await supabase
        .from('user_tenants')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      const tenant_id = userTenant?.tenant_id;

      // Save scraping results
      for (const product of products.slice(0, 100)) { // Limit to 100 products
        // Create or update competitor product
        const { data: compProduct, error: compError } = await supabase
          .from('competitor_products')
          .upsert({
            competitor_id,
            competitor_name: product.name,
            competitor_sku: `scraped-${Date.now()}`,
            category_hint: product.brand,
            tenant_id: tenant_id,
          })
          .select()
          .single();

        if (!compError && compProduct) {
          // Save price history
          await supabase.from('competitor_price_history').insert({
            competitor_product_id: compProduct.id,
            date: new Date().toISOString().split('T')[0],
            price: product.regular_price || 0,
            promo_flag: product.is_on_promo,
            note: product.promo_text || (product.promo_price ? `Promo: €${product.promo_price}` : null),
            tenant_id: tenant_id,
          });
        }
      }

      console.log(`Saved ${Math.min(products.length, 100)} products to database`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        products,
        scraped_at: new Date().toISOString(),
        url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scraping error:', error);
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
