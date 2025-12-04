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
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's tenant_id
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's tenant
    const { data: userTenant } = await supabase
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!userTenant) {
      return new Response(JSON.stringify({ error: 'No tenant found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenant_id = userTenant.tenant_id;
    console.log('Generating pricing recommendations for tenant:', tenant_id);

    // Get all products with their pricing data for this tenant
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, sku, name, category, cost_price, current_price, currency, abc_category, is_private_label, tenant_id')
      .eq('tenant_id', tenant_id)
      .or('status.eq.active,status.is.null');

    if (productsError) throw productsError;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ error: 'No products found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${products.length} products...`);

    // Get competitor pricing data for this tenant
    const { data: competitorPrices } = await supabase
      .from('competitor_price_history')
      .select(`
        id,
        price,
        date,
        competitor_product_id,
        competitor_products!inner(our_product_id)
      `)
      .eq('tenant_id', tenant_id)
      .order('date', { ascending: false });

    // Build competitor price map (product_id -> avg price)
    const competitorPriceMap = new Map<string, { min: number; avg: number; max: number; count: number }>();
    
    if (competitorPrices) {
      const pricesByProduct = new Map<string, number[]>();
      
      competitorPrices.forEach((cp: any) => {
        const productId = cp.competitor_products?.our_product_id;
        if (productId) {
          if (!pricesByProduct.has(productId)) {
            pricesByProduct.set(productId, []);
          }
          pricesByProduct.get(productId)!.push(Number(cp.price));
        }
      });

      pricesByProduct.forEach((prices, productId) => {
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        competitorPriceMap.set(productId, { min, avg, max, count: prices.length });
      });
    }

    console.log(`Found competitor data for ${competitorPriceMap.size} products`);

    // Get sales data for the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateStr = ninetyDaysAgo.toISOString().split('T')[0];

    const { data: salesData } = await supabase
      .from('sales_daily')
      .select('product_id, units_sold, revenue, date')
      .eq('tenant_id', tenant_id)
      .gte('date', dateStr);

    // Build sales map
    const salesMap = new Map<string, { units: number; revenue: number; trend: string }>();
    
    if (salesData) {
      salesData.forEach((sale: any) => {
        const existing = salesMap.get(sale.product_id) || { units: 0, revenue: 0, trend: 'stable' };
        existing.units += Number(sale.units_sold);
        existing.revenue += Number(sale.revenue);
        salesMap.set(sale.product_id, existing);
      });
    }

    console.log(`Found sales data for ${salesMap.size} products`);

    // Generate recommendations
    const recommendations = [];
    const targetMarginA = 20; // Target margin for A class
    const targetMarginB = 25; // Target margin for B class  
    const targetMarginC = 30; // Target margin for C class
    const targetMarginDefault = 25;

    for (const product of products) {
      const costPrice = Number(product.cost_price);
      const currentPrice = Number(product.current_price);
      
      // Skip invalid data
      if (costPrice <= 0 || currentPrice <= 0) {
        console.log(`Skipping product ${product.sku}: invalid prices (cost: ${costPrice}, current: ${currentPrice})`);
        continue;
      }
      
      const currentMargin = ((currentPrice - costPrice) / currentPrice) * 100;
      
      const competitorData = competitorPriceMap.get(product.id);
      const salesInfo = salesMap.get(product.id);
      const abcCategory = product.abc_category || 'C'; // Default to C if no category
      
      let recommendedPrice = currentPrice;
      let action = 'keep_price';
      let reasoning = '';
      let shouldRecommend = false;

      // Get target margin based on ABC class
      const targetMargin = abcCategory === 'A' ? targetMarginA : 
                          abcCategory === 'B' ? targetMarginB : targetMarginC;

      // === PRICING ENGINE LOGIC ===

      // 1. LOW MARGIN CHECK - Always recommend if margin is too low
      if (currentMargin < targetMargin - 5) {
        recommendedPrice = costPrice / (1 - targetMargin / 100);
        action = 'increase_price';
        reasoning = `Zema marža (${currentMargin.toFixed(1)}%) - mērķis ${targetMargin}%. Palielini cenu līdz €${recommendedPrice.toFixed(2)} labākai rentabilitātei.`;
        shouldRecommend = true;
      }
      
      // 2. COMPETITOR-BASED RECOMMENDATIONS (if we have competitor data)
      if (!shouldRecommend && competitorData) {
        const priceDiffPercent = ((currentPrice - competitorData.avg) / competitorData.avg) * 100;
        
        // We're significantly cheaper than competitors (>8%)
        if (priceDiffPercent < -8) {
          recommendedPrice = competitorData.avg * 0.97; // Just below competitor avg
          action = 'increase_price';
          reasoning = `Mūsu cena €${currentPrice.toFixed(2)} ir ${Math.abs(priceDiffPercent).toFixed(1)}% zem konkurentu vidējās (€${competitorData.avg.toFixed(2)}). Paaugstini cenu, lai palielinātu maržu.`;
          shouldRecommend = true;
        }
        // We're significantly more expensive than competitors (>10%)
        else if (priceDiffPercent > 10 && abcCategory !== 'A') {
          recommendedPrice = competitorData.avg * 1.02; // Slightly above competitor avg
          action = 'decrease_price';
          reasoning = `Mūsu cena €${currentPrice.toFixed(2)} ir ${priceDiffPercent.toFixed(1)}% virs konkurentu vidējās (€${competitorData.avg.toFixed(2)}). Samazini cenu konkurētspējas uzlabošanai.`;
          shouldRecommend = true;
        }
      }

      // 3. ABC-CLASS SPECIFIC RULES
      if (!shouldRecommend) {
        if (abcCategory === 'A') {
          // A class: High revenue - protect volume, but optimize margin
          if (currentMargin < targetMarginA && (!competitorData || currentPrice <= competitorData.avg)) {
            recommendedPrice = costPrice / (1 - targetMarginA / 100);
            action = 'increase_price';
            reasoning = `A klases produkts ar zemu maržu (${currentMargin.toFixed(1)}%). Mērķis: ${targetMarginA}%. Palielini cenu saglabājot konkurētspēju.`;
            shouldRecommend = true;
          } else if (competitorData && competitorData.avg > currentPrice * 1.05) {
            // Competitors significantly higher, room to increase
            recommendedPrice = Math.min(currentPrice * 1.04, competitorData.avg * 0.96);
            action = 'increase_price';
            reasoning = `A klases produkts - konkurenti vidēji par €${competitorData.avg.toFixed(2)}. Iespēja palielināt cenu par ~4%.`;
            shouldRecommend = true;
          }
        } 
        else if (abcCategory === 'C') {
          // C class: Low revenue - can be more aggressive with pricing
          if (currentMargin < targetMarginC) {
            recommendedPrice = costPrice / (1 - targetMarginC / 100);
            action = 'increase_price';
            reasoning = `C klases produkts ar zemu maržu (${currentMargin.toFixed(1)}%). Šiem produktiem vajag augstāku maržu (${targetMarginC}%).`;
            shouldRecommend = true;
          } else if (competitorData && currentPrice > competitorData.max * 1.05 && salesInfo && salesInfo.units < 5) {
            // More expensive than all competitors with poor sales
            recommendedPrice = competitorData.avg;
            action = 'decrease_price';
            reasoning = `C klases produkts ar vājiem pārdošanas rezultātiem. Cena virs visiem konkurentiem. Samazini līdz tirgus vidējai.`;
            shouldRecommend = true;
          }
        }
        else if (abcCategory === 'B') {
          // B class: Balance between volume and margin
          if (currentMargin < targetMarginB - 3) {
            recommendedPrice = costPrice / (1 - targetMarginB / 100);
            action = 'increase_price';
            reasoning = `B klases produkts ar maržu ${currentMargin.toFixed(1)}% zem mērķa (${targetMarginB}%). Ieteicams cenas paaugstinājums.`;
            shouldRecommend = true;
          } else if (competitorData && currentPrice > competitorData.avg * 1.15) {
            recommendedPrice = competitorData.avg * 1.05;
            action = 'decrease_price';
            reasoning = `B klases produkts ir >15% virs konkurentu vidējā. Samazini cenu apgrozījuma stimulēšanai.`;
            shouldRecommend = true;
          }
        }
      }

      // 4. PRIVATE LABEL PRODUCTS - can sustain higher margins
      if (!shouldRecommend && product.is_private_label && currentMargin < 35) {
        recommendedPrice = costPrice / (1 - 0.35);
        action = 'increase_price';
        reasoning = `Privātā zīmola produkts var noturēt augstāku maržu (35%+). Pašreizējā marža: ${currentMargin.toFixed(1)}%.`;
        shouldRecommend = true;
      }

      // 5. MARGIN TOO HIGH CHECK - can recommend price decrease to boost volume
      if (!shouldRecommend && currentMargin > 50) {
        // Even without competitor data, very high margins might mean we could lower price to boost volume
        if (salesInfo && salesInfo.units < 50) {
          // Low sales + high margin = opportunity to reduce price
          const newMargin = 40; // Reduce to more reasonable margin
          recommendedPrice = costPrice / (1 - newMargin / 100);
          action = 'decrease_price';
          reasoning = `Ļoti augsta marža (${currentMargin.toFixed(1)}%) ar zemiem pārdošanas apjomiem (${salesInfo.units} vien.). Samazini cenu apgrozījuma stimulēšanai.`;
          shouldRecommend = true;
        } else if (competitorData && currentPrice > competitorData.max) {
          recommendedPrice = competitorData.max * 0.98;
          action = 'decrease_price';
          reasoning = `Ļoti augsta marža (${currentMargin.toFixed(1)}%) un cena virs visiem konkurentiem. Samazini, lai uzlabotu konkurētspēju.`;
          shouldRecommend = true;
        }
      }

      // 6. HIGH MARGIN OPTIMIZATION - suggest promotional pricing for high-margin products
      if (!shouldRecommend && currentMargin > 45 && abcCategory !== 'A') {
        // B and C class products with high margins could benefit from promotional activity
        if (!salesInfo || salesInfo.units < 100) {
          const promoMargin = abcCategory === 'B' ? 35 : 30;
          recommendedPrice = costPrice / (1 - promoMargin / 100);
          action = 'decrease_price';
          reasoning = `${abcCategory} klases produkts ar augstu maržu (${currentMargin.toFixed(1)}%). Ieteicama cenas samazināšana vai akcija apgrozījuma palielināšanai.`;
          shouldRecommend = true;
        }
      }

      // 7. A-CLASS VOLUME PROTECTION - ensure A products maintain competitive positioning
      if (!shouldRecommend && abcCategory === 'A' && currentMargin > 48) {
        // A class with very high margins might be leaving money on table or risking volume
        if (salesInfo && salesInfo.units > 200) {
          // High volume A-class with high margin - can consider slight reduction for market share
          recommendedPrice = currentPrice * 0.97; // 3% reduction
          action = 'decrease_price';
          reasoning = `A klases produkts ar augstu maržu (${currentMargin.toFixed(1)}%) un labu apgrozījumu. Neliela cenas samazināšana var palielināt tirgus daļu.`;
          shouldRecommend = true;
        }
      }

      // 8. GENERATE "KEEP" RECOMMENDATIONS for well-performing products
      if (!shouldRecommend && salesInfo && salesInfo.units > 150) {
        // Products with good sales and acceptable margins - confirm pricing is optimal
        if (currentMargin >= targetMargin && currentMargin <= targetMargin + 15) {
          action = 'keep_price';
          reasoning = `Optimāla cena - laba marža (${currentMargin.toFixed(1)}%) un stabili pārdošanas apjomi (${salesInfo.units} vien.). Saglabā esošo cenu.`;
          shouldRecommend = true;
        }
      }

      // Create recommendation if needed
      if (shouldRecommend && (action === 'keep_price' || Math.abs(recommendedPrice - currentPrice) > 0.05)) {
        const changePercent = ((recommendedPrice - currentPrice) / currentPrice) * 100;
        
        // Only include recommendations with meaningful change (>1%)
        if (Math.abs(changePercent) >= 1) {
          recommendations.push({
            product_id: product.id,
            tenant_id: product.tenant_id,
            current_price: currentPrice,
            current_cost_price: costPrice,
            competitor_avg_price: competitorData?.avg || null,
            recommended_price: Math.round(recommendedPrice * 100) / 100, // Round to 2 decimals
            recommended_change_percent: Math.round(changePercent * 10) / 10, // Round to 1 decimal
            reasoning: reasoning,
            abc_class: abcCategory,
            status: 'new',
          });
        }
      }
    }

    console.log(`Generated ${recommendations.length} recommendations`);

    // Clear old 'new' recommendations for this tenant and insert new ones
    const { error: deleteError } = await supabase
      .from('pricing_recommendations')
      .delete()
      .eq('tenant_id', tenant_id)
      .eq('status', 'new');

    if (deleteError) console.error('Error deleting old recommendations:', deleteError);

    if (recommendations.length > 0) {
      // Insert in batches of 100
      for (let i = 0; i < recommendations.length; i += 100) {
        const batch = recommendations.slice(i, i + 100);
        const { error: insertError } = await supabase
          .from('pricing_recommendations')
          .insert(batch);
        
        if (insertError) {
          console.error('Error inserting recommendations:', insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: recommendations.length,
        message: `Izveidotas ${recommendations.length} cenu rekomendācijas`,
      }),
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
