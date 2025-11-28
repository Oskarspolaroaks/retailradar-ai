import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WeeklySalesImportDialogProps {
  onImportComplete?: () => void;
}

type SpiritsWineRow = {
  Nosaukums: string | null;
  ["Sum of Skaits"]: number | null;
  ["Sum of GM"]: number | null;
  ["Nosaukums.1"]?: string | null;
  ["Sum of Skaits.1"]?: number | null;
  ["Sum of GM.1"]?: number | null;
  ["Atlikumi 24.11"]?: number | null;
};

type WeeklySale = {
  partner: string;
  product_name: string;
  period_type: "LW" | "PW";
  week_end: string;
  units_sold: number;
  gross_margin: number;
  stock_end?: number | null;
};

type ProductMapping = {
  product_name: string;
  product_id: string | null;
  action: 'map' | 'create' | 'skip';
  new_sku?: string;
  new_cost_price?: number;
  new_current_price?: number;
};

export const WeeklySalesImportDialog = ({ onImportComplete }: WeeklySalesImportDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'mapping'>('upload');
  const [weekEnd, setWeekEnd] = useState<string>(new Date().toISOString().split('T')[0]);
  const [parsedData, setParsedData] = useState<WeeklySale[]>([]);
  const [existingProducts, setExistingProducts] = useState<any[]>([]);
  const [mappings, setMappings] = useState<Map<string, ProductMapping>>(new Map());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const transformSpiritsWine = (rows: SpiritsWineRow[], weekEnd: string): WeeklySale[] => {
    const result: WeeklySale[] = [];

    for (const row of rows) {
      const name = row.Nosaukums?.toString().trim();

      if (!name || name === "False" || name === "(blank)" || name === "Grand Total") {
        continue;
      }

      const stockEnd = row["Atlikumi 24.11"] ?? null;

      // Last Week (LW)
      if (row["Sum of Skaits"] && row["Sum of GM"] != null) {
        result.push({
          partner: "Spirits&Wine",
          product_name: name,
          period_type: "LW",
          week_end: weekEnd,
          units_sold: Number(row["Sum of Skaits"]),
          gross_margin: Number(row["Sum of GM"]),
          stock_end: stockEnd,
        });
      }

      // Previous Week (PW)
      if (row["Sum of Skaits.1"] && row["Sum of GM.1"] != null) {
        result.push({
          partner: "Spirits&Wine",
          product_name: name,
          period_type: "PW",
          week_end: weekEnd,
          units_sold: Number(row["Sum of Skaits.1"]),
          gross_margin: Number(row["Sum of GM.1"]),
          stock_end: stockEnd,
        });
      }
    }

    return result;
  };

  const handleParseFile = async () => {
    if (!file) return;

    setIsImporting(true);
    try {
      const data = await parseExcelFile(file);
      const transformed = transformSpiritsWine(data, weekEnd);
      setParsedData(transformed);

      // Fetch existing products
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, sku, current_price, cost_price');

      if (error) throw error;
      setExistingProducts(products || []);

      // Initialize mappings
      const uniqueProductNames = [...new Set(transformed.map(s => s.product_name))];
      const newMappings = new Map<string, ProductMapping>();

      for (const productName of uniqueProductNames) {
        const existingProduct = products?.find(p => 
          p.name.toLowerCase() === productName.toLowerCase()
        );

        newMappings.set(productName, {
          product_name: productName,
          product_id: existingProduct?.id || null,
          action: existingProduct ? 'map' : 'create',
          new_sku: existingProduct ? undefined : `SW-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          new_cost_price: 0,
          new_current_price: 0,
        });
      }

      setMappings(newMappings);
      setStep('mapping');
      
      toast({
        title: "Datne apstrādāta",
        description: `Atrasti ${transformed.length} ieraksti ar ${uniqueProductNames.length} unikāliem produktiem.`,
      });
    } catch (error: any) {
      console.error('Error parsing file:', error);
      toast({
        title: "Kļūda",
        description: error.message || "Neizdevās apstrādāt datni",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const parseExcelFile = async (file: File): Promise<SpiritsWineRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData as SpiritsWineRow[]);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const updateMapping = (productName: string, updates: Partial<ProductMapping>) => {
    const current = mappings.get(productName);
    if (current) {
      setMappings(new Map(mappings.set(productName, { ...current, ...updates })));
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      // Get tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nav autorizēts');

      const { data: userTenant } = await supabase
        .from('user_tenants')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!userTenant) throw new Error('Tenant nav atrasts');
      const tenantId = userTenant.tenant_id;

      // Create new products where needed
      const productsToCreate = Array.from(mappings.values())
        .filter(m => m.action === 'create');

      if (productsToCreate.length > 0) {
        const { data: newProducts, error: createError } = await supabase
          .from('products')
          .insert(
            productsToCreate.map(m => ({
              sku: m.new_sku!,
              name: m.product_name,
              cost_price: m.new_cost_price!,
              current_price: m.new_current_price!,
              status: 'active',
              currency: 'EUR',
            }))
          )
          .select();

        if (createError) throw createError;

        // Update mappings with new product IDs
        newProducts?.forEach((product, index) => {
          const mapping = productsToCreate[index];
          updateMapping(mapping.product_name, { product_id: product.id });
        });
      }

      // Prepare weekly sales records
      const salesRecords = parsedData
        .filter(sale => {
          const mapping = mappings.get(sale.product_name);
          return mapping && mapping.action !== 'skip' && mapping.product_id;
        })
        .map(sale => {
          const mapping = mappings.get(sale.product_name)!;
          return {
            tenant_id: tenantId,
            partner: sale.partner,
            product_id: mapping.product_id,
            product_name: sale.product_name,
            period_type: sale.period_type,
            week_end: sale.week_end,
            units_sold: sale.units_sold,
            gross_margin: sale.gross_margin,
            stock_end: sale.stock_end,
            mapped: true,
          };
        });

      const { error: insertError } = await supabase
        .from('weekly_sales')
        .insert(salesRecords);

      if (insertError) throw insertError;

      toast({
        title: "Imports veiksmīgs",
        description: `Importēti ${salesRecords.length} nedēļas pārdošanas ieraksti.`,
      });

      setOpen(false);
      setStep('upload');
      setFile(null);
      setParsedData([]);
      setMappings(new Map());
      onImportComplete?.();
    } catch (error: any) {
      console.error('Error importing:', error);
      toast({
        title: "Kļūda",
        description: error.message || "Neizdevās importēt datus",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const unmappedCount = Array.from(mappings.values()).filter(m => m.action === 'create').length;
  const skipCount = Array.from(mappings.values()).filter(m => m.action === 'skip').length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Importēt Nedēļas Pārdošanu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importēt Spirits&Wine Nedēļas Pārdošanu</DialogTitle>
          <DialogDescription>
            Augšupielādējiet Excel datni ar Spirits&Wine pārdošanas datiem
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="week-end">Nedēļas Beigu Datums</Label>
              <Input
                id="week-end"
                type="date"
                value={weekEnd}
                onChange={(e) => setWeekEnd(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="file">Excel Datne</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="mt-1"
              />
              {file && (
                <Alert className="mt-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertDescription>
                    Izvēlēta datne: {file.name}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Produktu Kartēšana</CardTitle>
                <CardDescription>
                  Kartējiet importētos produktus uz esošiem vai izveidojiet jaunus
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex gap-4 text-sm">
                    <Badge variant="default">{mappings.size - unmappedCount - skipCount} Kartēti</Badge>
                    <Badge variant="secondary">{unmappedCount} Jauni</Badge>
                    <Badge variant="outline">{skipCount} Izlaisti</Badge>
                  </div>
                </div>

                <div className="rounded-md border max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produkta Nosaukums</TableHead>
                        <TableHead>Darbība</TableHead>
                        <TableHead>Kartēt uz</TableHead>
                        <TableHead>SKU (jauniem)</TableHead>
                        <TableHead>Izmaksu Cena</TableHead>
                        <TableHead>Pārdošanas Cena</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from(mappings.values()).map((mapping) => (
                        <TableRow key={mapping.product_name}>
                          <TableCell className="font-medium">{mapping.product_name}</TableCell>
                          <TableCell>
                            <Select
                              value={mapping.action}
                              onValueChange={(value) => 
                                updateMapping(mapping.product_name, { action: value as any })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="map">Kartēt</SelectItem>
                                <SelectItem value="create">Izveidot</SelectItem>
                                <SelectItem value="skip">Izlaist</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {mapping.action === 'map' && (
                              <Select
                                value={mapping.product_id || ''}
                                onValueChange={(value) => 
                                  updateMapping(mapping.product_name, { product_id: value })
                                }
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue placeholder="Izvēlieties produktu" />
                                </SelectTrigger>
                                <SelectContent>
                                  {existingProducts.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name} ({p.sku})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            {mapping.action === 'create' && (
                              <Input
                                value={mapping.new_sku}
                                onChange={(e) => 
                                  updateMapping(mapping.product_name, { new_sku: e.target.value })
                                }
                                className="w-36"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {mapping.action === 'create' && (
                              <Input
                                type="number"
                                step="0.01"
                                value={mapping.new_cost_price}
                                onChange={(e) => 
                                  updateMapping(mapping.product_name, { new_cost_price: parseFloat(e.target.value) || 0 })
                                }
                                className="w-24"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {mapping.action === 'create' && (
                              <Input
                                type="number"
                                step="0.01"
                                value={mapping.new_current_price}
                                onChange={(e) => 
                                  updateMapping(mapping.product_name, { new_current_price: parseFloat(e.target.value) || 0 })
                                }
                                className="w-24"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Atcelt
              </Button>
              <Button onClick={handleParseFile} disabled={!file || isImporting}>
                {isImporting ? "Apstrādā..." : "Turpināt"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Atpakaļ
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? "Importē..." : `Importēt ${parsedData.length} ierakstus`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};