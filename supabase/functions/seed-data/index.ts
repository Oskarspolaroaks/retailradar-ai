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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Deleting existing data...');
    
    // Delete existing data in reverse order of dependencies
    await supabase.from('price_recommendations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('competitor_prices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('competitor_product_mapping').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('competitor_promotions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('competitors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('Existing data deleted. Creating new data...');

    // Create competitors
    const competitors = [
      { name: 'MarketLeader Inc', website_url: 'https://marketleader.com', type: 'online', country: 'US' },
      { name: 'ValueMart', website_url: 'https://valuemart.com', type: 'offline', country: 'US' },
      { name: 'PriceKing', website_url: 'https://priceking.com', type: 'online', country: 'US' },
    ];

    const { data: competitorData, error: competitorError } = await supabase
      .from('competitors')
      .insert(competitors)
      .select();

    if (competitorError) {
      console.error('Error creating competitors:', competitorError);
    }

    // Create products
    const categories = ['Electronics', 'Home & Garden', 'Sports', 'Fashion'];
    const products = [];

    for (let i = 1; i <= 20; i++) {
      const category = categories[i % categories.length];
      const costPrice = 20 + Math.random() * 80;
      const markup = 1.2 + Math.random() * 0.5;
      
      products.push({
        sku: `SKU${String(i).padStart(4, '0')}`,
        name: `Product ${i} - ${category}`,
        brand: i % 3 === 0 ? 'OwnBrand' : 'BrandName',
        category,
        subcategory: `Sub${i % 3}`,
        cost_price: costPrice,
        current_price: costPrice * markup,
        currency: 'USD',
        is_private_label: i % 4 === 0,
        status: 'active',
        barcode: `978${String(i).padStart(10, '0')}`,
        vat_rate: 0.2,
      });
    }

    const { data: productData, error: productError } = await supabase
      .from('products')
      .insert(products)
      .select();

    if (productError) {
      console.error('Error creating products:', productError);
    }

    // Create sales data for last 6 months
    const salesRecords = [];
    const today = new Date();
    
    for (const product of productData || []) {
      for (let month = 0; month < 6; month++) {
        for (let day = 0; day < 30; day += 3) {
          const date = new Date(today);
          date.setMonth(date.getMonth() - month);
          date.setDate(date.getDate() - day);
          
          const quantitySold = Math.floor(Math.random() * 50) + 5;
          const netRevenue = product.current_price * quantitySold * (0.9 + Math.random() * 0.1);
          
          salesRecords.push({
            product_id: product.id,
            date: date.toISOString().split('T')[0],
            quantity_sold: quantitySold,
            net_revenue: netRevenue,
            channel: Math.random() > 0.5 ? 'online' : 'store',
            promotion_flag: Math.random() > 0.8,
            discounts_applied: Math.random() > 0.8 ? netRevenue * 0.1 : 0,
          });
        }
      }
    }

    const { error: salesError } = await supabase.from('sales').insert(salesRecords);
    if (salesError) {
      console.error('Error creating sales:', salesError);
    }

    // Create competitor prices
    const competitorPrices = [];
    
    for (const product of productData || []) {
      for (const competitor of competitorData || []) {
        // Create mapping
        const { data: mapping, error: mappingError } = await supabase
          .from('competitor_product_mapping')
          .insert({
            product_id: product.id,
            competitor_id: competitor.id,
            competitor_sku: `COMP-${product.sku}`,
          })
          .select()
          .single();

        if (mappingError) {
          console.error('Error creating mapping:', mappingError);
          continue;
        }

        if (mapping) {
          // Add price history
          for (let month = 0; month < 6; month++) {
            const date = new Date(today);
            date.setMonth(date.getMonth() - month);
            
            const priceVariation = 0.9 + Math.random() * 0.3;
            competitorPrices.push({
              mapping_id: mapping.id,
              date: date.toISOString().split('T')[0],
              competitor_price: product.current_price * priceVariation,
              currency: 'USD',
              in_stock: Math.random() > 0.1,
              is_on_promo: Math.random() > 0.7,
              source: 'seed_data',
            });
          }
        }
      }
    }

    const { error: pricesError } = await supabase.from('competitor_prices').insert(competitorPrices);
    if (pricesError) {
      console.error('Error creating competitor prices:', pricesError);
    }

    // Create competitor promotions
    const promotions = [];
    for (const competitor of competitorData || []) {
      promotions.push({
        competitor_id: competitor.id,
        promotion_name: 'Black Friday Sale',
        slogan: 'Up to 50% off on selected items!',
        description: 'Major discount event across multiple categories',
        product_category: 'Electronics',
        discount_percent: 30 + Math.random() * 20,
        start_date: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
        end_date: new Date(today.getFullYear(), today.getMonth(), 7).toISOString().split('T')[0],
        is_active: true,
      });
    }

    const { error: promotionsError } = await supabase.from('competitor_promotions').insert(promotions);
    if (promotionsError) {
      console.error('Error creating promotions:', promotionsError);
    }

    // Create price recommendations
    const recommendations = [];
    for (let i = 0; i < 5; i++) {
      const product = productData?.[i];
      if (product) {
        const currentMargin = ((product.current_price - product.cost_price) / product.current_price) * 100;
        const recommendedPrice = product.current_price * (1 + (Math.random() - 0.5) * 0.2);
        const expectedMargin = ((recommendedPrice - product.cost_price) / recommendedPrice) * 100;
        
        recommendations.push({
          product_id: product.id,
          current_price: product.current_price,
          recommended_price: recommendedPrice,
          expected_margin_percent: expectedMargin,
          recommendation_type: recommendedPrice > product.current_price ? 'increase_price' : 'decrease_price',
          explanation: `Based on competitor analysis and sales data, ${recommendedPrice > product.current_price ? 'increasing' : 'decreasing'} price could improve margins.`,
          status: 'pending',
        });
      }
    }

    const { error: recommendationsError } = await supabase.from('price_recommendations').insert(recommendations);
    if (recommendationsError) {
      console.error('Error creating recommendations:', recommendationsError);
    }

    // Initialize ABC settings if not exists
    const { error: settingsError } = await supabase.from('abc_settings').upsert({
      threshold_a_percent: 80,
      threshold_b_percent: 15,
      threshold_c_percent: 5,
      analysis_period_days: 90,
    });
    if (settingsError) {
      console.error('Error creating ABC settings:', settingsError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Demo data seeded successfully',
        counts: {
          competitors: competitorData?.length || 0,
          products: productData?.length || 0,
          sales: salesRecords.length,
          competitorPrices: competitorPrices.length,
          promotions: promotions.length,
          recommendations: recommendations.length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error seeding data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
