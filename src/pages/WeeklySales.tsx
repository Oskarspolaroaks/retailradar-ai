import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, Package } from "lucide-react";

type ProductAgg = {
  product_id: string | null;
  product_name: string;
  total_units: number;
  total_revenue: number;
};

type ProductWithABC = ProductAgg & { abc_category: "A" | "B" | "C" };

function assignABC(products: ProductAgg[]): ProductWithABC[] {
  const sorted = [...products].sort((a, b) => b.total_revenue - a.total_revenue);
  const totalRevenue = sorted.reduce((sum, p) => sum + p.total_revenue, 0);

  let cumulative = 0;
  return sorted.map(p => {
    cumulative += p.total_revenue;
    const share = (cumulative / totalRevenue) * 100;

    let abc: "A" | "B" | "C";
    if (share <= 80) abc = "A";
    else if (share <= 95) abc = "B";
    else abc = "C";

    return { ...p, abc_category: abc };
  });
}

const WeeklySales = () => {
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [productSearch, setProductSearch] = useState<string>("");
  const [abcFilter, setAbcFilter] = useState<string>("all");

  const { data: weeklySales, isLoading } = useQuery({
    queryKey: ["weekly-sales"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userTenants } = await supabase
        .from("user_tenants")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!userTenants) throw new Error("No tenant found");

      const { data, error } = await supabase
        .from("weekly_sales")
        .select(`
          *,
          products (
            name,
            sku,
            category,
            brand
          )
        `)
        .eq("tenant_id", userTenants.tenant_id)
        .order("week_end", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Calculate ABC for LW and PW separately
  const abcAnalysis = useMemo(() => {
    if (!weeklySales || weeklySales.length === 0) {
      return { LW: [], PW: [], abcMap: new Map<string, { LW?: "A" | "B" | "C", PW?: "A" | "B" | "C" }>() };
    }

    const lwSales = weeklySales.filter(s => s.period_type === "LW");
    const pwSales = weeklySales.filter(s => s.period_type === "PW");

    const aggregateByProduct = (sales: typeof weeklySales) => {
      const map = new Map<string, ProductAgg>();
      sales.forEach(sale => {
        const key = sale.product_id || sale.product_name;
        const existing = map.get(key);
        if (existing) {
          existing.total_units += sale.units_sold;
          existing.total_revenue += sale.gross_margin;
        } else {
          map.set(key, {
            product_id: sale.product_id,
            product_name: sale.product_name,
            total_units: sale.units_sold,
            total_revenue: sale.gross_margin,
          });
        }
      });
      return Array.from(map.values());
    };

    const lwAgg = aggregateByProduct(lwSales);
    const pwAgg = aggregateByProduct(pwSales);

    const lwWithABC = assignABC(lwAgg);
    const pwWithABC = assignABC(pwAgg);

    // Create a map for quick lookup
    const abcMap = new Map<string, { LW?: "A" | "B" | "C", PW?: "A" | "B" | "C" }>();
    
    lwWithABC.forEach(p => {
      const key = p.product_id || p.product_name;
      abcMap.set(key, { ...abcMap.get(key), LW: p.abc_category });
    });
    
    pwWithABC.forEach(p => {
      const key = p.product_id || p.product_name;
      abcMap.set(key, { ...abcMap.get(key), PW: p.abc_category });
    });

    return { LW: lwWithABC, PW: pwWithABC, abcMap };
  }, [weeklySales]);

  const filteredSales = weeklySales?.filter((sale) => {
    const matchesPeriod = periodFilter === "all" || sale.period_type === periodFilter;
    const matchesPartner = partnerFilter === "all" || sale.partner === partnerFilter;
    const matchesProduct = !productSearch || 
      sale.product_name.toLowerCase().includes(productSearch.toLowerCase()) ||
      sale.products?.name?.toLowerCase().includes(productSearch.toLowerCase());
    
    // ABC filter
    let matchesABC = true;
    if (abcFilter !== "all") {
      const key = sale.product_id || sale.product_name;
      const abcData = abcAnalysis.abcMap.get(key);
      const abc = sale.period_type === "LW" ? abcData?.LW : abcData?.PW;
      matchesABC = abc === abcFilter;
    }
    
    return matchesPeriod && matchesPartner && matchesProduct && matchesABC;
  });

  const uniquePartners = [...new Set(weeklySales?.map(s => s.partner) || [])];

  const totalUnits = filteredSales?.reduce((sum, sale) => sum + (sale.units_sold || 0), 0) || 0;
  const totalMargin = filteredSales?.reduce((sum, sale) => sum + (sale.gross_margin || 0), 0) || 0;

  // ABC distribution stats
  const getAbcStats = (abcProducts: ProductWithABC[]) => {
    const total = abcProducts.length;
    const aCount = abcProducts.filter(p => p.abc_category === "A").length;
    const bCount = abcProducts.filter(p => p.abc_category === "B").length;
    const cCount = abcProducts.filter(p => p.abc_category === "C").length;
    
    const aRevenue = abcProducts.filter(p => p.abc_category === "A").reduce((sum, p) => sum + p.total_revenue, 0);
    const bRevenue = abcProducts.filter(p => p.abc_category === "B").reduce((sum, p) => sum + p.total_revenue, 0);
    const cRevenue = abcProducts.filter(p => p.abc_category === "C").reduce((sum, p) => sum + p.total_revenue, 0);
    const totalRevenue = aRevenue + bRevenue + cRevenue;

    return {
      A: { count: aCount, percent: (aCount / total * 100).toFixed(1), revenue: aRevenue, revenuePercent: (aRevenue / totalRevenue * 100).toFixed(1) },
      B: { count: bCount, percent: (bCount / total * 100).toFixed(1), revenue: bRevenue, revenuePercent: (bRevenue / totalRevenue * 100).toFixed(1) },
      C: { count: cCount, percent: (cCount / total * 100).toFixed(1), revenue: cRevenue, revenuePercent: (cRevenue / totalRevenue * 100).toFixed(1) },
    };
  };

  const lwStats = abcAnalysis.LW.length > 0 ? getAbcStats(abcAnalysis.LW) : null;
  const pwStats = abcAnalysis.PW.length > 0 ? getAbcStats(abcAnalysis.PW) : null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nedēļas Pārdošanas Pārskats</h1>
        <p className="text-muted-foreground mt-2">
          Spirits&Wine importēto datu analīze
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Kopā Pārdots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUnits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">vienības</p>
          </CardContent>
      </Card>

      {(lwStats || pwStats) && (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              ABC Analīze
            </h2>
            <p className="text-muted-foreground mt-1">
              Produktu segmentācija pēc ieņēmumu ieguldījuma (Pareto 80/15/5 princips)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lwStats && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge variant="default">LW</Badge>
                    Pēdējā Nedēļa ABC
                  </CardTitle>
                  <CardDescription>{abcAnalysis.LW.length} produkti</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-500/10 text-green-700 border-green-500/20">A</Badge>
                        <span className="text-sm">Top produkti (80% ieņ.)</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{lwStats.A.count}</div>
                        <div className="text-xs text-muted-foreground">{lwStats.A.percent}% produktu</div>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500" 
                        style={{ width: `${lwStats.A.revenuePercent}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      €{lwStats.A.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({lwStats.A.revenuePercent}%)
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20">B</Badge>
                        <span className="text-sm">Vidējie (15% ieņ.)</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{lwStats.B.count}</div>
                        <div className="text-xs text-muted-foreground">{lwStats.B.percent}% produktu</div>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-500" 
                        style={{ width: `${lwStats.B.revenuePercent}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      €{lwStats.B.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({lwStats.B.revenuePercent}%)
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-muted-foreground">C</Badge>
                        <span className="text-sm">Zemi (5% ieņ.)</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{lwStats.C.count}</div>
                        <div className="text-xs text-muted-foreground">{lwStats.C.percent}% produktu</div>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-muted" 
                        style={{ width: `${lwStats.C.revenuePercent}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      €{lwStats.C.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({lwStats.C.revenuePercent}%)
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {pwStats && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge variant="secondary">PW</Badge>
                    Iepriekšējā Nedēļa ABC
                  </CardTitle>
                  <CardDescription>{abcAnalysis.PW.length} produkti</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-500/10 text-green-700 border-green-500/20">A</Badge>
                        <span className="text-sm">Top produkti (80% ieņ.)</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{pwStats.A.count}</div>
                        <div className="text-xs text-muted-foreground">{pwStats.A.percent}% produktu</div>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500" 
                        style={{ width: `${pwStats.A.revenuePercent}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      €{pwStats.A.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({pwStats.A.revenuePercent}%)
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20">B</Badge>
                        <span className="text-sm">Vidējie (15% ieņ.)</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{pwStats.B.count}</div>
                        <div className="text-xs text-muted-foreground">{pwStats.B.percent}% produktu</div>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-500" 
                        style={{ width: `${pwStats.B.revenuePercent}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      €{pwStats.B.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({pwStats.B.revenuePercent}%)
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-muted-foreground">C</Badge>
                        <span className="text-sm">Zemi (5% ieņ.)</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{pwStats.C.count}</div>
                        <div className="text-xs text-muted-foreground">{pwStats.C.percent}% produktu</div>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-muted" 
                        style={{ width: `${pwStats.C.revenuePercent}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      €{pwStats.C.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({pwStats.C.revenuePercent}%)
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Bruto Marža</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">kopējā marža</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Produktu Skaits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSales?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">ieraksti</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtri</CardTitle>
          <CardDescription>Filtrēt pārdošanas datus pēc perioda, partnera un produkta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period">Periods</Label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger id="period">
                  <SelectValue placeholder="Izvēlēties periodu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visi periodi</SelectItem>
                  <SelectItem value="LW">Pēdējā Nedēļa (LW)</SelectItem>
                  <SelectItem value="PW">Iepriekšējā Nedēļa (PW)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner">Partneris</Label>
              <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                <SelectTrigger id="partner">
                  <SelectValue placeholder="Izvēlēties partneri" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visi partneri</SelectItem>
                  {uniquePartners.map((partner) => (
                    <SelectItem key={partner} value={partner}>
                      {partner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="abc">ABC Kategorija</Label>
              <Select value={abcFilter} onValueChange={setAbcFilter}>
                <SelectTrigger id="abc">
                  <SelectValue placeholder="Izvēlēties ABC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visas kategorijas</SelectItem>
                  <SelectItem value="A">A - Top (80% ieņēmumu)</SelectItem>
                  <SelectItem value="B">B - Vidējie (15% ieņēmumu)</SelectItem>
                  <SelectItem value="C">C - Zemi (5% ieņēmumu)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product">Produkts</Label>
              <Input
                id="product"
                placeholder="Meklēt produktu..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pārdošanas Dati</CardTitle>
          <CardDescription>
            {filteredSales?.length || 0} ieraksti atrasti
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Ielādē datus...</div>
          ) : filteredSales && filteredSales.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produkts</TableHead>
                    <TableHead>ABC</TableHead>
                    <TableHead>Partneris</TableHead>
                    <TableHead>Periods</TableHead>
                    <TableHead>Nedēļas Beigas</TableHead>
                    <TableHead className="text-right">Pārdots</TableHead>
                    <TableHead className="text-right">Bruto Marža</TableHead>
                    <TableHead className="text-right">Atlikums</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => {
                    const key = sale.product_id || sale.product_name;
                    const abcData = abcAnalysis.abcMap.get(key);
                    const abc = sale.period_type === "LW" ? abcData?.LW : abcData?.PW;
                    
                    return (
                      <TableRow key={sale.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{sale.product_name}</div>
                            {sale.products?.name && (
                              <div className="text-xs text-muted-foreground">
                                → {sale.products.name} ({sale.products.sku})
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {abc && (
                            <Badge 
                              className={
                                abc === "A" 
                                  ? "bg-green-500/10 text-green-700 border-green-500/20" 
                                  : abc === "B"
                                  ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
                                  : "border-muted text-muted-foreground"
                              }
                            >
                              {abc}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{sale.partner}</TableCell>
                        <TableCell>
                          <Badge variant={sale.period_type === "LW" ? "default" : "secondary"}>
                            {sale.period_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {new Date(sale.week_end).toLocaleDateString('lv-LV')}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {sale.units_sold.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          €{sale.gross_margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {sale.stock_end ? sale.stock_end.toLocaleString() : '-'}
                        </TableCell>
                        <TableCell>
                          {sale.mapped ? (
                            <Badge variant="default" className="bg-green-500/10 text-green-700 border-green-500/20">
                              Kartēts
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-700 border-yellow-500/20">
                              Nav kartēts
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nav atrasti dati. Importējiet Spirits&Wine failu, lai redzētu datus.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WeeklySales;
