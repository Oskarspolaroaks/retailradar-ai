import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { storeId } = await req.json();

    // Get tenant from auth
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's tenant
    const { data: userTenant } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!userTenant) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = userTenant.tenant_id;

    // Fetch KPI data for analysis
    const [productsRes, salesRes, kpiTargetsRes] = await Promise.all([
      supabase.from("products").select("*").limit(100),
      supabase.from("weekly_sales").select("*").eq("tenant_id", tenantId).order("week_end", { ascending: false }).limit(500),
      supabase.from("kpi_targets").select("*").eq("tenant_id", tenantId),
    ]);

    const products = productsRes.data || [];
    const sales = salesRes.data || [];
    const kpiTargets = kpiTargetsRes.data || [];

    // Calculate metrics for AI analysis
    const totalRevenue = sales.reduce((sum, s) => sum + (s.units_sold * 10), 0); // Simplified
    const avgMargin = sales.length > 0 ? sales.reduce((sum, s) => sum + s.gross_margin, 0) / sales.length : 0;
    const aProducts = products.filter(p => p.abc_category === "A");
    const aProductsShare = products.length > 0 ? (aProducts.length / products.length) * 100 : 0;

    // Build prompt for AI
    const analysisContext = `
Analīzes konteksts:
- Kopējie produkti: ${products.length}
- A-klases produkti: ${aProducts.length} (${aProductsShare.toFixed(1)}%)
- Pārdošanas ieraksti: ${sales.length}
- Vidējā peļņa: ${avgMargin.toFixed(1)}%
- KPI mērķi: ${kpiTargets.length} definēti

Lūdzu ģenerē 3-5 prioritāras rekomendācijas mazumtirdzniecības vadītājam.
Katrai rekomendācijai norādi: severity (high/medium/low), insight, recommendation, expected_impact.
Atbildi JSON formātā.
`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Tu esi vecākais mazumtirdzniecības eksperts ar 20+ gadu pieredzi. 
Tev jāsniedz konkrētas, darbības orientētas rekomendācijas, kas fokusējas uz peļņu, izaugsmi un prioritātēm.
Atbildi TIKAI ar JSON masīvu formātā:
[{"title": "...", "severity": "high|medium|low", "insight": "...", "recommendation": "...", "expected_impact": "...", "impact_category": "revenue|margin|stock|pricing"}]`,
          },
          { role: "user", content: analysisContext },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI API error:", await aiResponse.text());
      throw new Error("AI service unavailable");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";
    
    // Parse recommendations
    let recommendations = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      recommendations = [];
    }

    // Save recommendations to database
    const insertData = recommendations.map((rec: any) => ({
      tenant_id: tenantId,
      store_id: storeId !== "all" ? storeId : null,
      title: rec.title || "Rekomendācija",
      severity: rec.severity || "medium",
      insight: rec.insight || "",
      recommendation: rec.recommendation || "",
      expected_impact: rec.expected_impact || "",
      impact_category: rec.impact_category || "revenue",
    }));

    if (insertData.length > 0) {
      const { error: insertError } = await supabase
        .from("ai_recommendations")
        .insert(insertData);

      if (insertError) {
        console.error("Insert error:", insertError);
      }
    }

    return new Response(JSON.stringify({ success: true, count: insertData.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
