import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Matching algorithm implementations
function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  const costs: number[] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  
  return costs[s2.length];
}

function stringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function tokenSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(str1.toLowerCase().split(/\s+/));
  const tokens2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+\.?\d*/g);
  return matches ? matches.map(m => parseFloat(m)) : [];
}

function numericSimilarity(text1: string, text2: string): number {
  const nums1 = extractNumbers(text1);
  const nums2 = extractNumbers(text2);
  
  if (nums1.length === 0 || nums2.length === 0) return 0;
  
  for (const num1 of nums1) {
    for (const num2 of nums2) {
      const diff = Math.abs(num1 - num2) / Math.max(num1, num2);
      if (diff < 0.1) return 0.9;
      if (diff < 0.2) return 0.7;
    }
  }
  
  return 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_id, competitor_id } = await req.json();
    
    if (!product_id) {
      return new Response(JSON.stringify({ error: 'product_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get our product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      throw new Error('Product not found');
    }

    // Get competitor products
    const query = supabase
      .from('competitor_products')
      .select(`
        *,
        competitor_price_history(*)
      `);

    if (competitor_id) {
      query.eq('competitor_id', competitor_id);
    }

    const { data: competitorProducts, error: compError } = await query;

    if (compError) {
      throw compError;
    }

    console.log(`Matching product ${product.name} against ${competitorProducts?.length || 0} competitor products`);

    // Calculate matches
    const matches = [];

    for (const compProduct of competitorProducts || []) {
      const reasons: string[] = [];
      let totalScore = 0;
      let weights = 0;

      // Name similarity (40%)
      const nameSim = stringSimilarity(product.name, compProduct.competitor_name);
      const tokenSim = tokenSimilarity(product.name, compProduct.competitor_name);
      const nameScore = Math.max(nameSim, tokenSim);
      totalScore += nameScore * 0.4;
      weights += 0.4;

      if (nameScore > 0.7) {
        reasons.push(`Strong name match (${(nameScore * 100).toFixed(0)}%)`);
      }

      // Brand similarity (25%)
      if (product.brand && compProduct.category_hint) {
        const brandScore = stringSimilarity(product.brand, compProduct.category_hint);
        if (brandScore > 0.7) {
          totalScore += brandScore * 0.25;
          weights += 0.25;
          reasons.push(brandScore === 1.0 ? 'Exact brand match' : 'Similar brand');
        }
      }

      // Numeric attributes (25%)
      const ourText = `${product.name} ${product.category || ''}`;
      const compText = `${compProduct.competitor_name} ${compProduct.category_hint || ''}`;
      const numScore = numericSimilarity(ourText, compText);
      if (numScore > 0) {
        totalScore += numScore * 0.25;
        weights += 0.25;
        if (numScore > 0.8) reasons.push('Matching size/volume');
      }

      // Category similarity (10%)
      if (product.category) {
        const catSim = tokenSimilarity(product.category, compProduct.competitor_name);
        if (catSim > 0.3) {
          totalScore += catSim * 0.1;
          weights += 0.1;
          reasons.push('Category match');
        }
      }

      const finalScore = weights > 0 ? totalScore / weights : 0;

      if (finalScore > 0.3) {
        // Get latest price
        const latestPrice = compProduct.competitor_price_history?.[0];
        
        matches.push({
          competitor_product_id: compProduct.id,
          competitor_name: compProduct.competitor_name,
          competitor_id: compProduct.competitor_id,
          similarity_score: Math.round(finalScore * 100) / 100,
          match_reasons: reasons,
          latest_price: latestPrice?.price || null,
          is_on_promo: latestPrice?.promo_flag || false,
          auto_approve_candidate: finalScore > 0.85 && reasons.length >= 2,
        });
      }
    }

    // Sort by similarity score
    matches.sort((a, b) => b.similarity_score - a.similarity_score);

    console.log(`Found ${matches.length} potential matches`);

    return new Response(
      JSON.stringify({
        product: {
          id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category,
        },
        matches,
        total_matches: matches.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Matching error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
