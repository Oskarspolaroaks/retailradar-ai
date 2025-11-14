import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { promotionIds } = await req.json();

    if (!promotionIds || promotionIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No promotion IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch promotion details
    const { data: promotions, error: promoError } = await supabase
      .from('competitor_promotions')
      .select(`
        *,
        competitors:competitor_id (
          name,
          type
        )
      `)
      .in('id', promotionIds);

    if (promoError) {
      console.error('Error fetching promotions:', promoError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch promotions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context for AI
    const promoContext = promotions.map((p: any) => {
      const comp = p.competitors;
      return `${comp.name} (${comp.type}): ${p.promotion_name} - ${p.description || 'No description'}. 
Discount: ${p.discount_percent ? p.discount_percent + '%' : p.discount_amount ? '$' + p.discount_amount : 'N/A'}. 
Duration: ${p.start_date} to ${p.end_date || 'ongoing'}. 
Category: ${p.product_category || 'All products'}. 
Slogan: ${p.slogan || 'None'}.`;
    }).join('\n\n');

    const prompt = `Analyze these competitor promotions and provide strategic insights:

${promoContext}

Provide:
1. Overall promotion strategy summary
2. Key patterns (duration, discount levels, product categories)
3. Potential impact on our pricing and sales
4. Recommended counter-strategies
5. Risk assessment (low/medium/high)

Keep the analysis concise and actionable.`;

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a pricing and competitive strategy expert. Provide concise, actionable insights.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices[0].message.content;

    return new Response(
      JSON.stringify({ 
        analysis,
        promotions_analyzed: promotions.length 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});