import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, Package, ArrowUpRight, ArrowDownRight, Minus, BarChart3, Loader2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { lv } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

type WeeklySummaryRow = {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_brand: string | null;
  category_name: string | null;
  units_sold: number;
  gross_margin: number;
  stock_end: number;
};

type ProductWithABC = WeeklySummaryRow & { abc_category: "A" | "B" | "C" };

type ComparisonRow = {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_brand: string | null;
  category_name: string | null;
  lw_units: number;
  pw_units: number;
  lw_margin: number;
  pw_margin: number;
  stock_end: number;
  units_change: number;
  units_change_pct: number;
  margin_change: number;
  margin_change_pct: number;
  abc_lw: "A" | "B" | "C" | null;
  abc_pw: "A" | "B" | "C" | null;
};

function assignABC(products: WeeklySummaryRow[]): ProductWithABC[] {
  if (products.length === 0) return [];
  
  const sorted = [...products].sort((a, b) => b.gross_margin - a.gross_margin);
  const totalMargin = sorted.reduce((sum, p) => sum + p.gross_margin, 0);

  if (totalMargin === 0) {
    return sorted.map(p => ({ ...p, abc_category: "C" as const }));
  }

  let cumulative = 0;
  return sorted.map(p => {
    cumulative += p.gross_margin;
    const share = (cumulative / totalMargin) * 100;

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
  const [productSearch, setProductSearch] = useState<string>("");
  const [abcFilter, setAbcFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("margin_desc");
  const [displayLimit, setDisplayLimit] = useState<number>(100);
  const [selectedLwWeek, setSelectedLwWeek] = useState<string>("");

  // Fetch tenant info
  const { data: tenantInfo } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userTenants } = await supabase
        .from("user_tenants")
        .select("tenant_id, tenants(name)")
        .eq("user_id", user.id)
        .single();

      if (!userTenants) throw new Error("No tenant found");

      return {
        tenantId: userTenants.tenant_id,
        tenantName: (userTenants.tenants as any)?.name || "Unknown"
      };
    },
  });

  // Fetch available weeks from sales_daily
  const { data: availableWeeks, isLoading: weeksLoading } = useQuery({
    queryKey: ["available-weeks", tenantInfo?.tenantId],
    queryFn: async () => {
      if (!tenantInfo?.tenantId) return [];
      
      const { data, error } = await supabase.rpc("get_available_weeks", {
        p_tenant_id: tenantInfo.tenantId
      });

      if (error) throw error;
      return (data || []) as { week_end: string; record_count: number }[];
    },
    enabled: !!tenantInfo?.tenantId,
  });

  // Set default week when available weeks load
  useMemo(() => {
    if (availableWeeks && availableWeeks.length > 0 && !selectedLwWeek) {
      setSelectedLwWeek(availableWeeks[0].week_end);
    }
  }, [availableWeeks, selectedLwWeek]);

  // Calculate LW and PW dates
  const { lwWeekEnd, pwWeekEnd } = useMemo(() => {
    if (!selectedLwWeek) {
      return { lwWeekEnd: null, pwWeekEnd: null };
    }
    const lwDate = new Date(selectedLwWeek);
    const pwDate = subWeeks(lwDate, 1);
    return {
      lwWeekEnd: selectedLwWeek,
      pwWeekEnd: format(pwDate, "yyyy-MM-dd")
    };
  }, [selectedLwWeek]);

  // Fetch LW data
  const { data: lwData, isLoading: lwLoading } = useQuery({
    queryKey: ["weekly-sales-lw", tenantInfo?.tenantId, lwWeekEnd],
    queryFn: async () => {
      if (!tenantInfo?.tenantId || !lwWeekEnd) return [];
      
      const { data, error } = await supabase.rpc("get_weekly_sales_summary", {
        p_tenant_id: tenantInfo.tenantId,
        p_week_end: lwWeekEnd
      });

      if (error) throw error;
      return (data || []) as WeeklySummaryRow[];
    },
    enabled: !!tenantInfo?.tenantId && !!lwWeekEnd,
  });

  // Fetch PW data
  const { data: pwData, isLoading: pwLoading } = useQuery({
    queryKey: ["weekly-sales-pw", tenantInfo?.tenantId, pwWeekEnd],
    queryFn: async () => {
      if (!tenantInfo?.tenantId || !pwWeekEnd) return [];
      
      const { data, error } = await supabase.rpc("get_weekly_sales_summary", {
        p_tenant_id: tenantInfo.tenantId,
        p_week_end: pwWeekEnd
      });

      if (error) throw error;
      return (data || []) as WeeklySummaryRow[];
    },
    enabled: !!tenantInfo?.tenantId && !!pwWeekEnd,
  });

  const isLoading = weeksLoading || lwLoading || pwLoading;

  // Calculate ABC and comparison data
  const { abcAnalysis, comparisonData, totals } = useMemo(() => {
    if (!lwData || lwData.length === 0) {
      return { 
        abcAnalysis: { LW: [], PW: [], abcMap: new Map() },
        comparisonData: [],
        totals: { lwUnits: 0, pwUnits: 0, lwMargin: 0, pwMargin: 0 }
      };
    }

    const lwWithABC = assignABC(lwData);
    const pwWithABC = pwData ? assignABC(pwData) : [];

    // Create ABC map
    const abcMap = new Map<string, { LW?: "A" | "B" | "C", PW?: "A" | "B" | "C" }>();
    lwWithABC.forEach(p => {
      abcMap.set(p.product_id, { ...abcMap.get(p.product_id), LW: p.abc_category });
    });
    pwWithABC.forEach(p => {
      abcMap.set(p.product_id, { ...abcMap.get(p.product_id), PW: p.abc_category });
    });

    // Build comparison data
    const productMap = new Map<string, ComparisonRow>();
    
    lwWithABC.forEach(item => {
      const abcData = abcMap.get(item.product_id);
      productMap.set(item.product_id, {
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        product_brand: item.product_brand,
        category_name: item.category_name,
        lw_units: Number(item.units_sold) || 0,
        pw_units: 0,
        lw_margin: Number(item.gross_margin) || 0,
        pw_margin: 0,
        stock_end: Number(item.stock_end) || 0,
        units_change: 0,
        units_change_pct: 0,
        margin_change: 0,
        margin_change_pct: 0,
        abc_lw: abcData?.LW || null,
        abc_pw: abcData?.PW || null,
      });
    });

    pwWithABC.forEach(item => {
      const existing = productMap.get(item.product_id);
      const abcData = abcMap.get(item.product_id);
      
      if (existing) {
        existing.pw_units = Number(item.units_sold) || 0;
        existing.pw_margin = Number(item.gross_margin) || 0;
        existing.abc_pw = abcData?.PW || null;
      } else {
        productMap.set(item.product_id, {
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          product_brand: item.product_brand,
          category_name: item.category_name,
          lw_units: 0,
          pw_units: Number(item.units_sold) || 0,
          lw_margin: 0,
          pw_margin: Number(item.gross_margin) || 0,
          stock_end: 0,
          units_change: 0,
          units_change_pct: 0,
          margin_change: 0,
          margin_change_pct: 0,
          abc_lw: abcData?.LW || null,
          abc_pw: abcData?.PW || null,
        });
      }
    });

    // Calculate changes
    productMap.forEach((row) => {
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
  }, [lwData, pwData]);

  // Filter and sort comparison data
  const filteredData = useMemo(() => {
    let data = comparisonData.filter(row => {
      const matchesProduct = !productSearch || 
        row.product_name.toLowerCase().includes(productSearch.toLowerCase()) ||
        row.product_sku?.toLowerCase().includes(productSearch.toLowerCase());
      const matchesABC = abcFilter === "all" || row.abc_lw === abcFilter;
      return matchesProduct && matchesABC;
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
  }, [comparisonData, productSearch, abcFilter, sortBy]);

  // ABC stats
  const getAbcStats = (products: ProductWithABC[]) => {
    const total = products.length;
    if (total === 0) return null;
    
    const aProducts = products.filter(p => p.abc_category === "A");
    const bProducts = products.filter(p => p.abc_category === "B");
    const cProducts = products.filter(p => p.abc_category === "C");

    const totalMargin = products.reduce((sum, p) => sum + p.gross_margin, 0);

    return {
      A: { 
        count: aProducts.length, 
        pct: (aProducts.length / total * 100).toFixed(0),
        revenue: aProducts.reduce((sum, p) => sum + p.gross_margin, 0),
        revenuePct: totalMargin > 0 ? (aProducts.reduce((sum, p) => sum + p.gross_margin, 0) / totalMargin * 100).toFixed(0) : "0"
      },
      B: { 
        count: bProducts.length, 
        pct: (bProducts.length / total * 100).toFixed(0),
        revenue: bProducts.reduce((sum, p) => sum + p.gross_margin, 0),
        revenuePct: totalMargin > 0 ? (bProducts.reduce((sum, p) => sum + p.gross_margin, 0) / totalMargin * 100).toFixed(0) : "0"
      },
      C: { 
        count: cProducts.length, 
        pct: (cProducts.length / total * 100).toFixed(0),
        revenue: cProducts.reduce((sum, p) => sum + p.gross_margin, 0),
        revenuePct: totalMargin > 0 ? (cProducts.reduce((sum, p) => sum + p.gross_margin, 0) / totalMargin * 100).toFixed(0) : "0"
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
          <h1 className="text-3xl font-bold">Nedēļas Pārdošanas Pārskats</h1>
          <p className="text-muted-foreground mt-1">
            LW vs PW salīdzinājums ar ABC analīzi
            {tenantInfo && (
              <span className="ml-2 text-xs">
                ({tenantInfo.tenantName})
              </span>
            )}
          </p>
          {/* Week selection and data period info */}
          {availableWeeks && availableWeeks.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Datu periods: {availableWeeks.length} nedēļas pieejamas</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {availableWeeks && availableWeeks.length > 0 && (
            <Select value={selectedLwWeek} onValueChange={setSelectedLwWeek}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Izvēlieties nedēļu" />
              </SelectTrigger>
              <SelectContent>
                {availableWeeks.map((week) => (
                  <SelectItem key={week.week_end} value={week.week_end}>
                    Nedēļa: {format(new Date(week.week_end), "dd.MM.yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              LW Pārdots
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
              LW Bruto Marža
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
              Produktu Skaits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{comparisonData.length}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {filteredData.length} filtrēti
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              ABC Sadalījums
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
              <span className="text-muted-foreground">Nav datu</span>
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
                Top Produkti (A)
              </CardTitle>
              <CardDescription>~80% ieņēmumu</CardDescription>
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
                Vidējie Produkti (B)
              </CardTitle>
              <CardDescription>~15% ieņēmumu</CardDescription>
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
                Zemi Produkti (C)
              </CardTitle>
              <CardDescription>~5% ieņēmumu</CardDescription>
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
              <Label className="text-xs">ABC Kategorija</Label>
              <Select value={abcFilter} onValueChange={setAbcFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visas</SelectItem>
                  <SelectItem value="A">A - Top</SelectItem>
                  <SelectItem value="B">B - Vidējie</SelectItem>
                  <SelectItem value="C">C - Zemi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 min-w-[140px]">
              <Label className="text-xs">Kārtot pēc</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="margin_desc">Marža ↓</SelectItem>
                  <SelectItem value="margin_asc">Marža ↑</SelectItem>
                  <SelectItem value="units_desc">Pārdots ↓</SelectItem>
                  <SelectItem value="change_desc">Izaugsme ↓</SelectItem>
                  <SelectItem value="change_asc">Kritums ↓</SelectItem>
                  <SelectItem value="abc">ABC kategorija</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-xs">Meklēt produktu</Label>
              <Input
                placeholder="Nosaukums vai SKU..."
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
              <CardTitle>LW vs PW Salīdzinājums</CardTitle>
              <CardDescription>
                Rāda {displayedData.length} no {filteredData.length} produktiem 
                {comparisonData.length !== filteredData.length && ` (kopā ${comparisonData.length})`}
                {lwWeekEnd && pwWeekEnd && (
                  <span className="ml-2">
                    | LW: {format(new Date(lwWeekEnd), "dd.MM")} | PW: {format(new Date(pwWeekEnd), "dd.MM")}
                  </span>
                )}
              </CardDescription>
            </div>
            {filteredData.length > 100 && (
              <Select 
                value={displayLimit.toString()} 
                onValueChange={(v) => setDisplayLimit(Number(v))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Rādīt..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">Rādīt 100</SelectItem>
                  <SelectItem value="500">Rādīt 500</SelectItem>
                  <SelectItem value="1000">Rādīt 1000</SelectItem>
                  <SelectItem value="99999">Rādīt Visus</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Ielādē datus...</p>
            </div>
          ) : displayedData.length > 0 ? (
            <>
              <div className="rounded-md border overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="sticky left-0 top-0 bg-muted/50 min-w-[200px] z-20">Produkts</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-center w-[60px]">ABC</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-right w-[100px]">LW Pārdots</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-right w-[100px]">PW Pārdots</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-center w-[100px]">Δ Vienības</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-right w-[100px]">LW Marža</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-right w-[100px]">PW Marža</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-center w-[100px]">Δ Marža</TableHead>
                      <TableHead className="sticky top-0 bg-muted/50 text-right w-[80px]">Atlikums</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedData.map((row, idx) => (
                      <TableRow key={`${row.product_id}-${idx}`}>
                        <TableCell className="sticky left-0 bg-background font-medium">
                          <div className="truncate max-w-[200px]" title={row.product_name}>
                            {row.product_name}
                          </div>
                          {row.product_sku && (
                            <div className="text-xs text-muted-foreground truncate">{row.product_sku}</div>
                          )}
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
                          {row.stock_end > 0 ? row.stock_end.toLocaleString() : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {hasMore && (
                <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Rāda {displayedData.length} no {filteredData.length}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setDisplayLimit(prev => Math.min(prev + 500, 99999))}
                  >
                    Rādīt vairāk (+500)
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setDisplayLimit(99999)}
                  >
                    Rādīt Visus ({filteredData.length})
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Nav atrasti dati izvēlētajai nedēļai.</p>
              <p className="text-sm mt-1">Izvēlieties citu nedēļu vai pārbaudiet, vai ir pieejami pārdošanas dati.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ABC Legend */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-6 text-sm">
            <span className="font-medium">ABC Leģenda:</span>
            <div className="flex items-center gap-2">
              <ABCBadge abc="A" />
              <span className="text-muted-foreground">Top produkti (~80% ieņēmumu)</span>
            </div>
            <div className="flex items-center gap-2">
              <ABCBadge abc="B" />
              <span className="text-muted-foreground">Vidējie (~15% ieņēmumu)</span>
            </div>
            <div className="flex items-center gap-2">
              <ABCBadge abc="C" />
              <span className="text-muted-foreground">Zemi (~5% ieņēmumu)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WeeklySales;
