import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { Alert, AlertDescription } from "@/components/ui/alert";

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      previewFile(selectedFile);
    }
  };

  const previewFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        setPreview(jsonData.slice(0, 3) as any[]); // Show first 3 rows
      } catch (error) {
        console.error('Error previewing file:', error);
      }
    };
    reader.readAsArrayBuffer(file);
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

  const importProducts = async (data: any[]) => {
    const products = data.map((row: any) => ({
      sku: row.SKU || row.sku || '',
      name: row.Name || row.name || row.Product || row.product || '',
      brand: row.Brand || row.brand || null,
      category: row.Category || row.category || null,
      subcategory: row.Subcategory || row.subcategory || null,
      cost_price: parseFloat(row['Cost Price'] || row.cost_price || row.Cost || 0),
      current_price: parseFloat(row['Current Price'] || row.current_price || row.Price || 0),
      currency: row.Currency || row.currency || 'EUR',
      barcode: row.Barcode || row.barcode || row.EAN || null,
      vat_rate: parseFloat(row['VAT Rate'] || row.vat_rate || 0),
      is_private_label: row['Private Label'] === 'Yes' || row.is_private_label === true || false,
      status: 'active'
    }));

    const { error } = await supabase.from('products').insert(products);
    if (error) throw error;
    return products.length;
  };

  const importSales = async (data: any[]) => {
    // TODO: Get actual tenant_id and store_id from auth context
    const tempTenantId = '00000000-0000-0000-0000-000000000000';
    const tempStoreId = '00000000-0000-0000-0000-000000000000';
    
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, sku');
    
    if (productsError) throw productsError;

    const skuToId = new Map(products?.map(p => [p.sku, p.id]) || []);

    const sales = data
      .map((row: any) => {
        const sku = row.SKU || row.sku;
        const productId = skuToId.get(sku);
        
        if (!productId) {
          console.warn(`Product not found for SKU: ${sku}`);
          return null;
        }

        return {
          tenant_id: tempTenantId,
          store_id: tempStoreId,
          product_id: productId,
          date: row.Date || row.date || new Date().toISOString().split('T')[0],
          units_sold: parseInt(row['Quantity Sold'] || row.quantity_sold || row.Quantity || 0),
          revenue: parseFloat(row['Net Revenue'] || row.net_revenue || row.Revenue || 0),
          regular_price: parseFloat(row['Regular Price'] || row.regular_price || 0),
          promo_flag: row['Promotion'] === 'Yes' || row.promotion_flag === true || false,
          promotion_id: null
        };
      })
      .filter(Boolean);

    const { error } = await supabase.from('sales_daily').insert(sales as any);
    if (error) throw error;
    return sales.length;
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
        title: "No File Selected",
        description: "Please select a file to import",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const data = await parseExcelFile(file);
      
      let count = 0;
      switch (importType) {
        case 'products':
          count = await importProducts(data);
          break;
        case 'sales':
          count = await importSales(data);
          break;
        case 'competitors':
          count = await importCompetitors(data);
          break;
        case 'competitor_prices':
          count = await importCompetitorPrices(data);
          break;
      }

      toast({
        title: "Import Successful",
        description: `Imported ${count} records successfully`,
      });

      setOpen(false);
      setFile(null);
      setPreview([]);
      onImportComplete?.();
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import data",
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
          columns: 'SKU, Name, Brand, Category, Cost Price, Current Price, Currency, Barcode, VAT Rate, Private Label',
          example: 'PROD001, Product Name, Brand A, Electronics, 50.00, 79.99, EUR, 1234567890, 19, No'
        };
      case 'sales':
        return {
          columns: 'SKU, Date, Quantity Sold, Net Revenue, Channel, Discounts, Promotion',
          example: 'PROD001, 2024-01-15, 5, 399.95, online, 0, No'
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
        headers = ['SKU', 'Name', 'Brand', 'Category', 'Subcategory', 'Cost Price', 'Current Price', 'Currency', 'Barcode', 'VAT Rate', 'Private Label'];
        sampleData = [
          ['PROD001', 'Wireless Mouse', 'TechBrand', 'Electronics', 'Accessories', 15.00, 29.99, 'EUR', '1234567890123', 21, 'No'],
          ['PROD002', 'USB Cable 2m', 'TechBrand', 'Electronics', 'Cables', 2.50, 9.99, 'EUR', '1234567890124', 21, 'Yes']
        ];
        break;
      case 'sales':
        headers = ['SKU', 'Date', 'Quantity Sold', 'Net Revenue', 'Channel', 'Discounts', 'Promotion'];
        sampleData = [
          ['PROD001', '2024-01-15', 5, 149.95, 'online', 0, 'No'],
          ['PROD002', '2024-01-15', 12, 119.88, 'store', 10.00, 'Yes']
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

          {preview.length > 0 && (
            <div className="space-y-2">
              <Label>Preview (first 3 rows)</Label>
              <div className="border rounded-md p-2 bg-muted/50 overflow-x-auto text-xs">
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
