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
    const { query } = await req.json();
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('AI Query:', query);

    // Get recent data for context
    const { data: products } = await supabase
      .from('products')
      .select('id, sku, name, brand, category, cost_price, current_price, abc_category')
      .eq('status', 'active')
      .limit(100);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateStr = ninetyDaysAgo.toISOString().split('T')[0];

    const { data: sales } = await supabase
      .from('sales_daily')
      .select('product_id, units_sold, revenue')
      .gte('date', dateStr);

    // Build sales aggregation
    const salesByProduct = new Map<string, { units: number; revenue: number }>();
    sales?.forEach((s: any) => {
      const existing = salesByProduct.get(s.product_id) || { units: 0, revenue: 0 };
      existing.units += Number(s.units_sold);
      existing.revenue += Number(s.revenue);
      salesByProduct.set(s.product_id, existing);
    });

    // Enrich products with sales data
    const enrichedProducts = products?.map(p => ({
      ...p,
      margin: ((Number(p.current_price) - Number(p.cost_price)) / Number(p.current_price) * 100).toFixed(1),
      units_sold: salesByProduct.get(p.id)?.units || 0,
      revenue: salesByProduct.get(p.id)?.revenue || 0,
    })) || [];

    // Use Lovable AI to interpret the query
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are **PriceMind Copilot**, an AI data assistant inside a retail pricing intelligence platform.

## Your Role
You help retail users:
- Understand their data (products, sales, competitors, prices, margins, ABC classes)
- Identify pricing issues and opportunities
- Propose concrete actions (price changes, promotions, focus products)
- Explain pricing recommendations in clear business language

You NEVER change data directly. You ONLY analyze and suggest.

## Available Data Summary
- Total products: ${enrichedProducts.length}
- Products by ABC: A=${enrichedProducts.filter(p => p.abc_category === 'A').length}, B=${enrichedProducts.filter(p => p.abc_category === 'B').length}, C=${enrichedProducts.filter(p => p.abc_category === 'C').length}
- Total revenue (90d): €${enrichedProducts.reduce((sum, p) => sum + p.revenue, 0).toFixed(2)}
- Avg margin: ${(enrichedProducts.reduce((sum, p) => sum + Number(p.margin), 0) / enrichedProducts.length).toFixed(1)}%

Top products by revenue:
${enrichedProducts.sort((a, b) => b.revenue - a.revenue).slice(0, 10).map(p => 
  `- ${p.name} (${p.sku}): €${p.revenue.toFixed(2)}, ${p.units_sold} units, ${p.margin}% margin, ABC: ${p.abc_category || 'N/A'}`
).join('\n')}

## Output Format
Every answer must have three parts:

1. **Summary** (2-4 sentences with core insight)
2. **Details** (bullet list with key items/products/metrics)
3. **Actions** (concrete recommendations starting with verbs)

Example:
"**Summary**: Your A-class beverages are underpriced vs competitors with room to increase margin.

**Details**:
- SKU 1001 – Cola 1L: 12% cheaper than avg competitor, high volume
- SKU 1005 – Energy Drink: 9% cheaper, margin 18% vs target 25%

**Actions**:
- Increase price for SKU 1001 by ~5%
- Increase price for SKU 1005 by 3-4% and monitor volume"

## Pricing Logic Principles
- If MUCH CHEAPER than competitors (>8-10%) with STRONG sales → recommend INCREASE
- If MORE EXPENSIVE than avg with WEAK/declining sales → recommend DECREASE
- If margin BELOW TARGET with NO competitive pressure → recommend SMALL INCREASE
- C-class low contribution + strong competition → consider DECREASE/promotion
- A-class strong volume + good margin → avoid aggressive discounting

Consider: ABC class importance, target margin, desired market position.

## Tone
Clear, confident, practical. Focus on actionable insights with specific product names and numbers.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'AI rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted. Please add funds.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('AI request failed');
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || 'Unable to generate response';

    return new Response(
      JSON.stringify({ answer }),
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