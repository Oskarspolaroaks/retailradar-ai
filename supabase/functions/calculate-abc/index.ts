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
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roles || roles.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting ABC calculation...');

    // Get ABC settings, create default if doesn't exist
    let { data: settings, error: settingsError } = await supabase
      .from('abc_settings')
      .select('*')
      .single();

    if (settingsError || !settings) {
      console.log('No ABC settings found, creating defaults...');
      
      // Create default settings
      const { data: newSettings, error: insertError } = await supabase
        .from('abc_settings')
        .insert({
          analysis_period_days: 90,
          threshold_a_percent: 80,
          threshold_b_percent: 15,
          threshold_c_percent: 5,
        })
        .select()
        .single();

      if (insertError || !newSettings) {
        console.error('Failed to create default ABC settings:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to initialize ABC settings' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      settings = newSettings;
    }

    const { analysis_period_days, threshold_a_percent, threshold_b_percent } = settings;

    // Calculate the date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - analysis_period_days);

    console.log(`Analyzing sales from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get sales data aggregated by product
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('product_id, net_revenue, quantity_sold')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    if (salesError) {
      console.error('Sales query error:', salesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sales data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate revenue by product
    const productRevenue = new Map<string, number>();
    
    salesData?.forEach((sale) => {
      const current = productRevenue.get(sale.product_id) || 0;
      productRevenue.set(sale.product_id, current + Number(sale.net_revenue));
    });

    // Sort products by revenue (descending)
    const sortedProducts = Array.from(productRevenue.entries())
      .sort((a, b) => b[1] - a[1]);

    // Calculate total revenue
    const totalRevenue = sortedProducts.reduce((sum, [, revenue]) => sum + revenue, 0);

    console.log(`Total revenue: ${totalRevenue}, Products: ${sortedProducts.length}`);

    // Calculate cumulative percentages and assign categories
    let cumulativeRevenue = 0;
    const productCategories = new Map<string, string>();

    sortedProducts.forEach(([productId, revenue]) => {
      cumulativeRevenue += revenue;
      const cumulativePercent = (cumulativeRevenue / totalRevenue) * 100;

      let category: string;
      if (cumulativePercent <= threshold_a_percent) {
        category = 'A';
      } else if (cumulativePercent <= threshold_a_percent + threshold_b_percent) {
        category = 'B';
      } else {
        category = 'C';
      }

      productCategories.set(productId, category);
    });

    // Get all products and update those without sales data to category C
    const { data: allProducts } = await supabase
      .from('products')
      .select('id');

    allProducts?.forEach((product) => {
      if (!productCategories.has(product.id)) {
        productCategories.set(product.id, 'C');
      }
    });

    console.log(`Updating ${productCategories.size} products...`);

    // Update products in batches
    const updates = Array.from(productCategories.entries()).map(([productId, category]) => ({
      id: productId,
      abc_category: category,
    }));

    // Batch update (Supabase can handle large upserts)
    const { error: updateError } = await supabase
      .from('products')
      .upsert(updates, { onConflict: 'id' });

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update product categories' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_calculated_at timestamp
    await supabase
      .from('abc_settings')
      .update({ last_calculated_at: new Date().toISOString() })
      .eq('id', settings.id);

    console.log('ABC calculation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'ABC categories calculated successfully',
        stats: {
          total_products: productCategories.size,
          a_category: Array.from(productCategories.values()).filter(c => c === 'A').length,
          b_category: Array.from(productCategories.values()).filter(c => c === 'B').length,
          c_category: Array.from(productCategories.values()).filter(c => c === 'C').length,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
