/**
 * RetailAI ETL Engine
 * 
 * Extract–Transform–Load engine for processing Excel/CSV files.
 * Supports: Product Master, Weekly Sales (generic), Spirits&Wine LW vs PW format
 */

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type FileType = 'product' | 'sales' | 'unknown';

export interface ProductRow {
  SKU: string;
  Product_Name: string;
  EAN: string | null;
  Brand: string | null;
  Category: string | null;
  Subcategory: string | null;
  Country: string | null;
  Volume: number | null;
  Volume_Unit: string | null;
  ABV: number | null;
  Cost_Price: number | null;
  Current_Price: number | null;
  VAT_Rate: number | null;
  Private_Label: boolean | null;
  Status: string | null;
}

export interface SalesRow {
  SKU: string | null;
  Product_Name?: string; // For Spirits&Wine format where SKU is matched later by name
  Week_End_Date: string;
  Store_Code: string | null;
  Units_Sold: number;
  Net_Revenue: number | null;
  Gross_Margin: number | null;
  Regular_Price: number | null;
  Promo_Price: number | null;
  Promo_Flag: boolean | null;
  Promo_Name: string | null;
  Stock_End: number | null;
  Period_Type?: 'LW' | 'PW'; // For Spirits&Wine format
  Partner?: string; // Source partner name
}

export interface SkipReason {
  [reason: string]: number;
}

export interface ETLSummary {
  total_rows_input: number;
  total_rows_valid: number;
  total_rows_skipped: number;
  skipped_reasons: SkipReason;
  message?: string;
  detected_format?: string;
}

export interface ProductETLResult {
  type: 'product';
  rows: ProductRow[];
  summary: ETLSummary;
}

export interface SalesETLResult {
  type: 'sales';
  rows: SalesRow[];
  summary: ETLSummary;
}

export interface UnknownETLResult {
  type: 'unknown';
  rows: never[];
  summary: { message: string };
}

export type ETLResult = ProductETLResult | SalesETLResult | UnknownETLResult;

// ============================================================
// COLUMN MAPPING PATTERNS (case-insensitive)
// ============================================================

const PRODUCT_COLUMN_MAP: Record<keyof ProductRow, string[]> = {
  SKU: ['preču kods', 'preces kods', 'sku', 'product code', 'code', 'artikuls'],
  Product_Name: ['preču nosaukums', 'produkta nosaukums', 'nosaukums', 'name', 'product_name', 'product name'],
  EAN: ['ean', 'barcode', 'svītrkods', 'barkods', 'gtin'],
  Brand: ['brand', 'zīmols', 'ražotājs'],
  Category: ['category', 'kategorija'],
  Subcategory: ['subcategory', 'subkategorija', 'apakškategorija'],
  Country: ['country', 'valsts', 'izcelsme'],
  Volume: ['volume', 'tilpums', 'apjoms'],
  Volume_Unit: ['volume_unit', 'volume unit', 'tilpuma mērv.', 'mērvienība'],
  ABV: ['abv', 'alcohol', 'alc.%', 'alc', 'alkohols', 'alk.%'],
  Cost_Price: ['iep. cena', 'iepirkuma cena', 'cost_price', 'cost price', 'pašizmaksa'],
  Current_Price: ['maz. cena', 'mazumtirdzniecības cena', 'pārdošanas cena', 'current_price', 'current price', 'regular_price', 'regular price', 'shelf price'],
  VAT_Rate: ['vat', 'vat_rate', 'vat rate', 'pvn', 'pvn %'],
  Private_Label: ['private label', 'private_label', 'private', 'privātā marka', 'pl'],
  Status: ['atlikums', 'status', 'active', 'stāvoklis', 'statuss']
};

