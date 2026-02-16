/**
 * Price Synchronization & History Tracking
 *
 * Reusable functions for:
 * - Tracking price changes in price_history table
 * - Syncing cost_price from sales transactions
 * - Importing Prisync monitoring data
 *
 * NOTE: Šis ir pagaidu risinājums priekš Prisync importa.
 * Vēlāk tiks izveidots savs scraper kas aizvietos Prisync.
 */

import { supabase } from "@/integrations/supabase/client";

// --- Types ---

export interface PriceChangeRecord {
  productId: string;
  tenantId: string;
  storeId?: string;
  oldRegularPrice?: number;
  newRegularPrice?: number;
  oldCostPrice?: number;
  newCostPrice?: number;
  oldPromoPrice?: number;
  newPromoPrice?: number;
}

export interface PrisyncProduct {
  productCode: string;       // SKU
  productName: string;
  barcode: string | null;
  brand: string | null;
  category: string | null;
  myPrice: number | null;    // Our current shelf price
  myPosition: string | null; // "I am cheapest", "I am cheaper", etc.
  minPrice: number | null;
  maxPrice: number | null;
  avgPrice: number | null;
  cheapestSite: string | null;
  highestSite: string | null;
  numMatches: number;
  competitors: Record<string, number | null>;  // domain → price (null if '-')
}

export interface PrisyncImportResult {
  totalProducts: number;
  matchedProducts: number;
  unmatchedSkus: string[];
  pricesUpdated: number;
  promoDetected: number;       // products where Prisync price looks like a promo
  competitorPricesImported: number;
  priceHistoryRecords: number;
  errors: string[];
}

// Promotion detection threshold:
// If Prisync "My Price" is more than this % below current_price, it's likely a promo
const PROMO_THRESHOLD = 0.20; // 20% — e.g. regular €37, Prisync shows €17 = -54% → promo

// Known Prisync competitor column domains → our competitor DB domains
const PRISYNC_COMPETITOR_COLUMNS: Record<string, string> = {
  'spiritsandwine.lv - Price': 'spiritsandwine.lv',  // our own — skip in competitor import
  'barbora.lv - Price': 'barbora.lv',
  'rimi.lv - Price': 'rimi.lv',
  'alkoutlet.lv - Price': 'alkoutlet.lv',
  'superalko.lv - Price': 'superalko.lv',
  'vynoteka.lv - Price': 'vynoteka.lv',
};

// --- Price History Tracking ---

/**
 * Track a price change in price_history table.
 * - Closes the previous open record (sets valid_to = today)
 * - Inserts a new record with valid_from = today
 */
export async function trackPriceChange(change: PriceChangeRecord): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];

  try {
    // Close previous open price_history record for this product
    await supabase
      .from('price_history')
      .update({ valid_to: today })
      .eq('product_id', change.productId)
      .is('valid_to', null);

    // Insert new price_history record
    const { error } = await supabase
      .from('price_history')
      .insert({
        tenant_id: change.tenantId,
        product_id: change.productId,
        store_id: change.storeId || null,
        valid_from: today,
        valid_to: null,
        regular_price: change.newRegularPrice ?? change.oldRegularPrice ?? 0,
        promo_price: change.newPromoPrice ?? null,
        cost_price: change.newCostPrice ?? change.oldCostPrice ?? null,
      });

    if (error) {
      console.error('[PriceSync] Error inserting price_history:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[PriceSync] trackPriceChange error:', err);
    return false;
  }
}

/**
 * After importing sales data, sync cost_price from latest purchase_price.
 * Only updates if purchase_price has actually changed and is > 0.
 */
