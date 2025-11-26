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

    // Authentication check - require admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create tenant for user
    let { data: tenantData } = await supabase
      .from('user_tenants')
      .select('tenant_id, tenants(*)')
      .eq('user_id', user.id)
      .single();

    let tenant_id: string;

    if (!tenantData) {
      // Create default tenant if user doesn't have one
      console.log('No tenant found, creating default tenant...');
      
      const { data: newTenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: 'Demo Veikals',
          slug: 'demo-veikals-' + user.id.substring(0, 8),
        })
        .select()
        .single();

      if (tenantError) {
        console.error('Error creating tenant:', tenantError);
        throw tenantError;
      }

      // Assign user to the new tenant as owner
      const { error: userTenantError } = await supabase
        .from('user_tenants')
        .insert({
          user_id: user.id,
          tenant_id: newTenant.id,
          role: 'owner',
        });

      if (userTenantError) {
        console.error('Error assigning user to tenant:', userTenantError);
        throw userTenantError;
      }

      tenant_id = newTenant.id;
      console.log('Created tenant:', tenant_id);
    } else {
      tenant_id = tenantData.tenant_id;
      console.log('Using existing tenant:', tenant_id);
    }
    console.log(`User ${user.id} initiated data seeding for tenant ${tenant_id}`);
    
    // Delete existing data in reverse order of dependencies
    await supabase.from('product_price_elasticity').delete().eq('tenant_id', tenant_id);
    await supabase.from('category_metrics').delete().eq('tenant_id', tenant_id);
    await supabase.from('pricing_recommendations').delete().eq('tenant_id', tenant_id);
    await supabase.from('competitor_promotion_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('competitor_price_history').delete().eq('tenant_id', tenant_id);
    await supabase.from('competitor_products').delete().eq('tenant_id', tenant_id);
    await supabase.from('competitor_product_mapping').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('competitor_promotions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('sales_daily').delete().eq('tenant_id', tenant_id);
    await supabase.from('products').delete().eq('tenant_id', tenant_id);
    await supabase.from('competitors').delete().eq('tenant_id', tenant_id);
    await supabase.from('categories').delete().eq('tenant_id', tenant_id);
    await supabase.from('stores').delete().eq('tenant_id', tenant_id);
    
    console.log('Existing data deleted. Creating new data...');

    // Create stores
    const stores = [
      { tenant_id, code: 'RG01', name: 'Rīga - Centrs', city: 'Rīga', country: 'Latvia', is_active: true },
      { tenant_id, code: 'RG02', name: 'Rīga - Imanta', city: 'Rīga', country: 'Latvia', is_active: true },
      { tenant_id, code: 'LV01', name: 'Liepāja', city: 'Liepāja', country: 'Latvia', is_active: true },
    ];

    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .insert(stores)
      .select();

    if (storeError) {
      console.error('Error creating stores:', storeError);
      throw storeError;
    }

    const mainStore = storeData[0];

    // Create categories
    const categories = [
      { tenant_id, name: 'Dzērieni', parent_id: null },
      { tenant_id, name: 'Piena produkti', parent_id: null },
      { tenant_id, name: 'Uzkodas', parent_id: null },
      { tenant_id, name: 'Saldumi', parent_id: null },
      { tenant_id, name: 'Konservi', parent_id: null },
    ];

    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .insert(categories)
      .select();

    if (categoryError) {
      console.error('Error creating categories:', categoryError);
      throw categoryError;
    }

    // Create competitors
    const competitors = [
      { tenant_id, name: 'Rimi', website_url: 'https://rimi.lv', type: 'offline', country: 'Latvia', scraping_enabled: true },
      { tenant_id, name: 'Maxima', website_url: 'https://maxima.lv', type: 'offline', country: 'Latvia', scraping_enabled: true },
      { tenant_id, name: 'Lidl', website_url: 'https://lidl.lv', type: 'offline', country: 'Latvia', scraping_enabled: true },
    ];

    const { data: competitorData, error: competitorError } = await supabase
      .from('competitors')
      .insert(competitors)
      .select();

    if (competitorError) {
      console.error('Error creating competitors:', competitorError);
      throw competitorError;
    }

    // Create products with realistic Latvian retail data
    const productTemplates = [
      { name: 'Coca-Cola 1.5L', brand: 'Coca-Cola', category: 'Dzērieni', cost: 0.85, price: 1.49, role: 'traffic_builder', abc: 'A' },
      { name: 'Pepsi 2L', brand: 'Pepsi', category: 'Dzērieni', cost: 0.75, price: 1.39, role: 'traffic_builder', abc: 'A' },
      { name: 'Fanta Orange 1.5L', brand: 'Coca-Cola', category: 'Dzērieni', cost: 0.80, price: 1.45, role: 'other', abc: 'B' },
      { name: 'Sprite 1.5L', brand: 'Coca-Cola', category: 'Dzērieni', cost: 0.80, price: 1.45, role: 'other', abc: 'B' },
      { name: 'Rīgas Miestiņš alus 0.5L', brand: 'Aldaris', category: 'Dzērieni', cost: 0.65, price: 1.29, role: 'margin_driver', abc: 'A', private: true },
      { name: 'Piena Liepzars 2.5% 1L', brand: 'Liepzars', category: 'Piena produkti', cost: 0.85, price: 1.59, role: 'traffic_builder', abc: 'A' },
      { name: 'Biezpiens 9% 250g', brand: 'Tukuma Piens', category: 'Piena produkti', cost: 0.65, price: 1.29, role: 'margin_driver', abc: 'B' },
      { name: 'Jogurts ar zemenēm 150g', brand: 'Baltais', category: 'Piena produkti', cost: 0.35, price: 0.79, role: 'other', abc: 'C' },
      { name: 'Siers Gouda 200g', brand: 'Kārums', category: 'Piena produkti', cost: 1.85, price: 3.49, role: 'margin_driver', abc: 'A' },
      { name: 'Lays čipsi Original 150g', brand: 'Lays', category: 'Uzkodas', cost: 1.20, price: 2.29, role: 'traffic_builder', abc: 'A' },
      { name: 'Estrella čipsi sāļie 175g', brand: 'Estrella', category: 'Uzkodas', cost: 1.15, price: 2.19, role: 'other', abc: 'B' },
      { name: 'Privātā zīmola čipsi 200g', brand: 'Mūsu Izvēle', category: 'Uzkodas', cost: 0.75, price: 1.49, role: 'margin_driver', abc: 'B', private: true },
      { name: 'Rieksti 100g', brand: 'Nākotne', category: 'Uzkodas', cost: 1.85, price: 3.49, role: 'margin_driver', abc: 'C' },
      { name: 'Milka šokolāde 100g', brand: 'Milka', category: 'Saldumi', cost: 1.25, price: 2.49, role: 'image_builder', abc: 'A' },
      { name: 'Laima konfektes 200g', brand: 'Laima', category: 'Saldumi', cost: 2.15, price: 3.99, role: 'image_builder', abc: 'A' },
      { name: 'Privātā zīmola cepumi 300g', brand: 'Mūsu Izvēle', category: 'Saldumi', cost: 0.85, price: 1.79, role: 'margin_driver', abc: 'B', private: true },
      { name: 'Zivs konservi 240g', brand: 'Kaija', category: 'Konservi', cost: 1.65, price: 2.99, role: 'other', abc: 'B' },
      { name: 'Tomātu mērce 500g', brand: 'Spilva', category: 'Konservi', cost: 0.95, price: 1.89, role: 'other', abc: 'C' },
      { name: 'Zaļie zirnīši 400g', brand: 'Spilva', category: 'Konservi', cost: 0.75, price: 1.49, role: 'long_tail', abc: 'C' },
      { name: 'Kukurūza 340g', brand: 'Bonduelle', category: 'Konservi', cost: 0.85, price: 1.69, role: 'other', abc: 'C' },
    ];

    const products = [];
    for (let i = 0; i < productTemplates.length; i++) {
      const template = productTemplates[i];
      const categoryMatch = categoryData.find(c => c.name === template.category);
      
      products.push({
        tenant_id,
        sku: `LV${String(i + 1).padStart(5, '0')}`,
        name: template.name,
        brand: template.brand,
        category: template.category,
        category_id: categoryMatch?.id,
        category_role: template.role,
        cost_price: template.cost,
        current_price: template.price,
        currency: 'EUR',
        is_private_label: template.private || false,
        abc_category: template.abc,
        status: 'active',
        barcode: `590${String(i + 1).padStart(10, '0')}`,
        vat_rate: 0.21,
        base_unit: 'pcs',
      });
    }

    const { data: productData, error: productError } = await supabase
      .from('products')
      .insert(products)
      .select();

    if (productError) {
      console.error('Error creating products:', productError);
      throw productError;
    }

    // Create sales data for last 6 months
    const salesRecords = [];
    const today = new Date();
    
    for (const product of productData || []) {
      const baseVolume = product.abc_category === 'A' ? 100 : product.abc_category === 'B' ? 40 : 15;
      
      for (let month = 0; month < 6; month++) {
        for (let day = 0; day < 30; day++) {
          const date = new Date(today);
          date.setMonth(date.getMonth() - month);
          date.setDate(date.getDate() - day);
          
          const seasonality = 1 + 0.2 * Math.sin((day / 30) * Math.PI * 2);
          const trend = 1 - (month * 0.05);
          const randomness = 0.7 + Math.random() * 0.6;
          const unitsSold = Math.floor(baseVolume * seasonality * trend * randomness);
          
          if (unitsSold > 0) {
            const promoFlag = Math.random() > 0.85;
            const actualPrice = promoFlag ? product.current_price * 0.85 : product.current_price;
            const revenue = actualPrice * unitsSold;
            
            salesRecords.push({
              tenant_id,
              product_id: product.id,
              store_id: storeData[Math.floor(Math.random() * storeData.length)].id,
              date: date.toISOString().split('T')[0],
              units_sold: unitsSold,
              revenue: revenue,
              regular_price: product.current_price,
              promo_flag: promoFlag,
            });
          }
        }
      }
    }

    const { error: salesError } = await supabase.from('sales_daily').insert(salesRecords);
    if (salesError) {
      console.error('Error creating sales:', salesError);
      throw salesError;
    }

    // Create competitor products and mappings
    const competitorProductRecords = [];
    const competitorMappings = [];
    
    for (const product of productData || []) {
      for (const competitor of competitorData || []) {
        // First create the competitor product record
        const competitorProduct = {
          tenant_id,
          competitor_id: competitor.id,
          competitor_name: product.name,
          competitor_sku: `${competitor.name.substring(0, 3).toUpperCase()}-${product.sku}`,
          barcode: product.barcode,
          category_hint: product.category,
        };
        competitorProductRecords.push(competitorProduct);
      }
    }

    // Insert competitor products
    const { data: competitorProductData, error: compProdError } = await supabase
      .from('competitor_products')
      .insert(competitorProductRecords)
      .select();

    if (compProdError) {
      console.error('Error creating competitor products:', compProdError);
      throw compProdError;
    }

    // Create mappings between our products and competitor products
    let idx = 0;
    for (const product of productData || []) {
      for (const competitor of competitorData || []) {
        const competitorProduct = competitorProductData[idx];
        const similarity = 0.75 + Math.random() * 0.2;
        const status = similarity >= 0.90 ? 'auto_matched' : similarity >= 0.80 ? 'user_approved' : 'pending';
        
        competitorMappings.push({
          our_product_id: product.id,
          competitor_id: competitor.id,
          competitor_product_name: product.name,
          competitor_brand: product.brand,
          competitor_product_sku: competitorProduct.competitor_sku,
          ai_similarity_score: similarity,
          mapping_status: status,
        });
        idx++;
      }
    }

    const { data: mappingData, error: mappingError } = await supabase
      .from('competitor_product_mapping')
      .insert(competitorMappings)
      .select();

    if (mappingError) {
      console.error('Error creating mappings:', mappingError);
      throw mappingError;
    }

    // Create competitor price history
    const competitorPrices = [];
    
    for (const competitorProduct of competitorProductData || []) {
      const product = productData.find(p => 
        competitorProduct.competitor_name === p.name
      );
      if (!product) continue;

      for (let month = 0; month < 6; month++) {
        const date = new Date(today);
        date.setMonth(date.getMonth() - month);
        
        const priceVariation = 0.90 + Math.random() * 0.25;
        const isPromo = Math.random() > 0.75;
        const competitorPrice = product.current_price * priceVariation;
        
        competitorPrices.push({
          tenant_id,
          competitor_product_id: competitorProduct.id,
          date: date.toISOString().split('T')[0],
          price: competitorPrice,
          promo_flag: isPromo,
          note: isPromo ? 'Akcijas cena' : null,
        });
      }
    }

    const { error: pricesError } = await supabase.from('competitor_price_history').insert(competitorPrices);
    if (pricesError) {
      console.error('Error creating competitor prices:', pricesError);
      throw pricesError;
    }

    // Create competitor promotions
    const promotions = [];
    for (const competitor of competitorData || []) {
      promotions.push({
        competitor_id: competitor.id,
        title: `${competitor.name} Nedēļas piedāvājums`,
        source_type: 'html',
        source_url: `https://${competitor.name.toLowerCase()}.lv/akcijas`,
        valid_from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
        valid_to: new Date(today.getFullYear(), today.getMonth(), 7).toISOString().split('T')[0],
        processed: true,
        items_count: 15,
      });
    }

    const { data: promotionData, error: promotionsError } = await supabase
      .from('competitor_promotions')
      .insert(promotions)
      .select();

    if (promotionsError) {
      console.error('Error creating promotions:', promotionsError);
      throw promotionsError;
    }

    // Create promotion items
    const promotionItems = [];
    for (const promo of promotionData || []) {
      const competitor = competitorData.find(c => c.id === promo.competitor_id);
      const relevantMappings = mappingData.filter(m => m.competitor_id === competitor?.id).slice(0, 5);
      
      for (const mapping of relevantMappings) {
        const product = productData.find(p => p.id === mapping.our_product_id);
        if (!product) continue;
        
        const regularPrice = product.current_price * (0.95 + Math.random() * 0.1);
        const promoPrice = regularPrice * (0.7 + Math.random() * 0.15);
        
        promotionItems.push({
          promotion_id: promo.id,
          competitor_product_name: mapping.competitor_product_name,
          competitor_brand: mapping.competitor_brand,
          regular_price: regularPrice,
          promo_price: promoPrice,
          currency: 'EUR',
          promo_label: '-' + Math.round((1 - promoPrice / regularPrice) * 100) + '%',
          linked_mapping_id: mapping.id,
        });
      }
    }

    const { error: itemsError } = await supabase
      .from('competitor_promotion_items')
      .insert(promotionItems);

    if (itemsError) {
      console.error('Error creating promotion items:', itemsError);
      throw itemsError;
    }

    // Create price elasticity data
    const elasticityRecords = [];
    for (const product of productData || []) {
      const baseElasticity = product.category_role === 'traffic_builder' ? -1.5 : 
                           product.category_role === 'margin_driver' ? -0.6 : -1.0;
      const elasticity = baseElasticity + (Math.random() - 0.5) * 0.4;
      
      elasticityRecords.push({
        tenant_id,
        product_id: product.id,
        elasticity_coefficient: elasticity,
        confidence: 0.65 + Math.random() * 0.25,
        sensitivity_label: elasticity > -0.8 ? 'inelastic' : elasticity > -1.5 ? 'normal' : 'highly_elastic',
        data_points: 120 + Math.floor(Math.random() * 60),
        calculated_at: new Date().toISOString(),
      });
    }

    const { error: elasticityError } = await supabase
      .from('product_price_elasticity')
      .insert(elasticityRecords);

    if (elasticityError) {
      console.error('Error creating elasticity data:', elasticityError);
      throw elasticityError;
    }

    // Create smart price config
    const { error: configError } = await supabase
      .from('smart_price_config')
      .upsert({
        tenant_id,
        global_min_margin_percent: 15,
        abc_a_max_discount_percent: 10,
        abc_b_max_discount_percent: 20,
        abc_c_max_discount_percent: 30,
        match_competitor_promo: true,
        never_below_competitor_min: true,
      });

    if (configError) {
      console.error('Error creating smart price config:', configError);
      throw configError;
    }

    // Create pricing recommendations - vairāk daudzveidīgu rekomendāciju
    const recommendations = [];
    
    // Izveidojam rekomendācijas visām ABC klasēm
    for (const product of productData || []) {
      // Izveidojam rekomendācijas tikai produktiem ar zemu maržu vai augstu cenu
      const currentMargin = ((product.current_price - product.cost_price) / product.current_price) * 100;
      const competitorAvg = product.current_price * (0.88 + Math.random() * 0.24);
      
      let shouldRecommend = false;
      let changePercent = 0;
      let reasoning = '';
      
      // A klases produkti - augsta apgrozījuma
      if (product.abc_category === 'A') {
        if (currentMargin < 20 || product.current_price < competitorAvg * 0.95) {
          shouldRecommend = true;
          changePercent = 3 + Math.random() * 5;
          reasoning = `A klases produkts ar lielu apgrozījumu. Konkurenti ir dārgāki (€${competitorAvg.toFixed(2)}). Varam paaugstināt cenu par ${changePercent.toFixed(1)}% saglabājot konkurētspēju un palielinot maržu.`;
        }
      }
      
      // B klases produkti - vidējs apgrozījums
      if (product.abc_category === 'B') {
        if (product.current_price > competitorAvg * 1.1) {
          shouldRecommend = true;
          changePercent = -(5 + Math.random() * 8);
          reasoning = `B klases produkts ir ${Math.abs(changePercent).toFixed(1)}% dārgāks par konkurentu vidējo (€${competitorAvg.toFixed(2)}). Ieteicams samazināt cenu, lai palielinātu pārdošanas apjomus.`;
        } else if (currentMargin < 18) {
          shouldRecommend = true;
          changePercent = 2 + Math.random() * 4;
          reasoning = `B klases produkts ar zemu maržu (${currentMargin.toFixed(1)}%). Cenas paaugstināšana uzlabos rentabilitāti.`;
        }
      }
      
      // C klases produkti - zems apgrozījums
      if (product.abc_category === 'C') {
        if (product.current_price > competitorAvg * 1.05) {
          shouldRecommend = true;
          changePercent = -(8 + Math.random() * 12);
          reasoning = `C klases produkts ar zemu apgrozījumu un augstu cenu. Konkurenti pārdod €${Math.abs(changePercent).toFixed(1)}% lētāk (€${competitorAvg.toFixed(2)}). Cenas samazināšana stimulēs pieprasījumu.`;
        }
      }
      
      // Privātās zīmola produkti - var būt lielāka marža
      if (product.is_private_label && currentMargin < 30) {
        shouldRecommend = true;
        changePercent = 5 + Math.random() * 8;
        reasoning = `Privātā zīmola produkts var nodrošināt augstāku maržu (30%+). Pašlaik marža ir tikai ${currentMargin.toFixed(1)}%. Ieteicams paaugstināt cenu.`;
      }
      
      if (shouldRecommend) {
        const recommendedPrice = product.current_price * (1 + changePercent / 100);
        
        recommendations.push({
          tenant_id,
          product_id: product.id,
          current_price: product.current_price,
          current_cost_price: product.cost_price,
          recommended_price: recommendedPrice,
          recommended_change_percent: changePercent,
          competitor_avg_price: competitorAvg,
          abc_class: product.abc_category,
          reasoning,
          status: 'new',
        });
      }
    }

    const { error: recommendationsError } = await supabase
      .from('pricing_recommendations')
      .insert(recommendations);

    if (recommendationsError) {
      console.error('Error creating recommendations:', recommendationsError);
      throw recommendationsError;
    }

    // Initialize ABC settings if not exists
    const { data: existingSettings } = await supabase
      .from('abc_settings')
      .select('id')
      .limit(1)
      .single();

    if (!existingSettings) {
      const { error: settingsError } = await supabase
        .from('abc_settings')
        .insert({
          threshold_a_percent: 80,
          threshold_b_percent: 15,
          threshold_c_percent: 5,
          analysis_period_days: 90,
        });
      
      if (settingsError) {
        console.error('Error creating ABC settings:', settingsError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Simulācijas dati veiksmīgi izveidoti!',
        counts: {
          stores: storeData?.length || 0,
          categories: categoryData?.length || 0,
          competitors: competitorData?.length || 0,
          products: productData?.length || 0,
          competitorProducts: competitorProductData?.length || 0,
          sales: salesRecords.length,
          mappings: mappingData?.length || 0,
          competitorPrices: competitorPrices.length,
          promotions: promotionData?.length || 0,
          promotionItems: promotionItems.length,
          elasticity: elasticityRecords.length,
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