const SALES_COLUMN_MAP: Record<string, string[]> = {
  SKU: ['brio cod', 'brio_cod', 'sku', 'code', 'product code', 'artikuls', 'preces kods'],
  Product_Name: ['nosaukums', 'product name', 'produkta nosaukums', 'name', 'prece'],
  Week_End_Date: ['week_end_date', 'week end', 'date', 'datums', 'nedēļas datums', 'week_end', 'periods'],
  Store_Code: ['veikals', 'store', 'store_code', 'branch', 'filiāle', 'shop'],
  Supplier: ['item.supplier_name', 'supplier', 'piegādātājs', 'supplier_name'],
  Units_Sold: ['skaits', 'units sold', 'units_sold', 'quantity sold', 'qty', 'sum of skaits', 'daudzums', 'quantity'],
  Net_Revenue: ['summa (ar pvn)', 'summa ar pvn', 'summa', 'net revenue', 'net_revenue', 'revenue', 'sales', 'apgrozījums', 'ieņēmumi'],
  Gross_Margin: ['gm', 'gross margin', 'gross_margin', 'bruto marža', 'sum of gm', 'marža', 'margin'],
  Gross_Margin_Percent: ['gm %', 'gm%', 'gross margin %', 'marža %', 'margin %', 'margin%'],
  Regular_Price: ['regular price', 'regular_price', 'price', 'unit price'],
  Promo_Price: ['promo price', 'promo_price', 'akcijas cena', 'atlaide', 'sale price'],
  Promo_Flag: ['promotion', 'promo', 'promo_flag', 'akcija', 'ir akcija', 'on_sale'],
  Promo_Name: ['promo name', 'promo_name', 'campaign', 'akcija nosaukums', 'kampaņa', 'campaign_name'],
  Stock_End: ['atlikumi', 'atlikums', 'stock end', 'stock_end', 'stock', 'krājumi', 'inventory']
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Normalize string for comparison (lowercase, trimmed)
 */
function normalize(value: string | null | undefined): string {
  return (value?.toString().trim().toLowerCase()) || '';
}

/**
 * Clean string value (trim whitespace)
 */
function cleanString(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  return value.toString().trim();
}

/**
 * Parse number from various formats
 */
function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  // Remove currency symbols, spaces
  let cleaned = value.toString()
    .replace(/[€$£¥₽]/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '.') // Convert comma decimals to dots
    .replace(/%/g, ''); // Remove percentage signs
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse boolean from various formats
 */
function parseBoolean(value: any): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  
  const normalized = normalize(value.toString());
  
  if (['yes', 'y', '1', 'true', 'jā', 'ja'].includes(normalized)) return true;
  if (['no', 'n', '0', 'false', 'nē', 'ne'].includes(normalized)) return false;
  
  return null;
}

/**
 * Parse date to ISO format (YYYY-MM-DD)
 */
function parseDate(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  
  // Handle Excel serial date numbers
  if (typeof value === 'number') {
    const excelDate = new Date((value - 25569) * 86400 * 1000);
    return excelDate.toISOString().split('T')[0];
  }
  
  const str = value.toString().trim();
  
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  // Try DD.MM.YYYY or DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    return `${ddmmyyyy[3]}-${month}-${day}`;
  }
  
  // Try YYYY/MM/DD
  const yyyymmdd = str.match(/^(\d{4})[.\/](\d{1,2})[.\/](\d{1,2})$/);
  if (yyyymmdd) {
    const month = yyyymmdd[2].padStart(2, '0');
    const day = yyyymmdd[3].padStart(2, '0');
    return `${yyyymmdd[1]}-${month}-${day}`;
  }
  
  // Try DD.MM (assume current year)
  const ddmm = str.match(/^(\d{1,2})[.\/](\d{1,2})$/);
  if (ddmm) {
    const year = new Date().getFullYear();
    const day = ddmm[1].padStart(2, '0');
    const month = ddmm[2].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Try to parse as date string
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {
    // Ignore parsing errors
  }
  
  return null;
}

/**
 * Extract EAN/barcode - keep only digits
 */
