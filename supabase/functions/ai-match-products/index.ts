import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Noise words to filter
const NOISE_WORDS = new Set([
  'akcija', 'akcijas', 'super', 'mega', 'īpaši', 'special', 'offer',
  'cena', 'price', 'labs', 'good', 'great', 'best', 'top', 'quality',
  'premium', 'deluxe', 'extra', 'new', 'jauns', 'sale', 'discount',
  'the', 'a', 'an', 'and', 'or', 'for', 'to', 'in', 'of'
]);

// Brand normalization
const BRAND_NORMALIZE: Record<string, string> = {
  'coca cola': 'cocacola', 'coca-cola': 'cocacola', 'coke': 'cocacola',
  'pepsi cola': 'pepsi', 'pepsi-cola': 'pepsi',
  'rimi basic': 'rimi', 'rimi selection': 'rimi',
  'maxima xxx': 'maxima', 'maxima xx': 'maxima', 'maxima x': 'maxima',
};

function normalizeText(text: string): string {
  if (!text) return '';
  let normalized = text.toLowerCase().trim()
    .replace(/[^\w\sšžčāēīūģķļņ]/g, ' ')
    .replace(/\s+/g, ' ');
  const words = normalized.split(' ').filter(w => !NOISE_WORDS.has(w) && w.length > 1);
  return words.join(' ');
}

function normalizeBrand(brand: string | undefined): string {
  if (!brand) return '';
  const normalized = brand.toLowerCase().trim();
  return BRAND_NORMALIZE[normalized] || normalized;
}

