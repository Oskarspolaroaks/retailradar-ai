import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, TrendingUp, Package, ArrowUpRight, ArrowDownRight, Minus, BarChart3, Trash2, Loader2, RefreshCw, Database, FileSpreadsheet } from "lucide-react";
import { format, subWeeks, subDays, getISOWeek } from "date-fns";
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

// Helper: fetch all rows with pagination (bypass 1000-row PostgREST limit)
async function fetchAllSalesDaily(
  startDate: string,
  endDate: string
): Promise<any[]> {
  const pageSize = 1000;
  let allRows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("sales_daily")
      .select("product_id, selling_price, purchase_price, units_sold, reg_date, products(name, sku, brand, categories(name))")
      .gte("reg_date", startDate)
      .lte("reg_date", endDate)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

// Aggregate sales_daily rows into weekly product summaries
function aggregateToWeeklySummary(rows: any[]): WeeklySummaryRow[] {
  const productMap = new Map<string, WeeklySummaryRow>();

  for (const row of rows) {
    const productId = row.product_id;
    if (!productId) continue;

    const units = Number(row.units_sold) || 0;
    const sellPrice = Number(row.selling_price) || 0;
    const costPrice = Number(row.purchase_price) || 0;
    const margin = (sellPrice - costPrice) * units;

    const existing = productMap.get(productId);
    if (existing) {
      existing.units_sold += units;
      existing.gross_margin += margin;
    } else {
      const product = row.products as any;
      productMap.set(productId, {
        product_id: productId,
        product_name: product?.name || "Unknown",
        product_sku: product?.sku || "",
        product_brand: product?.brand || null,
        category_name: product?.categories?.name || null,
        units_sold: units,
        gross_margin: margin,
        stock_end: 0,
      });
    }
  }

  return Array.from(productMap.values());
}

const WeeklySales = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [productSearch, setProductSearch] = useState<string>("");
  const [abcFilter, setAbcFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("margin_desc");
  const [displayLimit, setDisplayLimit] = useState<number>(100);
  const [selectedLwWeek, setSelectedLwWeek] = useState<string>("");
  const [dataSource, setDataSource] = useState<"pos" | "import">("pos");
  const [rpcAvailable, setRpcAvailable] = useState<boolean | null>(null);

  // ===== POS DATA SOURCE (sales_daily) =====

  // Fetch available weeks - try RPC first, fall back to direct query
  const { data: availableWeeks, isLoading: weeksLoading } = useQuery({
    queryKey: ["available-weeks-pos"],
    queryFn: async () => {
      // Try RPC first
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: userTenants } = await supabase
          .from("user_tenants")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();

        if (!userTenants) throw new Error("No tenant found");

        const { data, error } = await supabase.rpc("get_available_weeks", {
          p_tenant_id: userTenants.tenant_id
        });

        if (!error && data && data.length > 0) {
          setRpcAvailable(true);
          console.log("[WeeklySales] RPC get_available_weeks succeeded:", data.length, "weeks");
          return (data as { week_end: string; record_count: number }[]);
        }

        // RPC returned empty or error - fall through to direct query
        if (error) {
          console.warn("[WeeklySales] RPC get_available_weeks failed:", error.message);
        }
      } catch (e: any) {
        console.warn("[WeeklySales] RPC attempt failed:", e.message);
      }

      // Fallback: query sales_daily directly to find date range, then compute weeks
      setRpcAvailable(false);
      console.log("[WeeklySales] Falling back to direct sales_daily query for weeks");

      const { data: dateRange, error: dateError } = await supabase
        .from("sales_daily")
        .select("reg_date")
        .order("reg_date", { ascending: false })
        .limit(1);

      if (dateError) throw dateError;
      if (!dateRange || dateRange.length === 0) return [];

      const { data: minDateData } = await supabase
        .from("sales_daily")
        .select("reg_date")
        .order("reg_date", { ascending: true })
        .limit(1);

      const maxDate = new Date(dateRange[0].reg_date);
      const minDate = minDateData?.[0] ? new Date(minDateData[0].reg_date) : maxDate;

      // Generate weekly periods from the data range
      const weeks: { week_end: string; record_count: number }[] = [];
      let currentEnd = new Date(maxDate);

      // Align to Sunday (end of week)
      const dayOfWeek = currentEnd.getDay();
      if (dayOfWeek !== 0) {
        currentEnd.setDate(currentEnd.getDate() + (7 - dayOfWeek));
      }

      while (currentEnd >= minDate) {
        const weekEnd = format(currentEnd, "yyyy-MM-dd");
        weeks.push({ week_end: weekEnd, record_count: 0 });
        currentEnd = subWeeks(currentEnd, 1);
        if (weeks.length >= 10) break; // Max 10 weeks
      }

      console.log("[WeeklySales] Generated", weeks.length, "week periods from sales_daily");
      return weeks;
    },
    enabled: dataSource === "pos",
  });

  // Set default week when available weeks load
  useEffect(() => {
    if (availableWeeks && availableWeeks.length > 0 && !selectedLwWeek) {
      setSelectedLwWeek(availableWeeks[0].week_end);
    }
  }, [availableWeeks, selectedLwWeek]);

  // Calculate LW and PW dates
  const { lwWeekEnd, pwWeekEnd, lwWeekStart, pwWeekStart } = useMemo(() => {
    if (!selectedLwWeek) {
      return { lwWeekEnd: null, pwWeekEnd: null, lwWeekStart: null, pwWeekStart: null };
    }
    const lwEnd = new Date(selectedLwWeek);
    const lwStart = subDays(lwEnd, 6);
    const pwEnd = subWeeks(lwEnd, 1);
    const pwStart = subDays(pwEnd, 6);
    return {
      lwWeekEnd: selectedLwWeek,
      pwWeekEnd: format(pwEnd, "yyyy-MM-dd"),
      lwWeekStart: format(lwStart, "yyyy-MM-dd"),
      pwWeekStart: format(pwStart, "yyyy-MM-dd"),
    };
  }, [selectedLwWeek]);

  // Fetch LW data - try RPC, fall back to direct query
  const { data: lwData, isLoading: lwLoading } = useQuery({
    queryKey: ["weekly-sales-lw-pos", lwWeekEnd, rpcAvailable],
    queryFn: async () => {
      if (!lwWeekEnd || !lwWeekStart) return [];

      // Try RPC first if available
      if (rpcAvailable) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");
          const { data: userTenants } = await supabase
            .from("user_tenants")
            .select("tenant_id")
            .eq("user_id", user.id)
            .single();
          if (!userTenants) throw new Error("No tenant found");

          const { data, error } = await supabase.rpc("get_weekly_sales_summary", {
            p_tenant_id: userTenants.tenant_id,
            p_week_end: lwWeekEnd
          });
          if (!error && data) {
            console.log("[WeeklySales] RPC LW data:", data.length, "products");
            return data as WeeklySummaryRow[];
          }
        } catch (e: any) {
          console.warn("[WeeklySales] RPC LW failed, using fallback:", e.message);
        }
      }

      // Fallback: fetch from sales_daily and aggregate
      console.log("[WeeklySales] Fetching LW from sales_daily:", lwWeekStart, "to", lwWeekEnd);
      const rows = await fetchAllSalesDaily(lwWeekStart, lwWeekEnd);
      console.log("[WeeklySales] LW raw rows:", rows.length);
      const summary = aggregateToWeeklySummary(rows);
      console.log("[WeeklySales] LW aggregated products:", summary.length);
      return summary;
    },
    enabled: dataSource === "pos" && !!lwWeekEnd && !!lwWeekStart,
  });

  // Fetch PW data
  const { data: pwData, isLoading: pwLoading } = useQuery({
    queryKey: ["weekly-sales-pw-pos", pwWeekEnd, rpcAvailable],
    queryFn: async () => {
      if (!pwWeekEnd || !pwWeekStart) return [];

      // Try RPC first if available
      if (rpcAvailable) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Not authenticated");
          const { data: userTenants } = await supabase
            .from("user_tenants")
            .select("tenant_id")
            .eq("user_id", user.id)
            .single();
          if (!userTenants) throw new Error("No tenant found");

          const { data, error } = await supabase.rpc("get_weekly_sales_summary", {
            p_tenant_id: userTenants.tenant_id,
            p_week_end: pwWeekEnd
          });
          if (!error && data) {
            console.log("[WeeklySales] RPC PW data:", data.length, "products");
            return data as WeeklySummaryRow[];
          }
        } catch (e: any) {
          console.warn("[WeeklySales] RPC PW failed, using fallback:", e.message);
        }
      }

      // Fallback
      console.log("[WeeklySales] Fetching PW from sales_daily:", pwWeekStart, "to", pwWeekEnd);
      const rows = await fetchAllSalesDaily(pwWeekStart, pwWeekEnd);
      console.log("[WeeklySales] PW raw rows:", rows.length);
      const summary = aggregateToWeeklySummary(rows);
      console.log("[WeeklySales] PW aggregated products:", summary.length);
      return summary;
    },
    enabled: dataSource === "pos" && !!pwWeekEnd && !!pwWeekStart,
  });

  // ===== IMPORT DATA SOURCE (weekly_sales table) =====

  const { data: importWeeklySales, isLoading: importLoading, refetch: refetchImport } = useQuery({
    queryKey: ["weekly-sales-import"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userTenants } = await supabase
        .from("user_tenants")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!userTenants) throw new Error("No tenant found");

      // Paginated fetch to bypass 1000-row limit
      const pageSize = 1000;
      let allData: any[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
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
          `)
          .eq("tenant_id", userTenants.tenant_id)
          .order("week_end", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allData = allData.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      console.log(`[WeeklySales] Loaded ${allData.length} imported weekly sales records`);
      return allData;
    },
    enabled: dataSource === "import",
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
      queryClient.invalidateQueries({ queryKey: ["weekly-sales-import"] });
      toast({
        title: "Data deleted",
        description: "All imported weekly sales data has been deleted.",
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

  // Mutation to update product ABC categories in products table
  const updateAbcMutation = useMutation({
    mutationFn: async (abcData: Array<{ product_id: string; abc_category: "A" | "B" | "C" }>) => {
      const groupedByCategory = abcData.reduce((acc, item) => {
        if (!acc[item.abc_category]) acc[item.abc_category] = [];
        acc[item.abc_category].push(item.product_id);
        return acc;
      }, {} as Record<string, string[]>);

      const batchSize = 100;
      for (const [category, productIds] of Object.entries(groupedByCategory)) {
        for (let i = 0; i < productIds.length; i += batchSize) {
          const batchIds = productIds.slice(i, i + batchSize);
          const { error } = await supabase
            .from("products")
            .update({ abc_category: category })
            .in("id", batchIds);

          if (error) {
            throw new Error(`Failed to update ${category} products: ${error.message}`);
          }
        }
      }
      return abcData.length;
    },
    onSuccess: (count) => {
      toast({
        title: "ABC categories updated",
        description: `Successfully updated ${count} products with LW ABC values.`,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ===== UNIFIED DATA PROCESSING =====

  const isLoading = dataSource === "pos"
    ? (weeksLoading || lwLoading || pwLoading)
    : importLoading;

  // Process POS data
  const posResult = useMemo(() => {
    if (dataSource !== "pos" || !lwData || lwData.length === 0) {
      return {
        abcAnalysis: { LW: [] as ProductWithABC[], PW: [] as ProductWithABC[], abcMap: new Map() },
        comparisonData: [] as ComparisonRow[],
        totals: { lwUnits: 0, pwUnits: 0, lwMargin: 0, pwMargin: 0 },
        lwWithABC: [] as ProductWithABC[]
      };
    }

    const lwWithABC = assignABC(lwData);
    const pwWithABC = pwData ? assignABC(pwData) : [];

    const abcMap = new Map<string, { LW?: "A" | "B" | "C", PW?: "A" | "B" | "C" }>();
    lwWithABC.forEach(p => {
      abcMap.set(p.product_id, { ...abcMap.get(p.product_id), LW: p.abc_category });
    });
    pwWithABC.forEach(p => {
      abcMap.set(p.product_id, { ...abcMap.get(p.product_id), PW: p.abc_category });
    });

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

    productMap.forEach((row) => {
      row.units_change = row.lw_units - row.pw_units;
      row.margin_change = row.lw_margin - row.pw_margin;
      row.units_change_pct = row.pw_units > 0 ? ((row.lw_units - row.pw_units) / row.pw_units) * 100 : (row.lw_units > 0 ? 100 : 0);
      row.margin_change_pct = row.pw_margin > 0 ? ((row.lw_margin - row.pw_margin) / row.pw_margin) * 100 : (row.lw_margin > 0 ? 100 : 0);
    });

    const comparison = Array.from(productMap.values());
    const totals = {
      lwUnits: comparison.reduce((sum, r) => sum + r.lw_units, 0),
      pwUnits: comparison.reduce((sum, r) => sum + r.pw_units, 0),
      lwMargin: comparison.reduce((sum, r) => sum + r.lw_margin, 0),
      pwMargin: comparison.reduce((sum, r) => sum + r.pw_margin, 0),
    };

    return {
      abcAnalysis: { LW: lwWithABC, PW: pwWithABC, abcMap },
      comparisonData: comparison,
      totals,
      lwWithABC
    };
  }, [dataSource, lwData, pwData]);

  // Process Import data
  const importResult = useMemo(() => {
    if (dataSource !== "import" || !importWeeklySales || importWeeklySales.length === 0) {
      return {
        abcAnalysis: { LW: [] as ProductWithABC[], PW: [] as ProductWithABC[], abcMap: new Map() },
        comparisonData: [] as ComparisonRow[],
        totals: { lwUnits: 0, pwUnits: 0, lwMargin: 0, pwMargin: 0 },
        lwWithABC: [] as ProductWithABC[]
      };
    }

    const lwSales = importWeeklySales.filter((s: any) => s.period_type === "LW");
    const pwSales = importWeeklySales.filter((s: any) => s.period_type === "PW");

    type ImportAgg = { product_id: string; product_name: string; product_sku: string; product_brand: string | null; category_name: string | null; units_sold: number; gross_margin: number; stock_end: number };

    const aggregateImport = (sales: any[]): ImportAgg[] => {
      const map = new Map<string, ImportAgg>();
      sales.forEach((sale: any) => {
        const key = sale.product_id || sale.product_name;
        const existing = map.get(key);
        if (existing) {
          existing.units_sold += Number(sale.units_sold) || 0;
          existing.gross_margin += Number(sale.gross_margin) || 0;
        } else {
          map.set(key, {
            product_id: sale.product_id || key,
            product_name: sale.product_name,
            product_sku: sale.products?.sku || "",
            product_brand: sale.products?.brand || null,
            category_name: sale.products?.category || null,
            units_sold: Number(sale.units_sold) || 0,
            gross_margin: Number(sale.gross_margin) || 0,
            stock_end: sale.stock_end ? Number(sale.stock_end) : 0,
          });
        }
      });
      return Array.from(map.values());
    };

    const lwAgg = aggregateImport(lwSales);
    const pwAgg = aggregateImport(pwSales);
    const lwWithABC = assignABC(lwAgg);
    const pwWithABC = assignABC(pwAgg);

    const abcMap = new Map<string, { LW?: "A" | "B" | "C", PW?: "A" | "B" | "C" }>();
    lwWithABC.forEach(p => { abcMap.set(p.product_id, { ...abcMap.get(p.product_id), LW: p.abc_category }); });
    pwWithABC.forEach(p => { abcMap.set(p.product_id, { ...abcMap.get(p.product_id), PW: p.abc_category }); });

    const productMap = new Map<string, ComparisonRow>();

    lwWithABC.forEach(item => {
      const abc = abcMap.get(item.product_id);
      productMap.set(item.product_id, {
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        product_brand: item.product_brand,
        category_name: item.category_name,
        lw_units: item.units_sold,
        pw_units: 0,
        lw_margin: item.gross_margin,
        pw_margin: 0,
        stock_end: item.stock_end,
        units_change: 0, units_change_pct: 0,
        margin_change: 0, margin_change_pct: 0,
        abc_lw: abc?.LW || null,
        abc_pw: abc?.PW || null,
      });
    });

    pwWithABC.forEach(item => {
      const existing = productMap.get(item.product_id);
      const abc = abcMap.get(item.product_id);
      if (existing) {
        existing.pw_units = item.units_sold;
        existing.pw_margin = item.gross_margin;
        existing.abc_pw = abc?.PW || null;
      } else {
        productMap.set(item.product_id, {
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          product_brand: item.product_brand,
          category_name: item.category_name,
          lw_units: 0, pw_units: item.units_sold,
          lw_margin: 0, pw_margin: item.gross_margin,
          stock_end: item.stock_end,
          units_change: 0, units_change_pct: 0,
          margin_change: 0, margin_change_pct: 0,
          abc_lw: abc?.LW || null,
          abc_pw: abc?.PW || null,
        });
      }
    });

    productMap.forEach((row) => {
      row.units_change = row.lw_units - row.pw_units;
      row.margin_change = row.lw_margin - row.pw_margin;
      row.units_change_pct = row.pw_units > 0 ? ((row.lw_units - row.pw_units) / row.pw_units) * 100 : (row.lw_units > 0 ? 100 : 0);
      row.margin_change_pct = row.pw_margin > 0 ? ((row.lw_margin - row.pw_margin) / row.pw_margin) * 100 : (row.lw_margin > 0 ? 100 : 0);
    });

    const comparison = Array.from(productMap.values());
    const totals = {
      lwUnits: comparison.reduce((sum, r) => sum + r.lw_units, 0),
      pwUnits: comparison.reduce((sum, r) => sum + r.pw_units, 0),
      lwMargin: comparison.reduce((sum, r) => sum + r.lw_margin, 0),
      pwMargin: comparison.reduce((sum, r) => sum + r.pw_margin, 0),
    };

    return { abcAnalysis: { LW: lwWithABC, PW: pwWithABC, abcMap }, comparisonData: comparison, totals, lwWithABC };
  }, [dataSource, importWeeklySales]);

  // Select active result
  const activeResult = dataSource === "pos" ? posResult : importResult;
  const { abcAnalysis, comparisonData, totals } = activeResult;
  const lwWithABC = activeResult.lwWithABC;

  // Filter and sort comparison data
  const filteredData = useMemo(() => {
    let data = comparisonData.filter(row => {
      const matchesProduct = !productSearch ||
        row.product_name.toLowerCase().includes(productSearch.toLowerCase()) ||
        row.product_sku?.toLowerCase().includes(productSearch.toLowerCase());
      const matchesABC = abcFilter === "all" || row.abc_lw === abcFilter;
      return matchesProduct && matchesABC;
    });

    switch (sortBy) {
      case "margin_desc": data.sort((a, b) => b.lw_margin - a.lw_margin); break;
      case "margin_asc": data.sort((a, b) => a.lw_margin - b.lw_margin); break;
      case "units_desc": data.sort((a, b) => b.lw_units - a.lw_units); break;
      case "change_desc": data.sort((a, b) => b.margin_change_pct - a.margin_change_pct); break;
      case "change_asc": data.sort((a, b) => a.margin_change_pct - b.margin_change_pct); break;
      case "abc": data.sort((a, b) => {
        const order = { A: 0, B: 1, C: 2 };
        return (order[a.abc_lw || "C"] || 2) - (order[b.abc_lw || "C"] || 2);
      }); break;
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
          </p>
          {/* Data source and period info */}
          {dataSource === "pos" && availableWeeks && availableWeeks.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Database className="h-3.5 w-3.5" />
                <span>Source: POS data (sales_daily)</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{availableWeeks.length} weeks available</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Data source toggle */}
          <Tabs value={dataSource} onValueChange={(v) => setDataSource(v as "pos" | "import")} className="mr-2">
            <TabsList className="h-9">
              <TabsTrigger value="pos" className="text-xs gap-1.5 px-3">
                <Database className="h-3.5 w-3.5" />
                POS Data
              </TabsTrigger>
              <TabsTrigger value="import" className="text-xs gap-1.5 px-3">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Import
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Week selector (POS mode) */}
          {dataSource === "pos" && availableWeeks && availableWeeks.length > 0 && (
            <Select value={selectedLwWeek} onValueChange={setSelectedLwWeek}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {availableWeeks.map((week) => {
                  const weekEndDate = new Date(week.week_end);
                  const weekStartDate = subDays(weekEndDate, 6);
                  const weekNumber = getISOWeek(weekEndDate);
                  return (
                    <SelectItem key={week.week_end} value={week.week_end}>
                      Week {weekNumber} ({format(weekStartDate, "dd.MM")} - {format(weekEndDate, "dd.MM.yyyy")})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}

          {/* Import controls */}
          {dataSource === "import" && (
            <>
              {importWeeklySales && importWeeklySales.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all imported data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete {importWeeklySales.length} records. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteAllMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <WeeklySalesImportDialog onImportComplete={() => refetchImport()} />
            </>
          )}
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
              <CardDescription>~80% of margin</CardDescription>
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
              <CardDescription>~15% of margin</CardDescription>
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
              <CardDescription>~5% of margin</CardDescription>
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
                placeholder="Name or SKU..."
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
                {dataSource === "pos" && lwWeekEnd && pwWeekEnd && (
                  <span className="ml-2">
                    | LW: {format(new Date(lwWeekEnd), "dd.MM")} | PW: {format(new Date(pwWeekEnd), "dd.MM")}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Refresh ABC button */}
              <Button
                variant="outline"
                size="sm"
                disabled={updateAbcMutation.isPending || lwWithABC.length === 0}
                onClick={() => {
                  const abcData = lwWithABC.map(p => ({
                    product_id: p.product_id,
                    abc_category: p.abc_category
                  }));
                  updateAbcMutation.mutate(abcData);
                }}
              >
                {updateAbcMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh ABC
              </Button>
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
              {dataSource === "pos" ? (
                <>
                  <p>No data found for the selected week.</p>
                  <p className="text-sm mt-1">Select a different week or check if sales data is available.</p>
                </>
              ) : (
                <>
                  <p>No imported data found.</p>
                  <p className="text-sm mt-1">Import a Spirits&Wine Excel file to see the report.</p>
                </>
              )}
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
              <span className="text-muted-foreground">Top products (~80% margin)</span>
            </div>
            <div className="flex items-center gap-2">
              <ABCBadge abc="B" />
              <span className="text-muted-foreground">Mid (~15% margin)</span>
            </div>
            <div className="flex items-center gap-2">
              <ABCBadge abc="C" />
              <span className="text-muted-foreground">Low (~5% margin)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WeeklySales;
