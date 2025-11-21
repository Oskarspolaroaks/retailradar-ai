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
    console.log('Starting scheduled competitor scraping...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all active competitors with website URLs
    const { data: competitors, error: fetchError } = await supabase
      .from('competitors')
      .select('id, name, website_url')
      .not('website_url', 'is', null)
      .neq('website_url', '');

    if (fetchError) {
      console.error('Error fetching competitors:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${competitors?.length || 0} competitors to scrape`);

    const results = {
      total: competitors?.length || 0,
      successful: 0,
      failed: 0,
      details: [] as any[],
    };

    // Scrape each competitor
    for (const competitor of competitors || []) {
      try {
        console.log(`Scraping ${competitor.name} at ${competitor.website_url}`);

        // Call the scrape-competitor function
        const { data: scrapeResult, error: scrapeError } = await supabase.functions.invoke(
          'scrape-competitor',
          {
            body: {
              url: competitor.website_url,
              competitor_id: competitor.id,
            },
          }
        );

        if (scrapeError) {
          console.error(`Error scraping ${competitor.name}:`, scrapeError);
          results.failed++;
          results.details.push({
            competitor: competitor.name,
            status: 'failed',
            error: scrapeError.message,
          });
        } else {
          console.log(`Successfully scraped ${competitor.name}: ${scrapeResult?.products?.length || 0} products found`);
          results.successful++;
          results.details.push({
            competitor: competitor.name,
            status: 'success',
            products_found: scrapeResult?.products?.length || 0,
          });
        }

        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (err) {
        console.error(`Exception scraping ${competitor.name}:`, err);
        results.failed++;
        results.details.push({
          competitor: competitor.name,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Generate alerts after scraping completes
    console.log('Generating alerts based on new competitor data...');
    try {
      await supabase.functions.invoke('generate-alerts');
    } catch (alertErr) {
      console.error('Error generating alerts:', alertErr);
    }

    console.log('Scheduled scraping completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scheduled scraping error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