function extractSize(text: string): number | null {
  if (!text) return null;
  const patterns = [
    { regex: /(\d+(?:\.\d+)?)\s*l(?:iters?)?/i, mult: 1000 },
    { regex: /(\d+(?:\.\d+)?)\s*ml/i, mult: 1 },
    { regex: /(\d+(?:\.\d+)?)\s*kg/i, mult: 1000 },
    { regex: /(\d+(?:\.\d+)?)\s*g(?:rams?)?/i, mult: 1 },
    { regex: /(\d+)x\s*(\d+(?:\.\d+)?)\s*ml/i, mult: 1, pack: true },
    { regex: /(\d+)x\s*(\d+(?:\.\d+)?)\s*l/i, mult: 1000, pack: true },
  ];
  
  for (const { regex, mult, pack } of patterns) {
    const match = text.match(regex);
    if (match) {
      if (pack && match[2]) {
        return parseFloat(match[1]) * parseFloat(match[2]) * mult;
      }
      return parseFloat(match[1]) * mult;
    }
  }
  return null;
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokensA = new Set(a.split(' ').filter(t => t.length > 1));
  const tokensB = new Set(b.split(' ').filter(t => t.length > 1));
  const intersection = new Set([...tokensA].filter(t => tokensB.has(t)));
  const union = new Set([...tokensA, ...tokensB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function calculateMatchScore(ourProduct: any, compProduct: any): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  
  const ourName = normalizeText(ourProduct.name || '');
  const compName = normalizeText(compProduct.competitor_product_name || compProduct.competitor_name || '');
  
  // Name similarity (40%)
  const nameStringSim = stringSimilarity(ourName, compName);
  const nameTokenSim = tokenSimilarity(ourName, compName);
  const nameSim = Math.max(nameStringSim, nameTokenSim);
  if (nameSim > 0.7) reasons.push(`Nosaukums: ${Math.round(nameSim * 100)}%`);
  
  // Brand similarity (25%)
  const ourBrand = normalizeBrand(ourProduct.brand);
  const compBrand = normalizeBrand(compProduct.competitor_brand || compProduct.category_hint);
  let brandSim = 0.5;
  if (ourBrand && compBrand) {
    if (ourBrand === compBrand) {
      brandSim = 1.0;
      reasons.push('Zīmols sakrīt');
    } else if (ourBrand.includes(compBrand) || compBrand.includes(ourBrand)) {
      brandSim = 0.8;
      reasons.push('Līdzīgs zīmols');
    } else {
      brandSim = stringSimilarity(ourBrand, compBrand);
    }
  }
  
  // Size similarity (20%)
  const ourSize = extractSize(ourProduct.name || '');
  const compSize = extractSize(compName || '');
  let sizeSim = 0.5;
  if (ourSize && compSize) {
    if (ourSize === compSize) {
      sizeSim = 1.0;
      reasons.push('Tilpums sakrīt');
    } else {
      const ratio = Math.min(ourSize, compSize) / Math.max(ourSize, compSize);
      sizeSim = ratio > 0.9 ? 0.9 : ratio;
      if (ratio > 0.8) reasons.push('Līdzīgs tilpums');
    }
  }
  
  // Category similarity (15%)
  const ourCat = normalizeText(ourProduct.category || '');
  const compCat = normalizeText(compProduct.category || compProduct.category_hint || '');
  let catSim = 0.5;
  if (ourCat && compCat) {
    if (ourCat === compCat) {
      catSim = 1.0;
      reasons.push('Kategorija sakrīt');
    } else {
      catSim = tokenSimilarity(ourCat, compCat);
    }
  }
  
  const score = 0.40 * nameSim + 0.25 * brandSim + 0.20 * sizeSim + 0.15 * catSim;
  
  return { score: Math.round(score * 100) / 100, reasons };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Authentication check - validate token manually
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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

    const body = await req.json();
    const { mode = 'auto', competitor_id } = body;

    // Input validation
    const validModes = ['auto', 'manual', 'review'];
    if (!validModes.includes(mode)) {
      return new Response(JSON.stringify({ error: 'Invalid mode. Must be "auto", "manual", or "review"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (competitor_id && !UUID_REGEX.test(competitor_id)) {
      return new Response(JSON.stringify({ error: 'Invalid competitor_id format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`User ${user.id} AI Match Products - Mode: ${mode}, Competitor: ${competitor_id || 'all'}`);

    // Get our products
    const { data: ourProducts, error: ourError } = await supabase
      .from('products')
      .select('id, sku, name, brand, category, subcategory')
      .or('status.eq.active,status.is.null');

    if (ourError) throw ourError;
    console.log(`Found ${ourProducts?.length || 0} our products`);

    // Get competitor products (from mapping table)
    let mappingQuery = supabase
      .from('competitor_product_mapping')
      .select('id, competitor_product_name, competitor_brand, competitor_size, competitor_id, our_product_id, ai_similarity_score, mapping_status');
    
    if (competitor_id) {
      mappingQuery = mappingQuery.eq('competitor_id', competitor_id);
    }

    const { data: compMappings, error: compError } = await mappingQuery;
    if (compError) throw compError;
    console.log(`Found ${compMappings?.length || 0} competitor mappings`);

    // Also get from competitor_products table
    let prodQuery = supabase
      .from('competitor_products')
      .select('id, competitor_name, competitor_id, category_hint, our_product_id');
    
    if (competitor_id) {
      prodQuery = prodQuery.eq('competitor_id', competitor_id);
    }

    const { data: compProducts, error: prodError } = await prodQuery;
    if (prodError) throw prodError;
    console.log(`Found ${compProducts?.length || 0} competitor products`);

    let matchedCount = 0;
    let updatedCount = 0;

    // Process competitor_product_mapping
    for (const mapping of compMappings || []) {
      if (mapping.our_product_id && mapping.mapping_status === 'approved') continue;
      
      let bestMatch: { productId: string; score: number; reasons: string[] } | null = null;
      
      for (const ourProd of ourProducts || []) {
        const { score, reasons } = calculateMatchScore(ourProd, mapping);
        
        if (score > 0.70 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { productId: ourProd.id, score, reasons };
        }
      }
      
      if (bestMatch && bestMatch.score >= 0.70) {
        const status = bestMatch.score >= 0.85 ? 'auto_matched' : 'pending';
        
        const { error: updateError } = await supabase
          .from('competitor_product_mapping')
          .update({
            our_product_id: bestMatch.productId,
            ai_similarity_score: bestMatch.score,
            mapping_status: status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', mapping.id);
        
        if (!updateError) {
          matchedCount++;
          console.log(`Matched: ${mapping.competitor_product_name} -> score ${bestMatch.score}`);
        }
      }
    }

    // Process competitor_products
    for (const compProd of compProducts || []) {
      if (compProd.our_product_id) continue;
      
      let bestMatch: { productId: string; score: number } | null = null;
      
      for (const ourProd of ourProducts || []) {
        const { score } = calculateMatchScore(ourProd, { 
          competitor_product_name: compProd.competitor_name,
          competitor_brand: compProd.category_hint 
        });
        
        if (score > 0.70 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { productId: ourProd.id, score };
        }
      }
      
      if (bestMatch && bestMatch.score >= 0.70) {
        const { error: updateError } = await supabase
          .from('competitor_products')
          .update({ our_product_id: bestMatch.productId })
          .eq('id', compProd.id);
        
        if (!updateError) {
          updatedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        matched_mappings: matchedCount,
        updated_products: updatedCount,
        total_our_products: ourProducts?.length || 0,
        total_competitor_mappings: compMappings?.length || 0,
        total_competitor_products: compProducts?.length || 0,
        message: `Savienoti ${matchedCount} mapping un ${updatedCount} produkti`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Match error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