export async function syncCostPricesFromSales(
  tenantId: string,
  productIds: string[]
): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  // Batch fetch current products
  const allProducts: { id: string; cost_price: number; current_price: number }[] = [];
  const pageSize = 500;
  for (let i = 0; i < productIds.length; i += pageSize) {
    const batch = productIds.slice(i, i + pageSize);
    const { data } = await supabase
      .from('products')
      .select('id, cost_price, current_price')
      .in('id', batch);
    if (data) allProducts.push(...data);
  }
  const productMap = new Map(allProducts.map(p => [p.id, p]));

  // For each product, get the latest purchase_price from sales_daily
  for (const productId of productIds) {
    try {
      const { data: latestSale } = await supabase
        .from('sales_daily')
        .select('purchase_price')
        .eq('product_id', productId)
        .gt('purchase_price', 0)
        .order('reg_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestSale?.purchase_price) continue;

      const product = productMap.get(productId);
      if (!product) continue;

      const newCost = Number(latestSale.purchase_price);
      const oldCost = Number(product.cost_price);

      // Only update if actually different (more than 0.5 cent difference)
      if (Math.abs(newCost - oldCost) < 0.005) continue;

      // Update products.cost_price
      const { error: updateError } = await supabase
        .from('products')
        .update({ cost_price: newCost })
        .eq('id', productId);

      if (updateError) {
        console.error(`[PriceSync] Failed to update cost_price for ${productId}:`, updateError);
        errors++;
        continue;
      }

      // Track in price_history
      await trackPriceChange({
        productId,
        tenantId,
        oldCostPrice: oldCost,
        newCostPrice: newCost,
        oldRegularPrice: Number(product.current_price),
        newRegularPrice: Number(product.current_price),
      });

      updated++;
    } catch (err) {
      console.error(`[PriceSync] syncCostPrices error for ${productId}:`, err);
      errors++;
    }
  }

  console.log(`[PriceSync] Cost price sync: ${updated} updated, ${errors} errors out of ${productIds.length} products`);
  return { updated, errors };
}

// --- Prisync Import ---

/**
 * Parse raw Prisync Horizontal Report rows into structured PrisyncProduct objects.
 */
export function parsePrisyncRows(rawRows: any[]): PrisyncProduct[] {
  return rawRows
    .filter(row => {
      const code = row['Product Code'];
      return code && String(code).trim() !== '' && String(code).trim() !== '-';
    })
    .map(row => {
      const parsePrice = (val: any): number | null => {
        if (val === undefined || val === null || val === '-' || val === '' || String(val).trim() === '-') return null;
        const num = Number(val);
        return isNaN(num) || num <= 0 ? null : num;
      };

      const competitors: Record<string, number | null> = {};
      for (const [colName, domain] of Object.entries(PRISYNC_COMPETITOR_COLUMNS)) {
        if (domain === 'spiritsandwine.lv') continue; // Skip our own
        competitors[domain] = parsePrice(row[colName]);
      }

      return {
        productCode: String(row['Product Code']).trim(),
        productName: String(row['Product Name'] || '').trim(),
        barcode: row['Barcode'] && String(row['Barcode']).trim() !== '-' ? String(row['Barcode']).trim() : null,
        brand: row['Brand'] && String(row['Brand']).trim() !== '-' ? String(row['Brand']).trim() : null,
        category: row['Category'] && String(row['Category']).trim() !== '-' ? String(row['Category']).trim() : null,
        myPrice: parsePrice(row['My Price']),
        myPosition: row['My Position'] && String(row['My Position']).trim() !== '-' ? String(row['My Position']).trim() : null,
        minPrice: parsePrice(row['Minimum Price']),
        maxPrice: parsePrice(row['Maximum Price']),
        avgPrice: parsePrice(row['Average Price']),
        cheapestSite: row['Cheapest Site'] && String(row['Cheapest Site']).trim() !== '-' ? String(row['Cheapest Site']).trim() : null,
        highestSite: row['Highest Site'] && String(row['Highest Site']).trim() !== '-' ? String(row['Highest Site']).trim() : null,
        numMatches: Number(row['Number of Matches'] || 0),
        competitors,
      };
    });
}

