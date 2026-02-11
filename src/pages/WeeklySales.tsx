import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, TrendingDown, Package, ArrowUpRight, ArrowDownRight, Minus, BarChart3, Trash2, Loader2, Upload } from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { WeeklySalesImportDialog } from "@/components/WeeklySalesImportDialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ProductAgg = {
  product_id: string | null;
  product_name: string;
  total_units: number;
  total_revenue: number;
};

type ProductWithABC = ProductAgg & { abc_category: "A" | "B" | "C" };

type ComparisonRow = {
  product_name: string;
  product_id: string | null;
  lw_units: number;
  pw_units: number;
  lw_margin: number;
  pw_margin: number;
  stock_end: number | null;
  units_change: number;
  units_change_pct: number;
  margin_change: number;
  margin_change_pct: number;
  abc_lw: "A" | "B" | "C" | null;
  abc_pw: "A" | "B" | "C" | null;
  mapped: boolean;
};

function assignABC(products: ProductAgg[]): ProductWithABC[] {
  if (products.length === 0) return [];
  
  const sorted = [...products].sort((a, b) => b.total_revenue - a.total_revenue);
  const totalRevenue = sorted.reduce((sum, p) => sum + p.total_revenue, 0);

  if (totalRevenue === 0) {
    return sorted.map(p => ({ ...p, abc_category: "C" as const }));
  }

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [productSearch, setProductSearch] = useState<string>("");
  const [abcFilter, setAbcFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("margin_desc");
  const [displayLimit, setDisplayLimit] = useState<number>(100);

  const { data: weeklySales, isLoading, refetch } = useQuery({
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

      // Fetch ALL records without limit
      const { data, error, count } = await supabase
        .from("weekly_sales")
        .select(`
          *,
          products (
            name,
            sku,
            category,
            brand,
            current_price,
            cost_price
          )
        `, { count: 'exact' })
        .eq("tenant_id", userTenants.tenant_id)
        .order("week_end", { ascending: false });

      if (error) throw error;
      console.log(`Loaded ${data?.length} weekly sales records`);
      return data;
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userTenants } = await supabase
        .from("user_tenants")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!userTenants) throw new Error("No tenant found");

      const { error } = await supabase
        .from("weekly_sales")
        .delete()
        .eq("tenant_id", userTenants.tenant_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-sales"] });
      toast({
        title: "Data deleted",
        description: "All weekly sales data has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete data",
        variant: "destructive",
      });
    },
  });

  // Get latest upload date
  const latestUploadDate = useMemo(() => {
    if (!weeklySales || weeklySales.length === 0) return null;
    const dates = weeklySales.map(s => new Date(s.created_at)).filter(d => !isNaN(d.getTime()));
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates.map(d => d.getTime())));
  }, [weeklySales]);

  // Get week end date range
  const weekEndRange = useMemo(() => {
    if (!weeklySales || weeklySales.length === 0) return null;
    const dates = weeklySales.map(s => new Date(s.week_end)).filter(d => !isNaN(d.getTime()));
    if (dates.length === 0) return null;
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    return { min, max };
  }, [weeklySales]);

  // Calculate ABC and comparison data
  const { abcAnalysis, comparisonData, totals } = useMemo(() => {
    if (!weeklySales || weeklySales.length === 0) {
      return { 
        abcAnalysis: { LW: [], PW: [], abcMap: new Map() },
        comparisonData: [],
        totals: { lwUnits: 0, pwUnits: 0, lwMargin: 0, pwMargin: 0 }
      };
    }

    const lwSales = weeklySales.filter(s => s.period_type === "LW");
    const pwSales = weeklySales.filter(s => s.period_type === "PW");

    // Aggregate by product for ABC
    const aggregateByProduct = (sales: typeof weeklySales): ProductAgg[] => {
      const map = new Map<string, ProductAgg>();
      sales.forEach(sale => {
        const key = sale.product_id || sale.product_name;
        const existing = map.get(key);
        if (existing) {
          existing.total_units += Number(sale.units_sold) || 0;
          existing.total_revenue += Number(sale.gross_margin) || 0;
        } else {
          map.set(key, {
            product_id: sale.product_id,
            product_name: sale.product_name,
            total_units: Number(sale.units_sold) || 0,
            total_revenue: Number(sale.gross_margin) || 0,
          });
        }
      });
      return Array.from(map.values());
    };

    const lwAgg = aggregateByProduct(lwSales);
    const pwAgg = aggregateByProduct(pwSales);

    const lwWithABC = assignABC(lwAgg);
    const pwWithABC = assignABC(pwAgg);

    // Create ABC map
    const abcMap = new Map<string, { LW?: "A" | "B" | "C", PW?: "A" | "B" | "C" }>();
    lwWithABC.forEach(p => {
      const key = p.product_id || p.product_name;
      abcMap.set(key, { ...abcMap.get(key), LW: p.abc_category });
    });
    pwWithABC.forEach(p => {
      const key = p.product_id || p.product_name;
      abcMap.set(key, { ...abcMap.get(key), PW: p.abc_category });
    });

    // Build comparison data
    const productMap = new Map<string, ComparisonRow>();
    
    lwSales.forEach(sale => {
      const key = sale.product_id || sale.product_name;
      const existing = productMap.get(key);
      const abcData = abcMap.get(key);
      
      if (existing) {
        existing.lw_units += Number(sale.units_sold) || 0;
        existing.lw_margin += Number(sale.gross_margin) || 0;
        existing.stock_end = sale.stock_end ? Number(sale.stock_end) : existing.stock_end;
        existing.mapped = sale.mapped || existing.mapped;
      } else {
        productMap.set(key, {
          product_name: sale.product_name,
          product_id: sale.product_id,
          lw_units: Number(sale.units_sold) || 0,
          pw_units: 0,
          lw_margin: Number(sale.gross_margin) || 0,
          pw_margin: 0,
          stock_end: sale.stock_end ? Number(sale.stock_end) : null,
          units_change: 0,
          units_change_pct: 0,
          margin_change: 0,
          margin_change_pct: 0,
          abc_lw: abcData?.LW || null,
          abc_pw: abcData?.PW || null,
          mapped: sale.mapped,
        });
      }
    });

    pwSales.forEach(sale => {
      const key = sale.product_id || sale.product_name;
      const existing = productMap.get(key);
      const abcData = abcMap.get(key);
      
      if (existing) {
        existing.pw_units += Number(sale.units_sold) || 0;
        existing.pw_margin += Number(sale.gross_margin) || 0;
        existing.abc_pw = abcData?.PW || null;
      } else {
        productMap.set(key, {
          product_name: sale.product_name,
          product_id: sale.product_id,
          lw_units: 0,
          pw_units: Number(sale.units_sold) || 0,
          lw_margin: 0,
          pw_margin: Number(sale.gross_margin) || 0,
          stock_end: sale.stock_end ? Number(sale.stock_end) : null,
          units_change: 0,
          units_change_pct: 0,
          margin_change: 0,
          margin_change_pct: 0,
          abc_lw: abcData?.LW || null,
          abc_pw: abcData?.PW || null,
          mapped: sale.mapped,
        });
      }
    });

    // Calculate changes
    productMap.forEach((row, key) => {
      row.units_change = row.lw_units - row.pw_units;
      row.margin_change = row.lw_margin - row.pw_margin;
      row.units_change_pct = row.pw_units > 0 ? ((row.lw_units - row.pw_units) / row.pw_units) * 100 : (row.lw_units > 0 ? 100 : 0);
      row.margin_change_pct = row.pw_margin > 0 ? ((row.lw_margin - row.pw_margin) / row.pw_margin) * 100 : (row.lw_margin > 0 ? 100 : 0);
    });

    const comparison = Array.from(productMap.values());

    // Calculate totals
    const totals = {
      lwUnits: comparison.reduce((sum, r) => sum + r.lw_units, 0),
      pwUnits: comparison.reduce((sum, r) => sum + r.pw_units, 0),
      lwMargin: comparison.reduce((sum, r) => sum + r.lw_margin, 0),
      pwMargin: comparison.reduce((sum, r) => sum + r.pw_margin, 0),
    };

    return { 
      abcAnalysis: { LW: lwWithABC, PW: pwWithABC, abcMap },
      comparisonData: comparison,
      totals
    };
  }, [weeklySales]);

  // Filter and sort comparison data
  const filteredData = useMemo(() => {
    let data = comparisonData.filter(row => {
      const matchesPartner = partnerFilter === "all"; // All data is from the same query
      const matchesProduct = !productSearch || 
        row.product_name.toLowerCase().includes(productSearch.toLowerCase());
      const matchesABC = abcFilter === "all" || row.abc_lw === abcFilter;
      return matchesPartner && matchesProduct && matchesABC;
    });

    // Sort
    switch (sortBy) {
      case "margin_desc":
        data.sort((a, b) => b.lw_margin - a.lw_margin);
        break;
      case "margin_asc":
        data.sort((a, b) => a.lw_margin - b.lw_margin);
        break;
      case "units_desc":
        data.sort((a, b) => b.lw_units - a.lw_units);
        break;
      case "change_desc":
        data.sort((a, b) => b.margin_change_pct - a.margin_change_pct);
        break;
      case "change_asc":
        data.sort((a, b) => a.margin_change_pct - b.margin_change_pct);
        break;
      case "abc":
        data.sort((a, b) => {
          const order = { A: 0, B: 1, C: 2 };
          return (order[a.abc_lw || "C"] || 2) - (order[b.abc_lw || "C"] || 2);
        });
        break;
    }

    return data;
  }, [comparisonData, partnerFilter, productSearch, abcFilter, sortBy]);

  const uniquePartners = [...new Set(weeklySales?.map(s => s.partner) || [])];

  // ABC stats
  const getAbcStats = (products: ProductWithABC[]) => {
    const total = products.length;
    if (total === 0) return null;
    
    const aProducts = products.filter(p => p.abc_category === "A");
    const bProducts = products.filter(p => p.abc_category === "B");
    const cProducts = products.filter(p => p.abc_category === "C");

    const totalRevenue = products.reduce((sum, p) => sum + p.total_revenue, 0);

    return {
      A: { 
        count: aProducts.length, 
        pct: (aProducts.length / total * 100).toFixed(0),
        revenue: aProducts.reduce((sum, p) => sum + p.total_revenue, 0),
        revenuePct: totalRevenue > 0 ? (aProducts.reduce((sum, p) => sum + p.total_revenue, 0) / totalRevenue * 100).toFixed(0) : "0"
      },
      B: { 
        count: bProducts.length, 
        pct: (bProducts.length / total * 100).toFixed(0),
        revenue: bProducts.reduce((sum, p) => sum + p.total_revenue, 0),
        revenuePct: totalRevenue > 0 ? (bProducts.reduce((sum, p) => sum + p.total_revenue, 0) / totalRevenue * 100).toFixed(0) : "0"
      },
      C: { 
        count: cProducts.length, 
        pct: (cProducts.length / total * 100).toFixed(0),
        revenue: cProducts.reduce((sum, p) => sum + p.total_revenue, 0),
        revenuePct: totalRevenue > 0 ? (cProducts.reduce((sum, p) => sum + p.total_revenue, 0) / totalRevenue * 100).toFixed(0) : "0"
      },
    };
  };

  const lwStats = getAbcStats(abcAnalysis.LW);

  const unitsChangePct = totals.pwUnits > 0 ? ((totals.lwUnits - totals.pwUnits) / totals.pwUnits * 100) : 0;
  const marginChangePct = totals.pwMargin > 0 ? ((totals.lwMargin - totals.pwMargin) / totals.pwMargin * 100) : 0;

  const renderChangeIndicator = (value: number, pct: number, isCurrency = false) => {
    if (pct === 0) {
      return <span className="text-muted-foreground flex items-center gap-1"><Minus className="h-3 w-3" /> 0%</span>;
    }
    const isPositive = pct > 0;
    return (
      <span className={`flex items-center gap-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {isPositive ? "+" : ""}{pct.toFixed(1)}%
      </span>
    );
  };

  const ABCBadge = ({ abc }: { abc: "A" | "B" | "C" | null }) => {
    if (!abc) return <span className="text-muted-foreground">-</span>;
    
    const styles = {
      A: "bg-green-500/10 text-green-700 border-green-500/20 hover:bg-green-500/20",
      B: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20 hover:bg-yellow-500/20",
      C: "bg-muted text-muted-foreground border-muted hover:bg-muted/80",
    };

    return <Badge className={styles[abc]}>{abc}</Badge>;
  };

  // Apply display limit
  const displayedData = useMemo(() => {
    return filteredData.slice(0, displayLimit);
  }, [filteredData, displayLimit]);

  const hasMore = filteredData.length > displayLimit;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Weekly Sales Report</h1>
          <p className="text-muted-foreground mt-1">
            LW vs PW comparison with ABC analysis
            {weeklySales && weeklySales.length > 0 && (
              <span className="ml-2 text-xs">
                ({weeklySales.length} records in database)
              </span>
            )}
          </p>
          {/* Upload date and data period info */}
          {weeklySales && weeklySales.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
              {latestUploadDate && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Uploaded: <span className="font-medium text-foreground">{format(latestUploadDate, "dd.MM.yyyy HH:mm", { locale: enUS })}</span></span>
                </div>
              )}
              {weekEndRange && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Data period: <span className="font-medium text-foreground">{format(weekEndRange.min, "dd.MM.yyyy")} - {format(weekEndRange.max, "dd.MM.yyyy")}</span></span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {weeklySales && weeklySales.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all weekly sales data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete {weeklySales.length} records. This cannot be undone.
                    After deletion you can import new data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteAllMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteAllMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete All"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <WeeklySalesImportDialog onImportComplete={() => refetch()} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              LW Units Sold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.lwUnits.toLocaleString()}</div>
            <div className="text-sm mt-1">
              {renderChangeIndicator(totals.lwUnits - totals.pwUnits, unitsChangePct)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              LW Gross Margin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totals.lwMargin.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div className="text-sm mt-1">
              {renderChangeIndicator(totals.lwMargin - totals.pwMargin, marginChangePct, true)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Product Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{comparisonData.length}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {filteredData.length} filtered
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              ABC Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lwStats ? (
              <div className="flex items-center gap-2">
                <ABCBadge abc="A" />
                <span className="text-sm">{lwStats.A.count}</span>
                <ABCBadge abc="B" />
                <span className="text-sm">{lwStats.B.count}</span>
                <ABCBadge abc="C" />
                <span className="text-sm">{lwStats.C.count}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">No data</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ABC Analysis Cards */}
      {lwStats && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-green-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ABCBadge abc="A" />
                Top Products (A)
              </CardTitle>
              <CardDescription>~80% of revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lwStats.A.count}</div>
              <div className="text-sm text-muted-foreground">
                €{lwStats.A.revenue.toLocaleString(undefined, { minimumFractionDigits: 0 })} ({lwStats.A.revenuePct}%)
              </div>
              <div className="h-2 bg-secondary rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: `${lwStats.A.revenuePct}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ABCBadge abc="B" />
                Mid Products (B)
              </CardTitle>
              <CardDescription>~15% of revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lwStats.B.count}</div>
              <div className="text-sm text-muted-foreground">
                €{lwStats.B.revenue.toLocaleString(undefined, { minimumFractionDigits: 0 })} ({lwStats.B.revenuePct}%)
              </div>
              <div className="h-2 bg-secondary rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-yellow-500" style={{ width: `${lwStats.B.revenuePct}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-muted">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ABCBadge abc="C" />
                Low Products (C)
              </CardTitle>
              <CardDescription>~5% of revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lwStats.C.count}</div>
              <div className="text-sm text-muted-foreground">
                €{lwStats.C.revenue.toLocaleString(undefined, { minimumFractionDigits: 0 })} ({lwStats.C.revenuePct}%)
              </div>
              <div className="h-2 bg-secondary rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-muted-foreground/30" style={{ width: `${lwStats.C.revenuePct}%` }} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 min-w-[140px]">
              <Label className="text-xs">Partner</Label>
              <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {uniquePartners.map((partner) => (
                    <SelectItem key={partner} value={partner}>{partner}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-[140px]">
              <Label className="text-xs">ABC Category</Label>
              <Select value={abcFilter} onValueChange={setAbcFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="A">A - Top</SelectItem>
                  <SelectItem value="B">B - Mid</SelectItem>
                  <SelectItem value="C">C - Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-[140px]">
              <Label className="text-xs">Sort by</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="margin_desc">Margin ↓</SelectItem>
                  <SelectItem value="margin_asc">Margin ↑</SelectItem>
                  <SelectItem value="units_desc">Units ↓</SelectItem>
                  <SelectItem value="change_desc">Growth ↓</SelectItem>
                  <SelectItem value="change_asc">Decline ↓</SelectItem>
                  <SelectItem value="abc">ABC category</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-xs">Search product</Label>
              <Input
                placeholder="Name..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>LW vs PW Comparison</CardTitle>
              <CardDescription>
                Showing {displayedData.length} of {filteredData.length} products
                {comparisonData.length !== filteredData.length && ` (total ${comparisonData.length})`}
              </CardDescription>
            </div>
            {filteredData.length > 100 && (
              <Select 
                value={displayLimit.toString()} 
                onValueChange={(v) => setDisplayLimit(Number(v))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Show..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">Show 100</SelectItem>
                  <SelectItem value="500">Show 500</SelectItem>
                  <SelectItem value="1000">Show 1000</SelectItem>
                  <SelectItem value="99999">Show All</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Loading data...</p>
            </div>
          ) : displayedData.length > 0 ? (
            <>
              <div className="rounded-md border overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="sticky left-0 top-0 bg-muted/50 min-w-[200px] z-20">Product</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-center w-[60px]">ABC</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-right w-[100px]">LW Units</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-right w-[100px]">PW Units</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-center w-[100px]">Δ Units</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-right w-[100px]">LW Margin</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-right w-[100px]">PW Margin</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-center w-[100px]">Δ Margin</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-right w-[80px]">Stock</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-center w-[80px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedData.map((row, idx) => (
                      <TableRow key={`${row.product_id || row.product_name}-${idx}`}>
                        <TableCell className="sticky left-0 bg-background font-medium">
                          <div className="truncate max-w-[200px]" title={row.product_name}>
                            {row.product_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <ABCBadge abc={row.abc_lw} />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.lw_units.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {row.pw_units.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          {renderChangeIndicator(row.units_change, row.units_change_pct)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          €{row.lw_margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          €{row.pw_margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center">
                          {renderChangeIndicator(row.margin_change, row.margin_change_pct, true)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.stock_end !== null ? row.stock_end.toLocaleString() : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.mapped ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 text-xs">
                              ✓
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 text-xs">
                              ?
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {hasMore && (
                <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Showing {displayedData.length} of {filteredData.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisplayLimit(prev => Math.min(prev + 500, 99999))}
                  >
                    Show more (+500)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisplayLimit(99999)}
                  >
                    Show All ({filteredData.length})
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No data found.</p>
              <p className="text-sm mt-1">Import a Spirits&Wine Excel file to see the report.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ABC Legend */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-6 text-sm">
            <span className="font-medium">ABC Legend:</span>
            <div className="flex items-center gap-2">
              <ABCBadge abc="A" />
              <span className="text-muted-foreground">Top products (~80% revenue)</span>
            </div>
            <div className="flex items-center gap-2">
              <ABCBadge abc="B" />
              <span className="text-muted-foreground">Mid (~15% revenue)</span>
            </div>
            <div className="flex items-center gap-2">
              <ABCBadge abc="C" />
              <span className="text-muted-foreground">Low (~5% revenue)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WeeklySales;
