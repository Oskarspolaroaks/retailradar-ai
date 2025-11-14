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

    const { query } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch relevant data based on query context
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .limit(100);

    const { data: sales } = await supabase
      .from('sales')
      .select('*')
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .limit(500);

    // Build context
    const dataContext = `
Available data:
- Total products: ${products?.length || 0}
- Products by ABC category: ${products?.filter(p => p.abc_category === 'A').length || 0} A, ${products?.filter(p => p.abc_category === 'B').length || 0} B, ${products?.filter(p => p.abc_category === 'C').length || 0} C
- Recent sales records: ${sales?.length || 0} (last 90 days)
- Total revenue (last 90 days): $${(sales?.reduce((sum, s) => sum + Number(s.net_revenue), 0) || 0).toFixed(2)}
- Average product margin: ${products?.length ? ((products.reduce((sum, p) => sum + ((p.current_price - p.cost_price) / p.current_price * 100), 0) / products.length).toFixed(2)) : 0}%

Sample product categories: ${[...new Set(products?.map(p => p.category).filter(Boolean))].slice(0, 5).join(', ')}
`;

    const prompt = `Based on this retail pricing data:

${dataContext}

User query: ${query}

Provide a clear, data-driven answer. If the query requests specific calculations or comparisons, show the numbers. If charts would help, describe what chart type would be best (bar, line, pie) and what data to visualize. Keep the response concise and actionable.`;

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
          { role: 'system', content: 'You are a retail analytics assistant. Provide clear, data-driven answers with specific numbers and actionable insights.' },
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
        JSON.stringify({ error: 'AI search failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices[0].message.content;

    return new Response(
      JSON.stringify({ 
        answer,
        query 
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