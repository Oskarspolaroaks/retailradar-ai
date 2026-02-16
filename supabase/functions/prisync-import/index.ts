import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMO_THRESHOLD = 0.20;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { rows, tenantId } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No rows provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const result = {
      totalProducts: 0,
      matchedProducts: 0,
      unmatchedSkus: [] as string[],
      pricesUpdated: 0,
      promoDetected: 0,
      competitorPricesImported: 0,
      priceHistoryRecords: 0,
      errors: [] as string[],
    };

    // --- Parse Prisync rows ---
    const parsePrice = (val: any): number | null => {
      if (val === undefined || val === null || val === '-' || val === '' || String(val).trim() === '-') return null;
      const num = Number(val);
      return isNaN(num) || num <= 0 ? null : num;
    };

    const COMP_COLUMNS: Record<string, string> = {
      'barbora.lv - Price': 'barbora.lv',
      'rimi.lv - Price': 'rimi.lv',
      'alkoutlet.lv - Price': 'alkoutlet.lv',
      'superalko.lv - Price': 'superalko.lv',
      'vynoteka.lv - Price': 'vynoteka.lv',
    };

    interface ParsedProduct {
      sku: string;
      name: string;
      barcode: string | null;
      brand: string | null;
      category: string | null;
      myPrice: number | null;
      competitors: Record<string, number>;
    }

    const parsed: ParsedProduct[] = [];
    for (const row of rows) {
      const sku = String(row['Product Code'] || '').trim();
      if (!sku || sku === '-') continue;

      const comps: Record<string, number> = {};
      for (const [col, domain] of Object.entries(COMP_COLUMNS)) {
        const p = parsePrice(row[col]);
        if (p) comps[domain] = p;
      }

      parsed.push({
        sku,
        name: String(row['Product Name'] || '').trim(),
        barcode: row['Barcode'] && String(row['Barcode']).trim() !== '-' ? String(row['Barcode']).trim() : null,
        brand: row['Brand'] && String(row['Brand']).trim() !== '-' ? String(row['Brand']).trim() : null,
        category: row['Category'] && String(row['Category']).trim() !== '-' ? String(row['Category']).trim() : null,
        myPrice: parsePrice(row['My Price']),
        competitors: comps,
      });
    }
    result.totalProducts = parsed.length;
    console.log(`[Prisync] Parsed ${parsed.length} products`);

    // --- Fetch our products by SKU ---
    const skus = parsed.map(p => p.sku);
    const { data: ourProducts } = await supabase
      .from('products')
      .select('id, sku, name, current_price, cost_price')
      .in('sku', skus);
    const skuMap = new Map((ourProducts || []).map(p => [p.sku, p]));
    console.log(`[Prisync] Matched ${ourProducts?.length || 0} of ${skus.length} SKUs`);

    // --- Fetch competitors ---
    const { data: competitors } = await supabase.from('competitors').select('id, name, website_url');
    const domainToId = new Map<string, string>();
    competitors?.forEach(c => {
      const d = c.website_url?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') || '';
      if (d) domainToId.set(d, c.id);
    });

    // --- Fetch existing competitor_products ---
    const { data: existingCp } = await supabase
      .from('competitor_products')
      .select('id, competitor_id, competitor_sku')
      .eq('tenant_id', tenantId);
    const cpLookup = new Map<string, string>();
    existingCp?.forEach(cp => cpLookup.set(`${cp.competitor_id}|${cp.competitor_sku}`, cp.id));

    // --- Fetch existing mappings ---
    const { data: existingMappings } = await supabase
      .from('competitor_product_mapping')
      .select('id, our_product_id, competitor_id');
    const mappingSet = new Set<string>();
    existingMappings?.forEach(m => mappingSet.add(`${m.our_product_id}|${m.competitor_id}`));

    // --- Fetch existing prices for today ---
    const { data: existingPrices } = await supabase
      .from('competitor_price_history')
      .select('id, competitor_product_id, price')
      .eq('date', today);
    const priceLookup = new Map<string, { id: string; price: number }>();
    existingPrices?.forEach(p => priceLookup.set(p.competitor_product_id, { id: p.id, price: Number(p.price) }));

    // --- Process S&W prices + promo detection ---
    const priceHistoryInserts: any[] = [];

    for (const pp of parsed) {
      const our = skuMap.get(pp.sku);
      if (!our) {
        result.unmatchedSkus.push(pp.sku);
        continue;
      }
      result.matchedProducts++;

      if (pp.myPrice !== null) {
        const oldPrice = Number(our.current_price);
        const newPrice = pp.myPrice;
        const diff = Math.abs(oldPrice - newPrice);

        if (diff >= 0.005) {
          const dropPct = oldPrice > 0 ? (oldPrice - newPrice) / oldPrice : 0;
          const isPromo = dropPct > PROMO_THRESHOLD && oldPrice > 0;

          if (isPromo) {
            console.log(`[Prisync] PROMO: ${pp.name} — €${oldPrice} → €${newPrice} (-${(dropPct * 100).toFixed(0)}%)`);
            result.promoDetected++;
            priceHistoryInserts.push({
              tenant_id: tenantId,
              product_id: our.id,
              valid_from: today,
              regular_price: oldPrice,
              promo_price: newPrice,
              cost_price: Number(our.cost_price) || null,
            });
          } else {
            const { error } = await supabase
              .from('products')
              .update({ current_price: newPrice })
              .eq('id', our.id);
            if (error) {
              result.errors.push(`Price update ${pp.sku}: ${error.message}`);
            } else {
              result.pricesUpdated++;
              priceHistoryInserts.push({
                tenant_id: tenantId,
                product_id: our.id,
                valid_from: today,
                regular_price: newPrice,
                cost_price: Number(our.cost_price) || null,
              });
            }
          }
        }
      }
    }

    // Batch insert price_history
    if (priceHistoryInserts.length > 0) {
      // Close old open records
      const productIds = priceHistoryInserts.map(p => p.product_id);
      await supabase
        .from('price_history')
        .update({ valid_to: today })
        .in('product_id', productIds)
        .is('valid_to', null);

      const { error } = await supabase.from('price_history').insert(priceHistoryInserts);
      if (error) {
        result.errors.push(`price_history batch: ${error.message}`);
      } else {
        result.priceHistoryRecords = priceHistoryInserts.length;
      }
    }

    // --- Batch competitor products ---
    const newCps: any[] = [];
    const newCpKeys = new Set<string>();
    const compDataBatch: { sku: string; ourId: string; domain: string; price: number; compId: string; name: string; barcode: string | null; brand: string | null; category: string | null }[] = [];

    for (const pp of parsed) {
      const our = skuMap.get(pp.sku);
      if (!our) continue;

      for (const [domain, price] of Object.entries(pp.competitors)) {
        const compId = domainToId.get(domain);
        if (!compId) continue;

        compDataBatch.push({ sku: pp.sku, ourId: our.id, domain, price, compId, name: pp.name, barcode: pp.barcode, brand: pp.brand, category: pp.category });

        const key = `${compId}|${pp.sku}`;
        if (!cpLookup.has(key) && !newCpKeys.has(key)) {
          newCpKeys.add(key);
          newCps.push({
            tenant_id: tenantId,
            competitor_id: compId,
            competitor_sku: pp.sku,
            competitor_name: pp.name,
            barcode: pp.barcode,
            our_product_id: our.id,
            category_hint: pp.category,
          });
        }
      }
    }

    if (newCps.length > 0) {
      const { data: inserted, error } = await supabase
        .from('competitor_products')
        .insert(newCps)
        .select('id, competitor_id, competitor_sku');
      if (error) {
        result.errors.push(`cp batch: ${error.message}`);
      } else {
        inserted?.forEach(cp => cpLookup.set(`${cp.competitor_id}|${cp.competitor_sku}`, cp.id));
      }
    }

    // --- Batch mappings ---
    const newMappings: any[] = [];
    const seenMapKeys = new Set<string>();
    for (const item of compDataBatch) {
      const key = `${item.ourId}|${item.compId}`;
      if (!mappingSet.has(key) && !seenMapKeys.has(key)) {
        seenMapKeys.add(key);
        newMappings.push({
          our_product_id: item.ourId,
          competitor_id: item.compId,
          competitor_product_sku: item.sku,
          competitor_product_name: item.name,
          competitor_brand: item.brand,
          ai_similarity_score: 1.0,
          mapping_status: 'auto_matched',
        });
      }
    }
    if (newMappings.length > 0) {
      const { error } = await supabase.from('competitor_product_mapping').insert(newMappings);
      if (error) result.errors.push(`mapping batch: ${error.message}`);
    }

    // --- Batch competitor prices ---
    const newPrices: any[] = [];
    for (const item of compDataBatch) {
      const cpId = cpLookup.get(`${item.compId}|${item.sku}`);
      if (!cpId) continue;

      const existing = priceLookup.get(cpId);
      if (existing) {
        if (Math.abs(existing.price - item.price) >= 0.005) {
          await supabase.from('competitor_price_history').update({ price: item.price }).eq('id', existing.id);
        }
      } else {
        newPrices.push({
          tenant_id: tenantId,
          competitor_product_id: cpId,
          date: today,
          price: item.price,
          promo_flag: false,
          note: 'Prisync import',
        });
      }
      result.competitorPricesImported++;
    }

    if (newPrices.length > 0) {
      const { error } = await supabase.from('competitor_price_history').insert(newPrices);
      if (error) result.errors.push(`prices batch: ${error.message}`);
    }

    console.log(`[Prisync] Done:`, JSON.stringify(result));

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Prisync] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
