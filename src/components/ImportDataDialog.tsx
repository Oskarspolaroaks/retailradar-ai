import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { processETL, detectFileFormat, type ETLResult, type ProductRow, type SalesRow } from "@/lib/etlEngine";
interface ImportDataDialogProps {
  onImportComplete?: () => void;
}

type ImportType = 'products' | 'sales' | 'competitor_prices' | 'competitors';

export const ImportDataDialog = ({ onImportComplete }: ImportDataDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [importType, setImportType] = useState<ImportType>('products');
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<{ type: string; format: string | undefined; columns: string[]; rowCount: number } | null>(null);
  const [etlResult, setEtlResult] = useState<ETLResult | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      await analyzeFile(selectedFile);
    }
  };

  const analyzeFile = async (file: File) => {
    try {
      const data = await parseExcelFile(file);
      console.log('[Import] Analyzing file, rows:', data.length);
      
      // Use ETL engine to detect file type
      const detection = detectFileFormat(data);
      setDetectedFormat(detection);
      
      // Preview first 3 rows
      setPreview(data.slice(0, 3));
      
      // Run full ETL processing for preview
      const result = processETL(data);
      setEtlResult(result);
      
      console.log('[Import] ETL result:', result.type, 'valid rows:', result.type !== 'unknown' ? result.summary.total_rows_valid : 0);
      
      if (result.type !== 'unknown') {
        const summary = result.summary as { total_rows_valid: number; detected_format?: string };
        toast({
          title: "Datne analizēta",
          description: `Atpazīts formāts: ${summary.detected_format || result.type}. Derīgas rindas: ${summary.total_rows_valid}`,
        });
        
        // Auto-select import type based on detection
        if (result.type === 'product') {
          setImportType('products');
        } else if (result.type === 'sales') {
          setImportType('sales');
        }
      } else {
        toast({
          title: "Neatpazīts formāts",
          description: result.summary.message || "Lūdzu pārbaudiet faila struktūru",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('[Import] Error analyzing file:', error);
      setDetectedFormat(null);
      setEtlResult(null);
      toast({
        title: "Kļūda lasot datni",
        description: error.message || "Neizdevās nolasīt failu",
        variant: "destructive",
      });
    }
  };

  const parseExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const importProductsFromETL = async (rows: ProductRow[]) => {
    console.log('[Import] Importing products from ETL, rows:', rows.length);
    
    const products = rows.map((row) => ({
      sku: row.SKU,
      name: row.Product_Name,
      barcode: row.EAN,
      brand: row.Brand,
      category: row.Category,
      subcategory: row.Subcategory,
      cost_price: row.Cost_Price || 0,
      current_price: row.Current_Price || 0,
      currency: 'EUR',
      vat_rate: row.VAT_Rate || 21,
      is_private_label: row.Private_Label || false,
      status: row.Status?.toLowerCase() === 'delisted' ? 'inactive' : 'active'
    }));

    if (products.length === 0) {
      throw new Error('Nav atrasti derīgi produktu ieraksti failā');
    }

    const { error } = await supabase.from('products').insert(products);
    if (error) throw error;
    return products.length;
  };

  const importSalesFromETL = async (rows: SalesRow[]) => {
    console.log('[Sales Import ETL] Starting import, total rows:', rows.length);
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Jums jābūt autorizētam');

    const { data: userTenant } = await supabase
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (!userTenant?.tenant_id) throw new Error('Nav atrasta organizācija');
    const tenantId = userTenant.tenant_id;
    console.log('[Sales Import ETL] Tenant ID:', tenantId);

    const { data: existingStore } = await supabase.from('stores').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle();
    let storeId = existingStore?.id;
    if (!storeId) {
      const { data: newStore } = await supabase.from('stores').insert({ tenant_id: tenantId, name: 'Noklusējuma veikals', code: 'DEFAULT', is_active: true }).select('id').single();
      storeId = newStore?.id;
    }
    console.log('[Sales Import ETL] Store ID:', storeId);

    const { data: products } = await supabase.from('products').select('id, sku, name').eq('tenant_id', tenantId);
    console.log('[Sales Import ETL] Available products for matching:', products?.length || 0);
    
    const skuToId = new Map(products?.map(p => [p.sku?.toLowerCase(), p.id]) || []);
    const nameToId = new Map(products?.map(p => [p.name?.toLowerCase(), p.id]) || []);

    let matchedCount = 0;
    let unmatchedCount = 0;
    
    // Process ALL rows - don't filter out unmatched ones
    const sales = rows.map((row) => {
      let productId = row.SKU ? skuToId.get(row.SKU.toLowerCase()) : null;
      if (!productId && row.Product_Name) productId = nameToId.get(row.Product_Name.toLowerCase());
      
      if (productId) {
        matchedCount++;
      } else {
        unmatchedCount++;
      }
      
      return {
        tenant_id: tenantId,
        store_id: storeId,
        product_id: productId || null,
        date: row.Week_End_Date,
        units_sold: row.Units_Sold || 0,
        revenue: row.Net_Revenue || 0,
        regular_price: row.Regular_Price,
        promo_flag: row.Promo_Flag || false,
        promotion_id: null
      };
    });
    
    console.log('[Sales Import ETL] Matched:', matchedCount, 'Unmatched:', unmatchedCount, 'Total:', sales.length);

    if (sales.length === 0) {
      throw new Error('Nav derīgu pārdošanas ierakstu importēšanai');
    }

    const batchSize = 500;
    let insertedCount = 0;
    let failedBatches = 0;
    
    for (let i = 0; i < sales.length; i += batchSize) {
      const batch = sales.slice(i, i + batchSize);
      console.log(`[Sales Import ETL] Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(sales.length / batchSize)}, records: ${batch.length}`);
      
      const { data, error } = await supabase.from('sales_daily').insert(batch as any).select('id');
      if (error) {
        console.error('[Sales Import ETL] Batch error:', error);
        failedBatches++;
      } else {
        insertedCount += data?.length || batch.length;
      }
    }
    
    console.log('[Sales Import ETL] Complete. Inserted:', insertedCount, 'Failed batches:', failedBatches);
    
    let warning: string | undefined;
    if (failedBatches > 0) {
      warning = `Importēti ${insertedCount}/${rows.length} ieraksti. ${failedBatches} partijas neizdevās.`;
    } else if (unmatchedCount > 0) {
      warning = `Importēti ${insertedCount} ieraksti. ${matchedCount} ar produktu sasaisti, ${unmatchedCount} bez sasaistes.`;
    }
    
    return { count: insertedCount, warning };
  };

  const handleRawImport = async (data: any[], type: ImportType) => {
    switch (type) {
      case 'products': return await importProducts(data);
      case 'sales': return (await importSales(data)).count;
      case 'competitors': return await importCompetitors(data);
      case 'competitor_prices': return await importCompetitorPrices(data);
      default: return 0;
    }
  };

  const importProducts = async (data: any[]) => {
    const products = data
      .filter((row: any) => {
        // Skip empty rows
        const sku = row.SKU || row.sku || '';
        const name = row.Product_Name || row.Name || row.name || row.Product || row.product || '';
        return sku.toString().trim() !== '' && name.toString().trim() !== '';
      })
      .map((row: any) => ({
        sku: (row.SKU || row.sku || '').toString().trim(),
        name: (row.Product_Name || row.Name || row.name || row.Product || row.product || '').toString().trim(),
        barcode: row.EAN || row.Barcode || row.barcode || null,
        brand: row.Brand || row.brand || null,
        category: row.Category || row.category || null,
        subcategory: row.Subcategory || row.subcategory || null,
        cost_price: parseFloat(row.Cost_Price || row['Cost Price'] || row.cost_price || row.Cost || 0),
        current_price: parseFloat(row.Current_Price || row['Current Price'] || row.current_price || row.Price || 0),
        currency: 'EUR',
        vat_rate: parseFloat(row.VAT_Rate || row['VAT Rate'] || row.vat_rate || 21),
        is_private_label: row.Private_Label === 'Yes' || row['Private Label'] === 'Yes' || row.is_private_label === true || row.Private_Label === 'Jā' || false,
        status: (row.Status || row.status || 'active').toString().toLowerCase() === 'delisted' ? 'inactive' : 'active'
      }));

    if (products.length === 0) {
      throw new Error('Nav atrasti derīgi produktu ieraksti failā');
    }

    const { error } = await supabase.from('products').insert(products);
    if (error) throw error;
    return products.length;
  };

  const importSales = async (data: any[]) => {
    console.log('[Sales Import] Starting import, rows to process:', data.length);
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Jums jābūt autorizētam, lai importētu pārdošanas datus');
    }
    console.log('[Sales Import] User authenticated:', user.id);

    // Get tenant_id from user_tenants
    const { data: userTenant, error: tenantError } = await supabase
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (tenantError) {
      console.error('[Sales Import] Tenant lookup error:', tenantError);
      throw new Error('Neizdevās atrast jūsu organizāciju: ' + tenantError.message);
    }
    
    if (!userTenant?.tenant_id) {
      throw new Error('Jums nav piešķirta organizācija. Lūdzu sazinieties ar administratoru.');
    }
    
    const tenantId = userTenant.tenant_id;
    console.log('[Sales Import] Tenant ID:', tenantId);

    // Get or create a default store for this tenant
    let storeId: string;
    const { data: existingStore, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    
    if (storeError) {
      console.error('[Sales Import] Store lookup error:', storeError);
      throw new Error('Neizdevās atrast veikalu: ' + storeError.message);
    }

    if (existingStore) {
      storeId = existingStore.id;
      console.log('[Sales Import] Using existing store:', storeId);
    } else {
      // Create a default store
      const { data: newStore, error: createStoreError } = await supabase
        .from('stores')
        .insert({
          tenant_id: tenantId,
          name: 'Noklusējuma veikals',
          code: 'DEFAULT',
          is_active: true
        })
        .select('id')
        .single();
      
      if (createStoreError || !newStore) {
        console.error('[Sales Import] Store creation error:', createStoreError);
        throw new Error('Neizdevās izveidot veikalu: ' + (createStoreError?.message || 'Nezināma kļūda'));
      }
      storeId = newStore.id;
      console.log('[Sales Import] Created new store:', storeId);
    }

    // Get products for SKU mapping (filter by tenant)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, sku')
      .eq('tenant_id', tenantId);
    
    if (productsError) {
      console.error('[Sales Import] Products lookup error:', productsError);
      throw new Error('Neizdevās ielādēt produktus: ' + productsError.message);
    }

    console.log('[Sales Import] Found products for tenant:', products?.length || 0);
    const skuToId = new Map(products?.map(p => [p.sku, p.id]) || []);

    // Parse ALL sales rows - DO NOT filter out unmatched SKUs
    console.log('[Sales Import] Processing ALL', data.length, 'rows from file');
    
    let matchedCount = 0;
    let unmatchedCount = 0;
    let skippedEmpty = 0;
    
    const sales = data
      .map((row: any, index: number) => {
        const sku = row.SKU || row.sku;
        
        // Only skip truly empty rows (no SKU AND no meaningful data)
        const unitsSold = parseInt(row.Units_Sold || row['Quantity Sold'] || row.quantity_sold || row.Quantity || row.Skaits || 0);
        const revenue = parseFloat(row.Net_Revenue || row['Net Revenue'] || row.net_revenue || row.Revenue || row.Ieņēmumi || 0);
        
        if ((!sku || sku.toString().trim() === '') && unitsSold === 0 && revenue === 0) {
          skippedEmpty++;
          return null;
        }
        
        // Try to match product but DON'T skip if no match
        const productId = sku ? skuToId.get(sku.toString().trim()) : null;
        
        if (productId) {
          matchedCount++;
        } else {
          unmatchedCount++;
          if (index < 10) {
            console.log(`[Sales Import] Row ${index + 1}: No product match for SKU: ${sku || '(empty)'} - will import anyway`);
          }
        }

        // Handle date with new column name Week_End_Date
        const dateValue = row.Week_End_Date || row.Date || row.date || row.Datums;
        let parsedDate: string;
        if (dateValue instanceof Date) {
          parsedDate = dateValue.toISOString().split('T')[0];
        } else if (typeof dateValue === 'number') {
          // Excel serial date
          const excelDate = new Date((dateValue - 25569) * 86400 * 1000);
          parsedDate = excelDate.toISOString().split('T')[0];
        } else if (typeof dateValue === 'string') {
          parsedDate = dateValue;
        } else {
          parsedDate = new Date().toISOString().split('T')[0];
        }

        // Handle new column names
        const regularPrice = parseFloat(row.Regular_Price || row['Regular Price'] || row.regular_price || row.Cena || 0) || null;
        const promoFlag = row.Promo_Flag === 'Yes' || row['Promo_Flag'] === 'Yes' || row['Promotion'] === 'Yes' || row.promotion_flag === true || row.Akcija === 'Jā' || false;

        return {
          tenant_id: tenantId,
          store_id: storeId,
          product_id: productId || null, // Allow null product_id
          date: parsedDate,
          units_sold: isNaN(unitsSold) ? 0 : unitsSold,
          revenue: isNaN(revenue) ? 0 : revenue,
          regular_price: regularPrice,
          promo_flag: promoFlag,
          promotion_id: null
        };
      })
      .filter(Boolean);

    console.log('[Sales Import] Processing summary:');
    console.log('  - Total rows in file:', data.length);
    console.log('  - Valid sales records:', sales.length);
    console.log('  - Matched to products:', matchedCount);
    console.log('  - Unmatched (will import):', unmatchedCount);
    console.log('  - Empty rows skipped:', skippedEmpty);

    if (sales.length === 0) {
      throw new Error('Nav derīgu ierakstu importēšanai. Pārbaudiet faila formātu.');
    }

    // Insert in batches of 500
    const batchSize = 500;
    let insertedCount = 0;
    let failedBatches = 0;
    
    for (let i = 0; i < sales.length; i += batchSize) {
      const batch = sales.slice(i, i + batchSize);
      console.log(`[Sales Import] Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(sales.length / batchSize)}, records: ${batch.length}`);
      
      const { error: insertError, data: insertedData } = await supabase
        .from('sales_daily')
        .insert(batch as any)
        .select('id');
      
      if (insertError) {
        console.error('[Sales Import] Batch insert error:', insertError);
        failedBatches++;
        // Continue with next batch instead of failing completely
      } else {
        insertedCount += insertedData?.length || batch.length;
        console.log(`[Sales Import] Batch inserted, total so far: ${insertedCount}`);
      }
    }

    console.log('[Sales Import] Import completed:');
    console.log('  - Total inserted:', insertedCount);
    console.log('  - Failed batches:', failedBatches);
    
    let warning: string | undefined;
    if (failedBatches > 0) {
      warning = `Importēti ${insertedCount}/${sales.length} ieraksti. ${failedBatches} partijas neizdevās.`;
    } else if (unmatchedCount > 0) {
      warning = `Importēti ${insertedCount} ieraksti. ${matchedCount} ar produktu sasaisti, ${unmatchedCount} bez sasaistes (var kartēt vēlāk).`;
    }
    
    return { 
      count: insertedCount, 
      warning
    };
  };

  const importCompetitors = async (data: any[]) => {
    const competitors = data.map((row: any) => ({
      name: row.Name || row.name || '',
      website_url: row.Website || row.website_url || row.URL || null,
      type: row.Type || row.type || null,
      country: row.Country || row.country || null,
      notes: row.Notes || row.notes || null
    }));

    const { error } = await supabase.from('competitors').insert(competitors);
    if (error) throw error;
    return competitors.length;
  };

  const importCompetitorPrices = async (data: any[]) => {
    // TODO: Get actual tenant_id from auth context
    const tempTenantId = '00000000-0000-0000-0000-000000000000';
    
    const { data: competitors } = await supabase.from('competitors').select('id, name');
    const { data: products } = await supabase.from('products').select('id, sku');

    const competitorMap = new Map(competitors?.map(c => [c.name.toLowerCase(), c.id]) || []);
    const skuMap = new Map(products?.map(p => [p.sku, p.id]) || []);

    const prices = data
      .map((row: any) => {
        const competitorName = (row['Competitor'] || row.competitor || '').toLowerCase();
        const sku = row.SKU || row.sku;
        
        const competitorId = competitorMap.get(competitorName);
        const productId = skuMap.get(sku);

        if (!competitorId || !productId) {
          console.warn(`Mapping not found for: ${competitorName} / ${sku}`);
          return null;
        }

        return {
          competitorId,
          productId,
          competitorSku: row['Competitor SKU'] || row.competitor_sku || null,
          competitorName: row['Competitor Product Name'] || row.competitor_name || 'Unknown',
          competitorPrice: parseFloat(row.Price || row.price || 0),
          date: row.Date || row.date || new Date().toISOString().split('T')[0],
          isOnPromo: row['Promo'] === 'Yes' || row.is_on_promo === true || false
        };
      })
      .filter(Boolean);

    // First, ensure competitor_products exist
    const uniqueMappings = new Map();
    prices.forEach(p => {
      const key = `${p.competitorId}-${p.productId}`;
      if (!uniqueMappings.has(key)) {
        uniqueMappings.set(key, {
          tenant_id: tempTenantId,
          competitor_id: p.competitorId,
          our_product_id: p.productId,
          competitor_sku: p.competitorSku,
          competitor_name: p.competitorName
        });
      }
    });

    const mappingsToInsert = Array.from(uniqueMappings.values());
    const { data: insertedMappings } = await supabase
      .from('competitor_products')
      .upsert(mappingsToInsert as any, { onConflict: 'competitor_id,our_product_id' })
      .select('id, competitor_id, our_product_id') as any;

    // Now get all mappings and insert prices
    const { data: allMappings } = await supabase
      .from('competitor_products')
      .select('id, competitor_id, our_product_id') as any;

    const priceRecords = prices.map((price: any) => {
      const mapping = allMappings?.find(
        m => m.competitor_id === price.competitorId && m.our_product_id === price.productId
      );

      return {
        tenant_id: tempTenantId,
        competitor_product_id: mapping?.id,
        date: price.date,
        price: price.competitorPrice,
        promo_flag: price.isOnPromo,
        note: null
      };
    }).filter(p => p.competitor_product_id);

    const { error } = await supabase.from('competitor_price_history').insert(priceRecords as any);
    if (error) throw error;
    return priceRecords.length;
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Nav izvēlēts fails",
        description: "Lūdzu izvēlieties failu importēšanai",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    console.log('[Import] Starting import, type:', importType, 'file:', file.name, 'ETL result:', etlResult?.type);
    
    try {
      let count = 0;
      let warning: string | undefined;
      
      // Use ETL result if available and matching the import type
      if (etlResult && etlResult.type !== 'unknown') {
        if (etlResult.type === 'product' && importType === 'products') {
          console.log('[Import] Using ETL processed products');
          count = await importProductsFromETL(etlResult.rows);
          const summary = etlResult.summary as { total_rows_skipped: number; skipped_reasons: Record<string, number> };
          if (summary.total_rows_skipped > 0) {
            warning = `Importēti ${count} produkti. Izlaisti ${summary.total_rows_skipped} ieraksti.`;
          }
        } else if (etlResult.type === 'sales' && importType === 'sales') {
          console.log('[Import] Using ETL processed sales');
          const salesResult = await importSalesFromETL(etlResult.rows);
          count = salesResult.count;
          warning = salesResult.warning;
        } else {
          // Fallback to raw import for non-matching types
          const data = await parseExcelFile(file);
          count = await handleRawImport(data, importType);
        }
      } else {
        // Fallback to traditional import
        const data = await parseExcelFile(file);
        if (data.length === 0) {
          throw new Error('Fails ir tukšs vai neizdevās nolasīt datus');
        }
        count = await handleRawImport(data, importType);
      }

      console.log('[Import] Completed, count:', count);

      toast({
        title: "Imports veiksmīgs",
        description: warning || `Importēti ${count} ieraksti`,
        variant: warning ? "default" : "default",
      });

      setOpen(false);
      setFile(null);
      setPreview([]);
      onImportComplete?.();
    } catch (error: any) {
      console.error('[Import] Error:', error);
      toast({
        title: "Importēšanas kļūda",
        description: error.message || "Neizdevās importēt datus. Pārbaudiet konsoli.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const getTemplateInfo = () => {
    switch (importType) {
      case 'products':
        return {
          columns: 'SKU, Product_Name, EAN, Brand, Category, Subcategory, Country, Volume, Volume_Unit, ABV, Cost_Price, Current_Price, VAT_Rate, Private_Label, Status',
          example: '123456, Sample White Wine 0.75L, 4750123456789, SampleBrand, Wine, White Wine, Latvia, 0.75, L, 12.5, 4.20, 7.99, 21, No, Active'
        };
      case 'sales':
        return {
          columns: 'SKU, Week_End_Date, Store_Code, Units_Sold, Net_Revenue, Gross_Margin, Regular_Price, Promo_Price, Promo_Flag, Promo_Name, Stock_End',
          example: '123456, 2024-11-24, RIGA01, 42, 320.50, 95.20, 8.99, 7.49, Yes, Weekend -20%, 15'
        };
      case 'competitors':
        return {
          columns: 'Name, Website, Type, Country, Notes',
          example: 'Competitor Store, https://example.com, online, Latvia, Active competitor'
        };
      case 'competitor_prices':
        return {
          columns: 'Competitor, SKU, Date, Price, Currency, Promo, In Stock',
          example: 'Competitor Name, PROD001, 2024-01-15, 75.99, EUR, No, Yes'
        };
    }
  };

  const downloadTemplate = () => {
    let headers: string[] = [];
    let sampleData: any[][] = [];

    switch (importType) {
      case 'products':
        headers = ['SKU', 'Product_Name', 'EAN', 'Brand', 'Category', 'Subcategory', 'Country', 'Volume', 'Volume_Unit', 'ABV', 'Cost_Price', 'Current_Price', 'VAT_Rate', 'Private_Label', 'Status'];
        sampleData = [
          ['123456', 'Sample White Wine 0.75L', '4750123456789', 'SampleBrand', 'Wine', 'White Wine', 'Latvia', 0.75, 'L', 12.5, 4.20, 7.99, 21, 'No', 'Active'],
          ['123457', 'Premium Red Wine 0.75L', '4750123456790', 'SampleBrand', 'Wine', 'Red Wine', 'France', 0.75, 'L', 13.5, 6.50, 12.99, 21, 'No', 'Active'],
          ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
        ];
        break;
      case 'sales':
        headers = ['SKU', 'Week_End_Date', 'Store_Code', 'Units_Sold', 'Net_Revenue', 'Gross_Margin', 'Regular_Price', 'Promo_Price', 'Promo_Flag', 'Promo_Name', 'Stock_End'];
        sampleData = [
          ['123456', '2024-11-24', 'RIGA01', 42, 320.50, 95.20, 8.99, 7.49, 'Yes', 'Weekend -20%', 15],
          ['123457', '2024-11-24', 'RIGA01', 18, 143.82, 42.50, 7.99, '', 'No', '', 8],
          ['', '', '', '', '', '', '', '', '', '', '']
        ];
        break;
      case 'competitors':
        headers = ['Name', 'Website', 'Type', 'Country', 'Notes'];
        sampleData = [
          ['TechStore Online', 'https://techstore.com', 'online', 'Latvia', 'Main competitor in electronics'],
          ['Local Electronics', 'https://localelectronics.lv', 'hybrid', 'Latvia', 'Physical stores + online']
        ];
        break;
      case 'competitor_prices':
        headers = ['Competitor', 'SKU', 'Date', 'Price', 'Currency', 'Promo', 'In Stock'];
        sampleData = [
          ['TechStore Online', 'PROD001', '2024-01-15', 27.99, 'EUR', 'No', 'Yes'],
          ['Local Electronics', 'PROD001', '2024-01-15', 32.99, 'EUR', 'Yes', 'Yes']
        ];
        break;
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    const wsData = [headers, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    // Generate file and download
    const fileName = `${importType}_template.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: "Template Downloaded",
      description: `Sample template for ${importType} has been downloaded`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Data from Excel/CSV</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file to import products, sales, or competitor prices
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-type">Data Type</Label>
            <Select value={importType} onValueChange={(value: ImportType) => setImportType(value)}>
              <SelectTrigger id="import-type">
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="products">Products</SelectItem>
                <SelectItem value="sales">Sales Data</SelectItem>
                <SelectItem value="competitors">Competitors</SelectItem>
                <SelectItem value="competitor_prices">Competitor Prices</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              <div className="text-sm space-y-2">
                <div>
                  <p className="font-semibold">Required columns:</p>
                  <p className="text-xs">{getTemplateInfo().columns}</p>
                  <p className="font-semibold mt-2">Example:</p>
                  <p className="text-xs">{getTemplateInfo().example}</p>
                </div>
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm" 
                  onClick={downloadTemplate}
                  className="w-full"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download Sample Template
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="file-upload">Select File</Label>
            <input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {etlResult && etlResult.type !== 'unknown' && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{(etlResult.summary as any).detected_format || etlResult.type}</Badge>
                  <span className="text-sm">Derīgas rindas: {(etlResult.summary as any).total_rows_valid} / {(etlResult.summary as any).total_rows_input}</span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {etlResult && etlResult.type === 'unknown' && (
            <Alert className="border-destructive/50 bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription>
                <span className="text-sm">{etlResult.summary.message}</span>
              </AlertDescription>
            </Alert>
          )}

          {preview.length > 0 && (
            <div className="space-y-2">
              <Label>Priekšskatījums (pirmās 3 rindas)</Label>
              <div className="border rounded-md p-2 bg-muted/50 overflow-x-auto text-xs max-h-32">
                <pre className="whitespace-pre-wrap">
                  {preview.map((row, i) => JSON.stringify(row, null, 2)).join('\n---\n')}
                </pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || isImporting}>
            {isImporting ? "Importing..." : "Import Data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
