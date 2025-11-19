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
    // First, get all products to map SKUs to IDs
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
          product_id: productId,
          date: row.Date || row.date || new Date().toISOString().split('T')[0],
          quantity_sold: parseInt(row['Quantity Sold'] || row.quantity_sold || row.Quantity || 0),
          net_revenue: parseFloat(row['Net Revenue'] || row.net_revenue || row.Revenue || 0),
          channel: row.Channel || row.channel || 'store',
          discounts_applied: parseFloat(row.Discounts || row.discounts_applied || 0),
          promotion_flag: row['Promotion'] === 'Yes' || row.promotion_flag === true || false
        };
      })
      .filter(Boolean);

    const { error } = await supabase.from('sales').insert(sales);
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
    // Get competitors and products
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

        // Find or create mapping
        return {
          competitorId,
          productId,
          competitorPrice: parseFloat(row.Price || row.price || 0),
          date: row.Date || row.date || new Date().toISOString().split('T')[0],
          currency: row.Currency || row.currency || 'EUR',
          isOnPromo: row['Promo'] === 'Yes' || row.is_on_promo === true || false,
          inStock: row['In Stock'] !== 'No' && row.in_stock !== false
        };
      })
      .filter(Boolean);

    // First, create mappings if they don't exist
    for (const price of prices) {
      const { data: existingMapping } = await supabase
        .from('competitor_product_mapping')
        .select('id')
        .eq('competitor_id', price.competitorId)
        .eq('product_id', price.productId)
        .single();

      if (!existingMapping) {
        await supabase.from('competitor_product_mapping').insert({
          competitor_id: price.competitorId,
          product_id: price.productId
        });
      }
    }

    // Now get mappings and insert prices
    const { data: mappings } = await supabase
      .from('competitor_product_mapping')
      .select('id, competitor_id, product_id');

    const priceRecords = prices.map((price: any) => {
      const mapping = mappings?.find(
        m => m.competitor_id === price.competitorId && m.product_id === price.productId
      );

      return {
        mapping_id: mapping?.id,
        competitor_price: price.competitorPrice,
        date: price.date,
        currency: price.currency,
        is_on_promo: price.isOnPromo,
        in_stock: price.inStock
      };
    }).filter(p => p.mapping_id);

    const { error } = await supabase.from('competitor_prices').insert(priceRecords);
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
              <div className="text-sm space-y-1">
                <p className="font-semibold">Required columns:</p>
                <p className="text-xs">{getTemplateInfo().columns}</p>
                <p className="font-semibold mt-2">Example:</p>
                <p className="text-xs">{getTemplateInfo().example}</p>
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
