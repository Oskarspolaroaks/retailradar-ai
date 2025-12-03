import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WeeklySalesImportDialogProps {
  onImportComplete?: () => void;
}

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

type ParsedFileInfo = {
  isSpiritsWine: boolean;
  atlikumiColumn: string | null;
  parsedDate: string | null;
  rowCount: number;
  columns: string[];
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
  const [fileInfo, setFileInfo] = useState<ParsedFileInfo | null>(null);
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      analyzeFile(selectedFile);
    }
  };

  const analyzeFile = async (file: File) => {
    try {
      const data = await readExcelFile(file);
      if (data.length === 0) {
        setFileInfo(null);
        return;
      }

      const columns = Object.keys(data[0]);
      
      // Check for Spirits&Wine format
      const hasNosaukums = columns.some(c => c === "Nosaukums");
      const hasSumOfSkaits = columns.some(c => c === "Sum of Skaits");
      const hasSumOfGM = columns.some(c => c === "Sum of GM");
      
      // Find "Atlikumi XX.XX" column dynamically
      const atlikumiColumn = columns.find(c => c.startsWith("Atlikumi "));
      
      let parsedDate: string | null = null;
      if (atlikumiColumn) {
        // Parse date from "Atlikumi 24.11" or similar format
        const dateMatch = atlikumiColumn.match(/Atlikumi\s+(\d{1,2})\.(\d{1,2})/);
        if (dateMatch) {
          const day = dateMatch[1].padStart(2, '0');
          const month = dateMatch[2].padStart(2, '0');
          parsedDate = `${year}-${month}-${day}`;
          setWeekEnd(parsedDate);
        }
      }

      const isSpiritsWine = hasNosaukums && hasSumOfSkaits && hasSumOfGM;

      setFileInfo({
        isSpiritsWine,
        atlikumiColumn,
        parsedDate,
        rowCount: data.length,
        columns,
      });

      if (!isSpiritsWine) {
        toast({
          title: "Formāta brīdinājums",
          description: "Fails neatbilst Spirits&Wine formātam. Pārbaudiet, vai ir kolonnas: Nosaukums, Sum of Skaits, Sum of GM",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error analyzing file:', error);
      setFileInfo(null);
    }
  };

  const readExcelFile = async (file: File): Promise<any[]> => {
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

  const transformSpiritsWine = (rows: any[], weekEndDate: string, atlikumiColumn: string | null): WeeklySale[] => {
    const result: WeeklySale[] = [];
    const pwDate = new Date(weekEndDate);
    pwDate.setDate(pwDate.getDate() - 7);
    const pwDateStr = pwDate.toISOString().split('T')[0];

    for (const row of rows) {
      const name = row["Nosaukums"]?.toString().trim();

      // Skip invalid rows
      if (!name || name === "False" || name === "(blank)" || name === "Grand Total" || name.includes("Total")) {
        continue;
      }

      const stockEnd = atlikumiColumn ? row[atlikumiColumn] : null;
      const lwUnits = row["Sum of Skaits"];
      const lwGM = row["Sum of GM"];
      const pwUnits = row["Sum of Skaits.1"];
      const pwGM = row["Sum of GM.1"];

      // Last Week (LW)
      if (lwUnits != null && !isNaN(Number(lwUnits))) {
        result.push({
          partner: "Spirits&Wine",
          product_name: name,
          period_type: "LW",
          week_end: weekEndDate,
          units_sold: Number(lwUnits) || 0,
          gross_margin: Number(lwGM) || 0,
          stock_end: stockEnd ? Number(stockEnd) : null,
        });
      }

      // Previous Week (PW)
      if (pwUnits != null && !isNaN(Number(pwUnits))) {
        result.push({
          partner: "Spirits&Wine",
          product_name: name,
          period_type: "PW",
          week_end: pwDateStr,
          units_sold: Number(pwUnits) || 0,
          gross_margin: Number(pwGM) || 0,
          stock_end: stockEnd ? Number(stockEnd) : null,
        });
      }
    }

    return result;
  };

  const handleParseFile = async () => {
    if (!file || !fileInfo?.isSpiritsWine) return;

    setIsImporting(true);
    try {
      const data = await readExcelFile(file);
      const transformed = transformSpiritsWine(data, weekEnd, fileInfo.atlikumiColumn);
      setParsedData(transformed);

      // Fetch existing products
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, sku, current_price, cost_price');

      if (error) throw error;
      setExistingProducts(products || []);

      // Initialize mappings with fuzzy matching
      const uniqueProductNames = [...new Set(transformed.map(s => s.product_name))];
      const newMappings = new Map<string, ProductMapping>();

      for (const productName of uniqueProductNames) {
        // Try exact match first
        let existingProduct = products?.find(p => 
          p.name.toLowerCase() === productName.toLowerCase()
        );

        // Try partial match if no exact match
        if (!existingProduct) {
          existingProduct = products?.find(p => 
            p.name.toLowerCase().includes(productName.toLowerCase()) ||
            productName.toLowerCase().includes(p.name.toLowerCase())
          );
        }

        newMappings.set(productName, {
          product_name: productName,
          product_id: existingProduct?.id || null,
          action: existingProduct ? 'map' : 'skip',
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

      const createdProductIds = new Map<string, string>();

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

        // Store created product IDs
        newProducts?.forEach((product, index) => {
          const mapping = productsToCreate[index];
          createdProductIds.set(mapping.product_name, product.id);
        });
      }

      // Prepare weekly sales records
      const salesRecords = parsedData
        .filter(sale => {
          const mapping = mappings.get(sale.product_name);
          return mapping && mapping.action !== 'skip';
        })
        .map(sale => {
          const mapping = mappings.get(sale.product_name)!;
          const productId = mapping.action === 'create' 
            ? createdProductIds.get(sale.product_name) 
            : mapping.product_id;

          return {
            tenant_id: tenantId,
            partner: sale.partner,
            product_id: productId || null,
            product_name: sale.product_name,
            period_type: sale.period_type,
            week_end: sale.week_end,
            units_sold: sale.units_sold,
            gross_margin: sale.gross_margin,
            stock_end: sale.stock_end,
            mapped: !!productId,
          };
        });

      if (salesRecords.length === 0) {
        throw new Error('Nav ierakstu importēšanai. Lūdzu, kartējiet vismaz vienu produktu.');
      }

      const { error: insertError } = await supabase
        .from('weekly_sales')
        .insert(salesRecords);

      if (insertError) throw insertError;

      toast({
        title: "Imports veiksmīgs",
        description: `Importēti ${salesRecords.length} nedēļas pārdošanas ieraksti.`,
      });

      setOpen(false);
      resetState();
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

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setParsedData([]);
    setMappings(new Map());
    setFileInfo(null);
  };

  const mappedCount = Array.from(mappings.values()).filter(m => m.action === 'map' && m.product_id).length;
  const createCount = Array.from(mappings.values()).filter(m => m.action === 'create').length;
  const skipCount = Array.from(mappings.values()).filter(m => m.action === 'skip').length;

  const lwCount = parsedData.filter(s => s.period_type === "LW").length;
  const pwCount = parsedData.filter(s => s.period_type === "PW").length;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Importēt Nedēļas Pārdošanu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importēt Spirits&Wine Nedēļas Pārdošanu</DialogTitle>
          <DialogDescription>
            Augšupielādējiet Excel datni ar Spirits&Wine pārdošanas datiem (LW vs PW formātā)
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">Gads</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="week-end">Nedēļas Beigu Datums (LW)</Label>
                <Input
                  id="week-end"
                  type="date"
                  value={weekEnd}
                  onChange={(e) => setWeekEnd(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="file">Excel Datne</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="mt-1"
              />
            </div>

            {file && fileInfo && (
              <Card className={fileInfo.isSpiritsWine ? "border-green-500/30" : "border-destructive/30"}>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {fileInfo.isSpiritsWine ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    Datnes Analīze
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span className="font-medium">{file.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>Formāts: {fileInfo.isSpiritsWine ? "Spirits&Wine ✓" : "Nezināms formāts"}</div>
                    <div>Rindas: {fileInfo.rowCount}</div>
                    {fileInfo.atlikumiColumn && (
                      <div>Atlikumi kolonna: {fileInfo.atlikumiColumn}</div>
                    )}
                    {fileInfo.parsedDate && (
                      <div>Nolasīts datums: {new Date(fileInfo.parsedDate).toLocaleDateString('lv-LV')}</div>
                    )}
                  </div>
                  {!fileInfo.isSpiritsWine && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Formāta kļūda</AlertTitle>
                      <AlertDescription>
                        Trūkst obligātās kolonnas: Nosaukums, Sum of Skaits, Sum of GM
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="py-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{lwCount}</div>
                  <div className="text-xs text-muted-foreground">LW ieraksti</div>
                </CardContent>
              </Card>
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="py-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">{pwCount}</div>
                  <div className="text-xs text-muted-foreground">PW ieraksti</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3 text-center">
                  <div className="text-2xl font-bold">{mappings.size}</div>
                  <div className="text-xs text-muted-foreground">Unikāli produkti</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Produktu Kartēšana</CardTitle>
                <CardDescription>
                  Kartējiet importētos produktus uz esošiem vai izveidojiet jaunus
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Badge variant="default" className="bg-green-500/10 text-green-700 border-green-500/20">
                    {mappedCount} Kartēti
                  </Badge>
                  <Badge variant="default" className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                    {createCount} Jauni
                  </Badge>
                  <Badge variant="outline">
                    {skipCount} Izlaisti
                  </Badge>
                </div>

                <div className="rounded-md border max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-[250px]">Produkta Nosaukums</TableHead>
                        <TableHead className="w-[120px]">Darbība</TableHead>
                        <TableHead>Kartēt uz</TableHead>
                        <TableHead className="w-[100px]">SKU</TableHead>
                        <TableHead className="w-[80px]">Izmaksu</TableHead>
                        <TableHead className="w-[80px]">Cena</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from(mappings.values()).map((mapping) => (
                        <TableRow key={mapping.product_name}>
                          <TableCell className="font-medium text-sm">{mapping.product_name}</TableCell>
                          <TableCell>
                            <Select
                              value={mapping.action}
                              onValueChange={(value) => 
                                updateMapping(mapping.product_name, { action: value as any })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
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
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Izvēlieties..." />
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
                                className="h-8 text-xs"
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
                                className="h-8 text-xs w-20"
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
                                className="h-8 text-xs w-20"
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
              <Button 
                onClick={handleParseFile} 
                disabled={!file || !fileInfo?.isSpiritsWine || isImporting}
              >
                {isImporting ? "Apstrādā..." : "Turpināt"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Atpakaļ
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={isImporting || (mappedCount + createCount) === 0}
              >
                {isImporting ? "Importē..." : `Importēt ${mappedCount + createCount} produktus`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