/**
 * Detect if raw Excel data is a Prisync Horizontal Report.
 * Returns true if the data has Prisync-specific columns.
 */
export function isPrisyncFormat(columns: string[]): boolean {
  const lowerCols = columns.map(c => c.toLowerCase());
  // Must have these Prisync-specific columns
  const requiredPrisync = ['my price', 'my position', 'product code', 'minimum price'];
  const matchCount = requiredPrisync.filter(req => lowerCols.some(c => c.includes(req))).length;
  return matchCount >= 3;  // At least 3 of 4 Prisync markers
}

/**
 * Import Prisync monitoring data into the database.
 *
 * Flow:
 * 1. Parse products from Prisync Excel
 * 2. Match to our products by SKU (Product Code)
 * 3. Update our current_price if changed
 * 4. Track price changes in price_history
 * 5. Upsert competitor_products + competitor_price_history
 */
export async function importPrisyncData(
  rawRows: any[],
  tenantId: string,
  importDate?: string
): Promise<PrisyncImportResult> {
  const result: PrisyncImportResult = {
    totalProducts: 0,
    matchedProducts: 0,
    unmatchedSkus: [],
    pricesUpdated: 0,
    promoDetected: 0,
    competitorPricesImported: 0,
    priceHistoryRecords: 0,
    errors: [],
  };

  const today = importDate || new Date().toISOString().split('T')[0];

  // 1. Parse Prisync data
  const prisyncProducts = parsePrisyncRows(rawRows);
  result.totalProducts = prisyncProducts.length;
  console.log(`[Prisync] Parsed ${prisyncProducts.length} products from Prisync report`);

  if (prisyncProducts.length === 0) {
    result.errors.push('Nav atrasti derīgi produkti Prisync failā');
    return result;
  }

  // 2. Fetch our products by SKU for matching
  const skus = prisyncProducts.map(p => p.productCode);
  const allOurProducts: any[] = [];
  const pageSize = 500;
  for (let i = 0; i < skus.length; i += pageSize) {
    const batch = skus.slice(i, i + pageSize);
    const { data } = await supabase
      .from('products')
      .select('id, sku, name, current_price, cost_price')
      .in('sku', batch);
    if (data) allOurProducts.push(...data);
  }
  const skuToProduct = new Map(allOurProducts.map(p => [p.sku, p]));
  console.log(`[Prisync] Matched ${allOurProducts.length} of ${skus.length} SKUs to our products`);

  // 3. Fetch competitor IDs
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name, website_url');

  const domainToCompetitorId = new Map<string, string>();
  competitors?.forEach(c => {
    const domain = c.website_url?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') || '';
    if (domain) domainToCompetitorId.set(domain, c.id);
    // Also try by name
    domainToCompetitorId.set(c.name.toLowerCase(), c.id);
  });

  // Collect competitor data for batch processing after the loop
  const competitorDataBatch: {
    pp: PrisyncProduct;
    ourProduct: any;
    domain: string;
    compPrice: number;
    competitorId: string;
  }[] = [];

  // 4. Process each Prisync product (prices + collect competitor data)
  for (const pp of prisyncProducts) {
    const ourProduct = skuToProduct.get(pp.productCode);

    if (!ourProduct) {
      result.unmatchedSkus.push(pp.productCode);
      continue;
    }

    result.matchedProducts++;

    // 4a. Smart price update with promo detection
    // Logic:
    //   - If Prisync "My Price" is >20% BELOW current_price → likely a PROMO
    //     → DON'T overwrite current_price (regular), save as promo_price in price_history
    //   - If Prisync "My Price" is within ±20% or ABOVE → normal price change
    //     → UPDATE current_price
    //   - If our current_price was 0 or null → always set it
    if (pp.myPrice !== null) {
      const oldPrice = Number(ourProduct.current_price);
      const newPrice = pp.myPrice;
      const priceDiff = Math.abs(oldPrice - newPrice);

      if (priceDiff >= 0.005) {
        const dropPercent = oldPrice > 0 ? (oldPrice - newPrice) / oldPrice : 0;
        const isLikelyPromo = dropPercent > PROMO_THRESHOLD && oldPrice > 0;

        if (isLikelyPromo) {
          // This looks like a promotion — DON'T change current_price (regular price)
          // Instead, record in price_history as a promo price
          console.log(`[Prisync] PROMO detected: ${pp.productName} — regular €${oldPrice.toFixed(2)}, Prisync shows €${newPrice.toFixed(2)} (-${(dropPercent * 100).toFixed(0)}%)`);
          result.promoDetected++;

          const tracked = await trackPriceChange({
            productId: ourProduct.id,
            tenantId,
            oldRegularPrice: oldPrice,
            newRegularPrice: oldPrice,     // Keep regular price unchanged
            newPromoPrice: newPrice,        // Save Prisync price as promo
            oldCostPrice: Number(ourProduct.cost_price),
          });
          if (tracked) result.priceHistoryRecords++;
        } else {
          // Normal price change — update current_price
          const { error: updateError } = await supabase
            .from('products')
            .update({ current_price: newPrice })
            .eq('id', ourProduct.id);

          if (updateError) {
            result.errors.push(`Cenas atjaunināšana neizdevās: ${pp.productName} — ${updateError.message}`);
          } else {
            result.pricesUpdated++;

            const tracked = await trackPriceChange({
              productId: ourProduct.id,
              tenantId,
              oldRegularPrice: oldPrice,
              newRegularPrice: newPrice,
              oldCostPrice: Number(ourProduct.cost_price),
            });
            if (tracked) result.priceHistoryRecords++;
          }
        }
      }
    }

    // 4b. Collect competitor data for batch processing
    for (const [domain, compPrice] of Object.entries(pp.competitors)) {
      if (compPrice === null) continue;
      const competitorId = domainToCompetitorId.get(domain) || domainToCompetitorId.get(domain.toLowerCase());
      if (!competitorId) continue;
      competitorDataBatch.push({
        pp,
        ourProduct,
        domain,
        compPrice,
        competitorId,
      });
    }
  }

  // 5. Batch process competitor products + prices (FAST)
  console.log(`[Prisync] Processing ${competitorDataBatch.length} competitor price entries in batch...`);

  // 5a. Fetch ALL existing competitor_products in one query
  const { data: existingCpAll } = await supabase
    .from('competitor_products')
    .select('id, competitor_id, competitor_sku')
    .eq('tenant_id', tenantId);
  const cpLookup = new Map<string, string>();
  existingCpAll?.forEach(cp => cpLookup.set(`${cp.competitor_id}|${cp.competitor_sku}`, cp.id));

  // 5b. Fetch ALL existing competitor_product_mapping in one query
  const { data: existingMappingAll } = await supabase
    .from('competitor_product_mapping')
    .select('id, our_product_id, competitor_id');
  const mappingLookup = new Set<string>();
  existingMappingAll?.forEach(m => mappingLookup.add(`${m.our_product_id}|${m.competitor_id}`));

  // 5c. Fetch ALL existing competitor_price_history for today in one query
  const { data: existingPricesAll } = await supabase
    .from('competitor_price_history')
    .select('id, competitor_product_id, price')
    .eq('date', today);
  const priceLookup = new Map<string, { id: string; price: number }>();
  existingPricesAll?.forEach(p => priceLookup.set(p.competitor_product_id, { id: p.id, price: Number(p.price) }));

  // 5d. Batch insert new competitor_products
  const newCpToInsert: any[] = [];
  const newCpKeys: string[] = [];
  for (const item of competitorDataBatch) {
    const key = `${item.competitorId}|${item.pp.productCode}`;
    if (!cpLookup.has(key) && !newCpKeys.includes(key)) {
      newCpKeys.push(key);
      newCpToInsert.push({
        tenant_id: tenantId,
        competitor_id: item.competitorId,
        competitor_sku: item.pp.productCode,
        competitor_name: item.pp.productName,
        barcode: item.pp.barcode,
        our_product_id: item.ourProduct.id,
        category_hint: item.pp.category,
      });
    }
  }

  if (newCpToInsert.length > 0) {
    const batchSize = 200;
    for (let i = 0; i < newCpToInsert.length; i += batchSize) {
      const batch = newCpToInsert.slice(i, i + batchSize);
      const { data: inserted, error: cpErr } = await supabase
        .from('competitor_products')
        .insert(batch)
        .select('id, competitor_id, competitor_sku');
      if (cpErr) {
        result.errors.push(`competitor_products batch insert: ${cpErr.message}`);
      } else {
        inserted?.forEach(cp => cpLookup.set(`${cp.competitor_id}|${cp.competitor_sku}`, cp.id));
      }
    }
    console.log(`[Prisync] Inserted ${newCpToInsert.length} new competitor_products`);
  }

  // 5e. Batch insert new competitor_product_mappings
  const newMappings: any[] = [];
  const seenMappingKeys = new Set<string>();
  for (const item of competitorDataBatch) {
    const key = `${item.ourProduct.id}|${item.competitorId}`;
    if (!mappingLookup.has(key) && !seenMappingKeys.has(key)) {
      seenMappingKeys.add(key);
      newMappings.push({
        our_product_id: item.ourProduct.id,
        competitor_id: item.competitorId,
        competitor_product_sku: item.pp.productCode,
        competitor_product_name: item.pp.productName,
        competitor_brand: item.pp.brand,
        ai_similarity_score: 1.0,
        mapping_status: 'auto_matched',
      });
    }
  }

  if (newMappings.length > 0) {
    const batchSize = 200;
    for (let i = 0; i < newMappings.length; i += batchSize) {
      const batch = newMappings.slice(i, i + batchSize);
      const { error: mapErr } = await supabase.from('competitor_product_mapping').insert(batch);
      if (mapErr) result.errors.push(`competitor_product_mapping batch insert: ${mapErr.message}`);
    }
    console.log(`[Prisync] Inserted ${newMappings.length} new competitor_product_mappings`);
  }

  // 5f. Batch insert/update competitor_price_history
  const newPrices: any[] = [];
  const priceUpdates: { id: string; price: number }[] = [];
  for (const item of competitorDataBatch) {
    const cpKey = `${item.competitorId}|${item.pp.productCode}`;
    const cpId = cpLookup.get(cpKey);
    if (!cpId) continue;

    const existing = priceLookup.get(cpId);
    if (existing) {
      if (Math.abs(existing.price - item.compPrice) >= 0.005) {
        priceUpdates.push({ id: existing.id, price: item.compPrice });
      }
    } else {
      newPrices.push({
        tenant_id: tenantId,
        competitor_product_id: cpId,
        date: today,
        price: item.compPrice,
        promo_flag: false,
        note: 'Prisync import',
      });
    }
    result.competitorPricesImported++;
  }

  if (newPrices.length > 0) {
    const batchSize = 200;
    for (let i = 0; i < newPrices.length; i += batchSize) {
      const batch = newPrices.slice(i, i + batchSize);
      const { error: phErr } = await supabase.from('competitor_price_history').insert(batch);
      if (phErr) result.errors.push(`competitor_price_history batch insert: ${phErr.message}`);
    }
    console.log(`[Prisync] Inserted ${newPrices.length} new competitor prices`);
  }

  // Update existing prices one by one (usually few)
  for (const upd of priceUpdates) {
    await supabase.from('competitor_price_history').update({ price: upd.price }).eq('id', upd.id);
  }
  if (priceUpdates.length > 0) {
    console.log(`[Prisync] Updated ${priceUpdates.length} existing competitor prices`);
  }

  console.log(`[Prisync] Import complete:`, result);
  return result;
}