function parseEAN(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  const digits = value.toString().replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

/**
 * Extract volume from product name (e.g., "0.75L", "750ml")
 */
function extractVolume(productName: string): { volume: number | null; unit: string | null } {
  if (!productName) return { volume: null, unit: null };
  
  // Match patterns like "0.75L", "750ml", "1 L", "500 ml"
  const patterns = [
    /(\d+(?:[.,]\d+)?)\s*(ml|l|cl|litre?s?)\b/i,
    /(\d+(?:[.,]\d+)?)\s*(g|kg|gram(?:s)?|kilogram(?:s)?)\b/i
  ];
  
  for (const pattern of patterns) {
    const match = productName.match(pattern);
    if (match) {
      let volume = parseFloat(match[1].replace(',', '.'));
      const unit = normalize(match[2]);
      
      // Normalize to L or ml
      if (unit === 'cl') {
        volume = volume / 100; // Convert cl to L
        return { volume, unit: 'L' };
      } else if (unit === 'ml') {
        return { volume, unit: 'ml' };
      } else if (['l', 'litre', 'litres', 'liter', 'liters'].includes(unit)) {
        return { volume, unit: 'L' };
      } else if (['g', 'gram', 'grams'].includes(unit)) {
        return { volume, unit: 'g' };
      } else if (['kg', 'kilogram', 'kilograms'].includes(unit)) {
        return { volume, unit: 'kg' };
      }
    }
  }
  
  return { volume: null, unit: null };
}

/**
 * Find column in row by matching patterns
 * Prioritizes exact matches over partial matches
 */
function findColumnValue(row: Record<string, any>, patterns: string[]): any {
  const rowKeys = Object.keys(row);
  
  // First pass: exact matches only
  for (const pattern of patterns) {
    const normalizedPattern = normalize(pattern);
    for (const key of rowKeys) {
      const normalizedKey = normalize(key);
      if (normalizedKey === normalizedPattern) {
        return row[key];
      }
    }
  }
  
  // Second pass: includes matches (but skip generic patterns to avoid false matches)
  const genericPatterns = ['cena', 'price', 'cost', 'summa', 'skaits', 'name', 'code'];
  
  for (const pattern of patterns) {
    const normalizedPattern = normalize(pattern);
    // Skip generic patterns for includes matching
    if (genericPatterns.includes(normalizedPattern)) continue;
    
    for (const key of rowKeys) {
      const normalizedKey = normalize(key);
      if (normalizedKey.includes(normalizedPattern)) {
        return row[key];
      }
    }
  }
  
  return undefined;
}

/**
 * Get all column names from first row
 */
function getColumns(data: Record<string, any>[]): string[] {
  if (data.length === 0) return [];
  return Object.keys(data[0]);
}

// ============================================================
// FILE TYPE DETECTION
// ============================================================

interface DetectionResult {
  type: FileType;
  format?: string;
  spiritsWineInfo?: {
    nosaukumsCol: string | null;
    sumOfSkaitsCol: string | null;
    sumOfGMCol: string | null;
    atlikumiCol: string | null;
    hasLWPW: boolean;
    weekEndDate: string | null;
  };
}

/**
 * Detect file type based on column headers
 */
function detectFileType(data: Record<string, any>[], contextYear?: number): DetectionResult {
  if (data.length === 0) {
    return { type: 'unknown' };
  }
  
  const columns = getColumns(data);
  const normalizedColumns = columns.map(c => normalize(c));
  
  console.log('[ETL] Detecting file type, columns:', columns);
  
  // Check for Spirits&Wine LW vs PW format first (most specific)
  const nosaukumsCol = columns.find(c => normalize(c) === 'nosaukums');
  const sumOfSkaitsCol = columns.find(c => normalize(c) === 'sum of skaits');
  const sumOfGMCol = columns.find(c => normalize(c) === 'sum of gm');
  const atlikumiCol = columns.find(c => normalize(c).startsWith('atlikumi '));
  
  // Check for LW/PW columns (variants: .1 or _1)
  const hasLWPW = columns.some(c => {
    const n = normalize(c);
    return n === 'sum of skaits.1' || n === 'sum of skaits_1';
  });
  
  if (nosaukumsCol && sumOfSkaitsCol && sumOfGMCol) {
    // Parse week end date from Atlikumi column
    let weekEndDate: string | null = null;
    if (atlikumiCol) {
      const dateMatch = atlikumiCol.match(/[Aa]tlikumi\s+(\d{1,2})\.(\d{1,2})/);
      if (dateMatch) {
        const year = contextYear || new Date().getFullYear();
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        weekEndDate = `${year}-${month}-${day}`;
      }
    }
    
    console.log('[ETL] Detected: Spirits&Wine format');
    return {
      type: 'sales',
      format: 'spiritsWine',
      spiritsWineInfo: {
        nosaukumsCol,
        sumOfSkaitsCol,
        sumOfGMCol,
        atlikumiCol,
        hasLWPW,
        weekEndDate
      }
    };
  }
  
  // Check for Latvian product format FIRST (Preču kods, Preču nosaukums, Iep. cena, Maz. cena)
  // This must come before generic sales check because "Preču kods" matches SKU patterns
  const hasLatvianProductFormat = normalizedColumns.some(c => c.includes('preču kods')) &&
    normalizedColumns.some(c => c.includes('preču nosaukums'));
  
  const hasPriceColumns = normalizedColumns.some(c => c.includes('iep. cena') || c.includes('maz. cena'));
  
  if (hasLatvianProductFormat && hasPriceColumns) {
    console.log('[ETL] Detected: Latvian product format (Preču kods + Iep./Maz. cena)');
    return { type: 'product', format: 'latvianProduct' };
  }
  
  // Check for Latvian sales format (BRIO COD + Nosaukums + Skaits + Summa)
  // This is the Sales_dati_Oskaram.xlsx format: Veikals, Item.Supplier_Name, BRIO COD, Nosaukums, Skaits, Summa (ar PVN), GM, GM %, Atlikumi
  const hasBrioCod = normalizedColumns.some(c => c === 'brio cod');
  const hasNosaukums = normalizedColumns.some(c => c === 'nosaukums');
  const hasSkaits = normalizedColumns.some(c => c === 'skaits');
  const hasSumma = normalizedColumns.some(c => c.includes('summa'));
  
  if ((hasBrioCod || hasNosaukums) && hasSkaits && hasSumma) {
    console.log('[ETL] Detected: Latvian sales format (BRIO COD/Nosaukums + Skaits + Summa)');
    return { type: 'sales', format: 'latvianSales' };
  }
  
  // Check for product master format (before sales to prioritize product detection)
  const hasName = normalizedColumns.some(c => 
    ['name', 'product_name', 'product name', 'nosaukums', 'preču nosaukums'].includes(c)
  );
  
  const hasProductAttributes = normalizedColumns.some(c => 
    ['brand', 'category', 'cost', 'price', 'cost_price', 'current_price', 'zīmols', 'kategorija', 'iep. cena', 'maz. cena'].some(p => c === p || c.includes(p))
  );
  
  const hasSKU = normalizedColumns.some(c => 
    ['sku', 'code', 'product code', 'preču kods'].some(p => c === p || c.includes(p))
  );
  
  if (hasSKU && hasName && hasProductAttributes) {
    console.log('[ETL] Detected: Product master format');
    return { type: 'product', format: 'productMaster' };
  }
  
  // Check for generic sales format (after product checks)
  const hasDate = normalizedColumns.some(c => 
    ['week_end_date', 'week end', 'date', 'datums'].some(p => c === p || c.includes(p))
  );
  
  const hasQuantity = normalizedColumns.some(c => 
    ['units sold', 'units_sold', 'quantity sold', 'qty', 'skaits', 'sum of skaits'].some(p => c === p || c.includes(p))
  );
  
  if (hasSKU && (hasDate || hasQuantity)) {
    console.log('[ETL] Detected: Generic sales format');
    return { type: 'sales', format: 'generic' };
  }
  
  // Fallback: check if it looks like products or sales
  if (hasSKU && hasName) {
    console.log('[ETL] Detected: Probable product format');
    return { type: 'product', format: 'productMaster' };
  }
  
  if (hasQuantity) {
    console.log('[ETL] Detected: Probable sales format (quantity column found)');
    return { type: 'sales', format: 'generic' };
  }
  
  console.log('[ETL] Unknown format');
  return { type: 'unknown' };
}

// ============================================================
// PRODUCT MASTER TRANSFORMATION
// ============================================================

function transformProducts(data: Record<string, any>[]): { rows: ProductRow[]; skipped: SkipReason } {
  // Track aggregated data per SKU for multi-row products (e.g., Oskars format with multiple purchase batches)
  const productAggregates = new Map<string, {
    rows: any[];
    productName: string;
  }>();
  const skipped: SkipReason = {};
  
  console.log('[ETL] Transforming products, input rows:', data.length);
  
  // First pass: group rows by SKU
  for (const row of data) {
    const sku = cleanString(findColumnValue(row, PRODUCT_COLUMN_MAP.SKU));
    const productName = cleanString(findColumnValue(row, PRODUCT_COLUMN_MAP.Product_Name));
    
    if (!sku && !productName) {
      skipped['Missing SKU and Product_Name'] = (skipped['Missing SKU and Product_Name'] || 0) + 1;
      continue;
    }
    
    if (!sku) {
      skipped['Missing SKU'] = (skipped['Missing SKU'] || 0) + 1;
      continue;
    }
    
    if (!productName) {
      skipped['Missing Product_Name'] = (skipped['Missing Product_Name'] || 0) + 1;
      continue;
    }
    
    const existing = productAggregates.get(sku);
    if (existing) {
      existing.rows.push(row);
    } else {
      productAggregates.set(sku, { rows: [row], productName });
    }
  }
  
  console.log('[ETL] Unique SKUs found:', productAggregates.size);
  
  // Second pass: aggregate data per SKU
  const productMap = new Map<string, ProductRow>();
  
  for (const [sku, aggregate] of productAggregates.entries()) {
    const rows = aggregate.rows;
    const productName = aggregate.productName;
    
    // For multi-row products (e.g., multiple purchase batches), calculate weighted average cost
    // and use the retail price from the most recent or consistent entry
    let totalStock = 0;
    let weightedCostSum = 0;
    let latestRetailPrice: number | null = null;
    let latestDate: Date | null = null;
    
    for (const row of rows) {
      const stock = parseNumber(findColumnValue(row, PRODUCT_COLUMN_MAP.Status)) || 0; // Atlikums
      const costPrice = parseNumber(findColumnValue(row, PRODUCT_COLUMN_MAP.Cost_Price));
      const currentPrice = parseNumber(findColumnValue(row, PRODUCT_COLUMN_MAP.Current_Price));
      
      // Parse document date if available (for finding latest entry)
      const docDateStr = cleanString(row['Dok-ta datums'] || row['Datums']);
      let docDate: Date | null = null;
      if (docDateStr) {
        const parsed = parseDate(docDateStr);
        if (parsed) docDate = new Date(parsed);
      }
      
      // Weighted average cost by stock quantity
      if (costPrice !== null && stock > 0) {
        weightedCostSum += costPrice * stock;
        totalStock += stock;
      } else if (costPrice !== null && rows.length === 1) {
        // Single row without stock info - just use the cost
        weightedCostSum = costPrice;
        totalStock = 1;
      }
      
      // Use retail price from latest entry or first valid one
      if (currentPrice !== null) {
        if (latestDate === null || (docDate && docDate > latestDate)) {
          latestRetailPrice = currentPrice;
          latestDate = docDate;
        } else if (latestRetailPrice === null) {
          latestRetailPrice = currentPrice;
        }
      }
    }
    
    // Calculate final prices
    const avgCostPrice = totalStock > 0 ? weightedCostSum / totalStock : (weightedCostSum || null);
    const finalRetailPrice = latestRetailPrice;
    
    // Extract volume from product name
    let volume: number | null = null;
    let volumeUnit: string | null = null;
    if (productName) {
      const extracted = extractVolume(productName);
      volume = extracted.volume;
      volumeUnit = extracted.unit;
    }
    
    // Determine status based on total stock
    const status = totalStock > 0 ? 'Active' : 'Inactive';
    
    // Use first row for other attributes
    const firstRow = rows[0];
    
    const productRow: ProductRow = {
      SKU: sku,
      Product_Name: productName,
      EAN: parseEAN(findColumnValue(firstRow, PRODUCT_COLUMN_MAP.EAN)),
      Brand: cleanString(findColumnValue(firstRow, PRODUCT_COLUMN_MAP.Brand)),
      Category: cleanString(findColumnValue(firstRow, PRODUCT_COLUMN_MAP.Category)),
      Subcategory: cleanString(findColumnValue(firstRow, PRODUCT_COLUMN_MAP.Subcategory)),
      Country: cleanString(findColumnValue(firstRow, PRODUCT_COLUMN_MAP.Country)),
      Volume: volume,
      Volume_Unit: volumeUnit,
      ABV: parseNumber(findColumnValue(firstRow, PRODUCT_COLUMN_MAP.ABV)),
      Cost_Price: avgCostPrice,
      Current_Price: finalRetailPrice,
      VAT_Rate: parseNumber(findColumnValue(firstRow, PRODUCT_COLUMN_MAP.VAT_Rate)),
      Private_Label: parseBoolean(findColumnValue(firstRow, PRODUCT_COLUMN_MAP.Private_Label)),
      Status: status
    };
    
    productMap.set(sku, productRow);
    
    if (rows.length > 1) {
      skipped['Merged multiple batches'] = (skipped['Merged multiple batches'] || 0) + (rows.length - 1);
    }
  }
  
  const finalRows = Array.from(productMap.values());
  
  console.log('[ETL] Products transformed:', finalRows.length, 'unique products');
  console.log('[ETL] Aggregation summary:', skipped);
  
  return { rows: finalRows, skipped };
}

// ============================================================
// SALES TRANSFORMATION (GENERIC / LATVIAN SALES)
// ============================================================

/**
 * Check if a value represents a summary/total row
 */
function isSummaryRow(value: string | null): boolean {
  if (!value) return false;
  const normalized = normalize(value);
  return (
    normalized.includes('total') ||
    normalized.includes('kopā') ||
    normalized.includes('summa') ||
    normalized === '-' ||
    normalized === '(blank)' ||
    normalized === 'blank' ||
    normalized === 'grand total' ||
    normalized.startsWith('итого') ||
    normalized === ''
  );
}

function transformGenericSales(data: Record<string, any>[], format?: string): { rows: SalesRow[]; skipped: SkipReason } {
  const rows: SalesRow[] = [];
  const skipped: SkipReason = {};
  
  console.log('[ETL] Transforming sales, input rows:', data.length, 'format:', format);
  
  for (const row of data) {
    // Get SKU - support BRIO COD for Latvian sales format
    let sku = cleanString(findColumnValue(row, SALES_COLUMN_MAP.SKU));
    
    // Get product name (especially for Latvian format)
    const productName = cleanString(findColumnValue(row, SALES_COLUMN_MAP.Product_Name));
    
    // Get store code
    const storeCode = cleanString(findColumnValue(row, SALES_COLUMN_MAP.Store_Code));
    
    // Get sales data
    const unitsSold = parseNumber(findColumnValue(row, SALES_COLUMN_MAP.Units_Sold));
    const netRevenue = parseNumber(findColumnValue(row, SALES_COLUMN_MAP.Net_Revenue));
    const grossMargin = parseNumber(findColumnValue(row, SALES_COLUMN_MAP.Gross_Margin));
    const stockEnd = parseNumber(findColumnValue(row, SALES_COLUMN_MAP.Stock_End));
    
    // Skip total/summary rows - check both SKU and product name
    if (isSummaryRow(sku) || isSummaryRow(productName)) {
      skipped['Total/Summary row'] = (skipped['Total/Summary row'] || 0) + 1;
      continue;
    }
    
    // For Latvian sales format, allow rows without SKU if they have product name
    if (!sku && !productName) {
      skipped['Missing SKU and Product_Name'] = (skipped['Missing SKU and Product_Name'] || 0) + 1;
      continue;
    }
    
    // Skip if both units_sold and net_revenue are missing/zero
    if ((unitsSold === null || unitsSold === 0) && (netRevenue === null || netRevenue === 0)) {
      skipped['Missing Units_Sold and Net_Revenue'] = (skipped['Missing Units_Sold and Net_Revenue'] || 0) + 1;
      continue;
    }
    
    // Parse date - default to today if not provided
    const dateValue = findColumnValue(row, SALES_COLUMN_MAP.Week_End_Date);
    const weekEndDate = parseDate(dateValue) || new Date().toISOString().split('T')[0];
    
    const salesRow: SalesRow = {
      SKU: sku,
      Product_Name: productName || undefined,
      Week_End_Date: weekEndDate,
      Store_Code: storeCode,
      Units_Sold: unitsSold || 0,
      Net_Revenue: netRevenue,
      Gross_Margin: grossMargin,
      Regular_Price: parseNumber(findColumnValue(row, SALES_COLUMN_MAP.Regular_Price)),
      Promo_Price: parseNumber(findColumnValue(row, SALES_COLUMN_MAP.Promo_Price)),
      Promo_Flag: parseBoolean(findColumnValue(row, SALES_COLUMN_MAP.Promo_Flag)),
      Promo_Name: cleanString(findColumnValue(row, SALES_COLUMN_MAP.Promo_Name)),
      Stock_End: stockEnd,
      Partner: format === 'latvianSales' ? 'Oskars' : undefined
    };
    
    rows.push(salesRow);
  }
  
  console.log('[ETL] Sales transformed:', rows.length, 'valid,', Object.values(skipped).reduce((a, b) => a + b, 0), 'skipped');
  return { rows, skipped };
}

// ============================================================
// SALES TRANSFORMATION (SPIRITS&WINE)
// ============================================================

interface SpiritsWineConfig {
  nosaukumsCol: string;
  sumOfSkaitsCol: string;
  sumOfGMCol: string;
  atlikumiCol: string | null;
  weekEndDate: string;
  hasLWPW: boolean;
}

function transformSpiritsWineSales(data: Record<string, any>[], config: SpiritsWineConfig): { rows: SalesRow[]; skipped: SkipReason } {
  const rows: SalesRow[] = [];
  const skipped: SkipReason = {};
  
  console.log('[ETL] Transforming Spirits&Wine sales, input rows:', data.length, 'config:', config);
  
  // Calculate previous week date
  const pwDate = new Date(config.weekEndDate);
  pwDate.setDate(pwDate.getDate() - 7);
  const pwDateStr = pwDate.toISOString().split('T')[0];
  
  // Get column keys for PW (Previous Week) data
  const sampleRow = data[0];
  const allKeys = sampleRow ? Object.keys(sampleRow) : [];
  
  // Find PW column variants (.1 or _1)
  const sumOfSkaits1Key = allKeys.find(k => {
    const n = normalize(k);
    return n === 'sum of skaits.1' || n === 'sum of skaits_1';
  });
  
  const sumOfGM1Key = allKeys.find(k => {
    const n = normalize(k);
    return n === 'sum of gm.1' || n === 'sum of gm_1';
  });
  
  console.log('[ETL] Spirits&Wine PW columns:', { sumOfSkaits1Key, sumOfGM1Key });
  
  for (const row of data) {
    const productName = cleanString(row[config.nosaukumsCol]);
    
    // Skip invalid/summary rows using centralized check
    if (!productName || 
        normalize(productName) === 'false' || 
        isSummaryRow(productName)) {
      skipped['Invalid product name'] = (skipped['Invalid product name'] || 0) + 1;
      continue;
    }
    
    const stockEnd = config.atlikumiCol ? parseNumber(row[config.atlikumiCol]) : null;
    const lwUnits = parseNumber(row[config.sumOfSkaitsCol]);
    const lwGM = parseNumber(row[config.sumOfGMCol]);
    
    // Last Week (LW) - allow 0 values
    if (lwUnits !== null) {
      rows.push({
        SKU: null,
        Product_Name: productName,
        Week_End_Date: config.weekEndDate,
        Store_Code: null,
        Units_Sold: lwUnits,
        Net_Revenue: null,
        Gross_Margin: lwGM,
        Regular_Price: null,
        Promo_Price: null,
        Promo_Flag: null,
        Promo_Name: null,
        Stock_End: stockEnd,
        Period_Type: 'LW',
        Partner: 'Spirits&Wine'
      });
    }
    
    // Previous Week (PW) - if columns exist
    if (sumOfSkaits1Key && sumOfGM1Key) {
      const pwUnits = parseNumber(row[sumOfSkaits1Key]);
      const pwGM = parseNumber(row[sumOfGM1Key]);
      
      if (pwUnits !== null) {
        rows.push({
          SKU: null,
          Product_Name: productName,
          Week_End_Date: pwDateStr,
          Store_Code: null,
          Units_Sold: pwUnits,
          Net_Revenue: null,
          Gross_Margin: pwGM,
          Regular_Price: null,
          Promo_Price: null,
          Promo_Flag: null,
          Promo_Name: null,
          Stock_End: stockEnd,
          Period_Type: 'PW',
          Partner: 'Spirits&Wine'
        });
      }
    }
  }
  
  console.log('[ETL] Spirits&Wine sales transformed:', rows.length, 'valid,', Object.values(skipped).reduce((a, b) => a + b, 0), 'skipped');
  return { rows, skipped };
}

// ============================================================
// MAIN ETL FUNCTION
// ============================================================

export interface ETLOptions {
  contextYear?: number;
  weekEndDate?: string; // Override week end date for Spirits&Wine
}

/**
 * Main ETL function - processes raw data and returns structured result
 */
export function processETL(data: Record<string, any>[], options: ETLOptions = {}): ETLResult {
  console.log('[ETL] Processing', data.length, 'rows with options:', options);
  
  if (!data || data.length === 0) {
    console.log('[ETL] No data to process');
    return {
      type: 'unknown',
      rows: [],
      summary: { message: 'Fails ir tukšs vai nav atrasti dati.' }
    };
  }
  
  // Detect file type
  const detection = detectFileType(data, options.contextYear);
  console.log('[ETL] Detection result:', detection);
  
  if (detection.type === 'unknown') {
    return {
      type: 'unknown',
      rows: [],
      summary: { message: 'Neatpazīts faila formāts. Lūdzu izmantojiet nodrošinātos veidnes failus.' }
    };
  }
  
  // Process based on type
  if (detection.type === 'product') {
    const { rows, skipped } = transformProducts(data);
    
    return {
      type: 'product',
      rows,
      summary: {
        total_rows_input: data.length,
        total_rows_valid: rows.length,
        total_rows_skipped: Object.values(skipped).reduce((a, b) => a + b, 0),
        skipped_reasons: skipped,
        detected_format: detection.format
      }
    };
  }
  
  if (detection.type === 'sales') {
    // Handle Spirits&Wine format
    if (detection.format === 'spiritsWine' && detection.spiritsWineInfo) {
      const info = detection.spiritsWineInfo;
      const weekEndDate = options.weekEndDate || info.weekEndDate || new Date().toISOString().split('T')[0];
      
      const { rows, skipped } = transformSpiritsWineSales(data, {
        nosaukumsCol: info.nosaukumsCol!,
        sumOfSkaitsCol: info.sumOfSkaitsCol!,
        sumOfGMCol: info.sumOfGMCol!,
        atlikumiCol: info.atlikumiCol,
        weekEndDate,
        hasLWPW: info.hasLWPW
      });
      
      return {
        type: 'sales',
        rows,
        summary: {
          total_rows_input: data.length,
          total_rows_valid: rows.length,
          total_rows_skipped: Object.values(skipped).reduce((a, b) => a + b, 0),
          skipped_reasons: skipped,
          detected_format: 'Spirits&Wine LW/PW'
        }
      };
    }
    
    // Latvian sales format or generic sales format
    const formatName = detection.format === 'latvianSales' ? 'Latvian Sales (Oskars)' : 'Generic Sales';
    const { rows, skipped } = transformGenericSales(data, detection.format);
    
    return {
      type: 'sales',
      rows,
      summary: {
        total_rows_input: data.length,
        total_rows_valid: rows.length,
        total_rows_skipped: Object.values(skipped).reduce((a, b) => a + b, 0),
        skipped_reasons: skipped,
        detected_format: formatName
      }
    };
  }
  
  // Fallback - should not reach here
  return {
    type: 'unknown',
    rows: [],
    summary: { message: 'Neatpazīts faila formāts.' }
  };
}

/**
 * Quick detection function - just detects file type without full processing
 */
export function detectFileFormat(data: Record<string, any>[], contextYear?: number): { 
  type: FileType; 
  format: string | undefined;
  columns: string[];
  rowCount: number;
} {
  const detection = detectFileType(data, contextYear);
  return {
    type: detection.type,
    format: detection.format,
    columns: getColumns(data),
    rowCount: data.length
  };
}
