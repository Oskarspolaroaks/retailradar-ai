import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  AlertCircle,
  Search,
  Sparkles,
  BarChart3,
  Target,
  RefreshCw,
  Zap,
  ExternalLink,
  Building2,
  Store,
  Percent,
  ShoppingCart,
  Warehouse,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Clock
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { KPIOnboardingWizard } from "@/components/kpi/KPIOnboardingWizard";
import { AIAdvisorPanel } from "@/components/kpi/AIAdvisorPanel";
import { StoreSelector } from "@/components/kpi/StoreSelector";
import { KPIExportButton } from "@/components/kpi/KPIExportButton";
import { cn } from "@/lib/utils";

// Helper function for consistent KPI number formatting
function formatKPIValue(value: number, unit?: string): string {
    if (unit === "€") {
          if (Math.abs(value) < 1000) {
                  return value.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                  });
          }
          return Math.round(value).toLocaleString("en-US", {
                  maximumFractionDigits: 0,
          });
    }
    if (unit === "%") {
          return value.toLocaleString("en-US", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
          });
    }
    return Math.round(value).toLocaleString("en-US", {
          maximumFractionDigits: 0,
    });
}

// KPI Card Component
const KPICard = ({
  title,
  value,
  unit = "",
  change,
  changeLabel = "vs iepr. periods",
  trend,
  target,
  warning,
  icon,
  gradient,
  size = "md"
}: {
  title: string;
  value: number | string;
  unit?: string;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "neutral";
  target?: number;
  warning?: number;
  icon: React.ReactNode;
  gradient: string;
  size?: "sm" | "md" | "lg";
}) => {
  const numericValue = typeof value === "number" ? value : parseFloat(value) || 0;
  let status: "success" | "warning" | "danger" | "neutral" = "neutral";
  
  if (target !== undefined) {
    if (numericValue >= target) status = "success";
    else if (warning !== undefined && numericValue >= warning) status = "warning";
    else if (warning !== undefined) status = "danger";
  }

  const statusBorder = {
    success: "border-l-success",
    warning: "border-l-warning",
    danger: "border-l-destructive",
    neutral: "border-l-primary",
  };

  return (
    <Card className={cn(
      "group relative overflow-hidden rounded-xl sm:rounded-2xl border-l-4 hover:shadow-lg transition-all duration-300",
      gradient,
      statusBorder[status]
    )}>
      <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-gradient-to-br from-white/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
        <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground leading-tight">{title}</CardTitle>
        <div className="h-7 w-7 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-background/50 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
        <div className={cn("font-bold tracking-tight", size === "lg" ? "text-xl sm:text-4xl" : size === "md" ? "text-lg sm:text-3xl" : "text-base sm:text-2xl")}>
          {typeof value === "number" ? formatKPIValue(value, unit) : value}          {unit && <span className="text-xs sm:text-lg font-normal text-muted-foreground ml-0.5 sm:ml-1">{unit}</span>}
        </div>
        {change !== undefined && (
          <div className="flex items-center gap-1 sm:gap-2 mt-1 sm:mt-2 flex-wrap">
            <Badge 
              variant="secondary" 
              className={cn(
                "border-0 rounded-md sm:rounded-lg text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5",
                change >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}
            >
              {change >= 0 ? (
                <ArrowUpRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />
              ) : (
                <ArrowDownRight className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />
              )}
              {change >= 0 ? "+" : ""}{change.toFixed(1)}%
            </Badge>
            <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">{changeLabel}</span>
          </div>
        )}
        {status === "warning" && target && (
          <p className="text-[10px] sm:text-xs text-warning mt-1 sm:mt-2 flex items-center gap-1">
            <AlertCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            <span className="hidden sm:inline">Below target ({target}{unit})</span>
            <span className="sm:hidden">Below target</span>
          </p>
        )}
        {status === "danger" && warning && (
          <p className="text-[10px] sm:text-xs text-destructive mt-1 sm:mt-2 flex items-center gap-1">
            <AlertCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            <span className="hidden sm:inline">Critical level!</span>
            <span className="sm:hidden">Critical!</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const { toast } = useToast();
  
  // Onboarding & Store Selection
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState("all");
  
  // Filters
  const [dateRange, setDateRange] = useState("30");
  const [abcFilter, setAbcFilter] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Executive KPI Data
  const [kpiData, setKpiData] = useState({
    // Sales Performance
    totalRevenue: 0,
    revenueGrowth: 0,
    unitsSold: 0,
    unitsChange: 0,
    avgTicket: 0,
    avgTicketChange: 0,
    transactionCount: 0,
    revenuePerStore: 0,
    
    // Profitability
    grossMargin: 0,
    marginChange: 0,
    grossMarginEur: 0,
    
    // Assortment
    skuCount: 0,
    aProductsCount: 0,
    bProductsCount: 0,
    cProductsCount: 0,
    aProductsRevenueShare: 0,
    
    // Operations
    avgStockLevel: 0,
    stockTurnover: 0,
    slowMoversCount: 0,
    
    // Pricing
    priceIndexVsMarket: 100,
    cheaperThanMarket: 0,
    moreExpensiveThanMarket: 0,
    promoDependency: 0,
  });

  const [kpiTargets, setKpiTargets] = useState<Record<string, { target: number; warning: number }>>({});
  const [abcData, setAbcData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [bottomProducts, setBottomProducts] = useState<any[]>([]);
  const [storeComparison, setStoreComparison] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataInfo, setDataInfo] = useState<{
    latestDate: string | null;
    earliestDate: string | null;
    usedAutoRange: boolean;
    effectiveDateStr: string | null;
  }>({ latestDate: null, earliestDate: null, usedAutoRange: false, effectiveDateStr: null });

  useEffect(() => {
    initializeDashboard();
  }, []);

  useEffect(() => {
    if (tenantId) {
      fetchDashboardData();
    }
  }, [dateRange, selectedStore, tenantId]);

  const initializeDashboard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check admin status
    const { data: adminData } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });
    setIsAdmin(adminData || false);

    // Get tenant
    const { data: userTenant } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (userTenant) {
      setTenantId(userTenant.tenant_id);

      // Check onboarding status
      const { data: onboarding } = await supabase
        .from("tenant_onboarding")
        .select("kpi_setup_completed")
        .eq("tenant_id", userTenant.tenant_id)
        .single();

      if (!onboarding?.kpi_setup_completed) {
        setShowOnboarding(true);
      }

      // Fetch KPI targets
      const { data: targets } = await supabase
        .from("kpi_targets")
        .select("*")
        .eq("tenant_id", userTenant.tenant_id)
        .eq("scope", "company");

      if (targets) {
        const targetsMap: Record<string, { target: number; warning: number }> = {};
        targets.forEach(t => {
          targetsMap[t.kpi_name] = {
            target: t.target_value,
            warning: t.warning_threshold || t.target_value * 0.8,
          };
        });
        setKpiTargets(targetsMap);
      }
    }
  };

  const fetchDashboardData = async () => {
    setIsLoadingData(true);
    try {
      // Step 1: Determine available data range
      const { data: latestRow } = await supabase
        .from("sales_daily")
        .select("reg_date")
        .order("reg_date", { ascending: false })
        .limit(1);

      const { data: earliestRow } = await supabase
        .from("sales_daily")
        .select("reg_date")
        .order("reg_date", { ascending: true })
        .limit(1);

      const latestDate = latestRow?.[0]?.reg_date || null;
      const earliestDate = earliestRow?.[0]?.reg_date || null;

      if (!latestDate || !earliestDate) {
        setDataInfo({ latestDate: null, earliestDate: null, usedAutoRange: false, effectiveDateStr: null });
        setIsLoadingData(false);
        return;
      }

      // Step 2: Calculate date filter — auto-adjust if no data in selected range
      const daysAgo = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      let dateStr = startDate.toISOString().split('T')[0];
      let usedAutoRange = false;

      // If the filter start date is AFTER the latest data, use the full available range
      if (dateStr > latestDate) {
        dateStr = earliestDate;
        usedAutoRange = true;
      }

      setDataInfo({ latestDate, earliestDate, usedAutoRange, effectiveDateStr: dateStr });

      // Step 3: Fetch products (allow NULL status — most products don't have status set)
      const { data: products } = await supabase
        .from("products")
        .select("*");

      // Fetch categories
      const uniqueCategories = [...new Set(products?.map(p => p.category).filter(Boolean))];
      setCategories(uniqueCategories as string[]);

      // Step 4: Fetch sales data (limited to 1000 for ABC/product analysis)
      const { data: salesData } = await supabase
        .from("sales_daily")
        .select("*")
        .gte("reg_date", dateStr)
        .order("reg_date", { ascending: false });

      // Step 5: Fetch aggregated KPIs via RPC (bypasses 1000 row limit)
      let kpis: any = {};
      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc("get_dashboard_kpis", {
          from_date: dateStr
        });
        if (rpcError) {
          console.warn("RPC get_dashboard_kpis failed, using client-side fallback:", rpcError.message);
        } else {
          kpis = rpcResult || {};
        }
      } catch (rpcErr) {
        console.warn("RPC call exception, using client-side fallback:", rpcErr);
      }

      // Fetch stores
      const { data: stores } = await supabase
        .from("stores")
        .select("*")
        .eq("is_active", true);

      // Step 6: Calculate KPIs — prefer RPC, fallback to client-side from salesData
      let totalRevenue = Number(kpis.total_revenue) || 0;
      let totalUnits = Number(kpis.total_units) || 0;
      let totalReceipts = Number(kpis.total_receipts) || 0;

      // Client-side fallback if RPC returned 0 but we have salesData
      if (totalRevenue === 0 && salesData && salesData.length > 0) {
        totalRevenue = salesData.reduce((sum, s) => sum + (Number(s.selling_price) * Number(s.units_sold)), 0);
        totalUnits = salesData.reduce((sum, s) => sum + Number(s.units_sold), 0);
        const receiptIds = new Set(salesData.map(s => s.id_receipt).filter(Boolean));
        totalReceipts = receiptIds.size;
      }

      // Step 7: Calculate margin from sales_daily (accurate: from actual transactions)
      let grossMarginPct = 0;
      if (salesData && salesData.length > 0) {
        const totalCost = salesData.reduce((sum, s) => {
          const sp = Number(s.selling_price) || 0;
          const pp = Number(s.purchase_price) || 0;
          const units = Number(s.units_sold) || 0;
          // Only include rows where both prices are valid
          if (sp > 0 && pp > 0) {
            return sum + ((sp - pp) * units);
          }
          return sum;
        }, 0);
        const totalRevenueForMargin = salesData.reduce((sum, s) => {
          const sp = Number(s.selling_price) || 0;
          const pp = Number(s.purchase_price) || 0;
          const units = Number(s.units_sold) || 0;
          if (sp > 0 && pp > 0) {
            return sum + (sp * units);
          }
          return sum;
        }, 0);
        grossMarginPct = totalRevenueForMargin > 0 ? (totalCost / totalRevenueForMargin) * 100 : 0;
      }

      // ABC distribution
      const aProducts = products?.filter(p => p.abc_category === 'A') || [];
      const bProducts = products?.filter(p => p.abc_category === 'B') || [];
      const cProducts = products?.filter(p => p.abc_category === 'C') || [];

      // Revenue by ABC
      const aProductIds = aProducts.map(p => p.id);
      const aRevenue = salesData?.filter(s => aProductIds.includes(s.product_id))
        .reduce((sum, s) => sum + (Number(s.selling_price) * Number(s.units_sold)), 0) || 0;
      const aRevenueShare = totalRevenue > 0 ? (aRevenue / totalRevenue) * 100 : 0;

      // Top and bottom products
      const productRevenue = new Map<string, { name: string; revenue: number; margin: number }>();
      salesData?.forEach(sale => {
        const product = products?.find(p => p.id === sale.product_id);
        if (product) {
          const sp = Number(sale.selling_price) || 0;
          const pp = Number(sale.purchase_price) || 0;
          const saleMargin = sp > 0 && pp > 0 ? ((sp - pp) / sp) * 100 : 0;
          const existing = productRevenue.get(sale.product_id) || {
            name: product.name,
            revenue: 0,
            margin: saleMargin
          };
          existing.revenue += sp * Number(sale.units_sold);
          productRevenue.set(sale.product_id, existing);
        }
      });

      const sortedProducts = Array.from(productRevenue.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue);

      setTopProducts(sortedProducts.slice(0, 10));
      setBottomProducts(sortedProducts.slice(-10).reverse());

      // ABC chart data
      setAbcData([
        { name: 'A', products: aProducts.length, revenue: aRevenue, fill: 'hsl(var(--chart-1))' },
        { name: 'B', products: bProducts.length, revenue: salesData?.filter(s => bProducts.map(p => p.id).includes(s.product_id)).reduce((sum, s) => sum + (Number(s.selling_price) * Number(s.units_sold)), 0) || 0, fill: 'hsl(var(--chart-2))' },
        { name: 'C', products: cProducts.length, revenue: salesData?.filter(s => cProducts.map(p => p.id).includes(s.product_id)).reduce((sum, s) => sum + (Number(s.selling_price) * Number(s.units_sold)), 0) || 0, fill: 'hsl(var(--chart-3))' },
      ]);

      // Revenue trend from RPC or salesData
      const rpcDays = kpis.revenue_by_day || [];
      const monthlyRevenue = new Map<string, number>();

      if (rpcDays.length > 0) {
        rpcDays.forEach((d: any) => {
          const month = d.day.substring(0, 7);
          monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + Number(d.revenue));
        });
      } else if (salesData && salesData.length > 0) {
        // Fallback: build from salesData
        salesData.forEach(s => {
          const month = String(s.reg_date).substring(0, 7);
          const rev = Number(s.selling_price) * Number(s.units_sold);
          monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + rev);
        });
      }

      const sortedMonths = Array.from(monthlyRevenue.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([month, revenue]) => ({
          month: new Date(month + '-01').toLocaleDateString('en', { month: 'short' }),
          revenue: Math.round(revenue)
        }));

      setRevenueData(sortedMonths);

      // Average ticket
      const avgTicket = Number(kpis.avg_ticket) || (totalReceipts > 0 ? totalRevenue / totalReceipts : 0);
      const transactionCount = Number(kpis.total_receipts) || totalReceipts;

      // Store avg ticket from RPC (accurate)
      const rpcStores = kpis.revenue_by_store || [];
      if (rpcStores.length > 0) {
        const storeTickets = rpcStores.map((rs: any) => {
          const storeInfo = stores?.find(s => s.id === rs.store_id);
          return {
            id: rs.store_id,
            name: rs.store_name || storeInfo?.name || rs.store_code,
            code: rs.store_code || storeInfo?.code,
            revenue: Number(rs.revenue) || 0,
            avgTicket: Number(rs.avg_ticket) || 0,
            growth: 0,
          };
        }).sort((a: any, b: any) => b.revenue - a.revenue) || [];
        setStoreComparison(storeTickets);
      } else {
        // Fallback: calculate from salesData (limited to 1000 rows but better than nothing)
        const storeData = stores?.map(store => {
          const storeSales = salesData?.filter(s => s.store_id === store.id) || [];
          const storeRevenue = storeSales.reduce((sum, s) => sum + (Number(s.selling_price) * Number(s.units_sold)), 0);
          const storeReceipts = new Set(storeSales.map(s => s.id_receipt).filter(Boolean)).size;
          return {
            id: store.id,
            name: store.name,
            code: store.code,
            revenue: storeRevenue,
            avgTicket: storeReceipts > 0 ? storeRevenue / storeReceipts : 0,
            growth: 0,
          };
        }).sort((a, b) => b.revenue - a.revenue) || [];
        setStoreComparison(storeData);
      }

      // Update KPI data
      setKpiData({
        totalRevenue,
        revenueGrowth: 0,
        unitsSold: totalUnits,
        unitsChange: 0,
        avgTicket,
        avgTicketChange: 0,
        transactionCount,
        revenuePerStore: stores?.length ? totalRevenue / stores.length : 0,

        grossMargin: grossMarginPct,
        marginChange: 0,
        grossMarginEur: totalRevenue * (grossMarginPct / 100),

        skuCount: Number(kpis?.product_stats?.total_products) || products?.length || 0,
        aProductsCount: Number(kpis?.product_stats?.abc_a_count) || aProducts.length,
        bProductsCount: Number(kpis?.product_stats?.abc_b_count) || bProducts.length,
        cProductsCount: Number(kpis?.product_stats?.abc_c_count) || cProducts.length,
        aProductsRevenueShare: aRevenueShare,

        avgStockLevel: 1500,
        stockTurnover: 8.5,
        slowMoversCount: cProducts.filter(p => p.abc_category === 'C').length,

        priceIndexVsMarket: 100,
        cheaperThanMarket: 0,
        moreExpensiveThanMarket: 0,
        promoDependency: 0,
      });

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  const seedDemoData = async () => {
    if (!confirm('Generate demo data. Continue?')) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-data");
      if (error) throw error;

      toast({
        title: "Success!",
        description: `Demo data generated.`,
      });

      await fetchDashboardData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const recalculateABC = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("calculate-abc", {
        body: { period_days: parseInt(dateRange) },
      });
      if (error) throw error;

      toast({ title: "ABC recalculated!" });
      await fetchDashboardData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Show onboarding wizard
  if (showOnboarding && tenantId) {
    return (
      <KPIOnboardingWizard 
        tenantId={tenantId} 
        onComplete={() => {
          setShowOnboarding(false);
          fetchDashboardData();
        }} 
      />
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-8 px-2 sm:px-0">
      {/* Executive Header */}
      <div className="relative overflow-hidden rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/10 via-background to-accent/20 p-4 sm:p-6 md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.1),transparent_50%)]" />
        <div className="relative z-10 flex flex-col gap-4 md:gap-6">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Executive Dashboard
            </h1>
            <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-lg">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex gap-2 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <StoreSelector value={selectedStore} onChange={setSelectedStore} />
              </div>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[100px] sm:w-[140px] rounded-xl bg-background text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  <SelectItem value="7">7 d.</SelectItem>
                  <SelectItem value="30">30 d.</SelectItem>
                  <SelectItem value="90">90 d.</SelectItem>
                  <SelectItem value="365">365 d.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Link to="/" className="flex-1 sm:flex-none">
                <Button variant="outline" className="gap-2 rounded-xl w-full sm:w-auto text-sm">
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">Homepage</span>
                </Button>
              </Link>
              <KPIExportButton
                kpiData={kpiData}
                topProducts={topProducts}
                bottomProducts={bottomProducts}
                storeComparison={storeComparison}
                dateRange={dateRange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      {isAdmin && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-lg">
              <Zap className="h-5 w-5 text-primary" />
              Admin Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              <Button onClick={seedDemoData} disabled={loading} className="gap-2 rounded-xl">
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Demo Dati
              </Button>
              <Button onClick={recalculateABC} disabled={loading} variant="outline" className="gap-2 rounded-xl">
                <BarChart3 className="h-4 w-4" />
                Recalculate ABC
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Freshness Banner */}
      {dataInfo.latestDate && (
        <div className={cn(
          "flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl text-xs sm:text-sm",
          (() => {
            const daysSinceUpdate = Math.floor((Date.now() - new Date(dataInfo.latestDate!).getTime()) / 86400000);
            if (daysSinceUpdate > 30) return "bg-destructive/10 text-destructive border border-destructive/20";
            if (daysSinceUpdate > 7) return "bg-warning/10 text-warning border border-warning/20";
            return "bg-primary/5 text-muted-foreground border border-primary/10";
          })()
        )}>
          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          <span>
            Data period{" "}
            <strong>{new Date(dataInfo.earliestDate!).toLocaleDateString("en-GB")}</strong>
            {" — "}
            <strong>{new Date(dataInfo.latestDate!).toLocaleDateString("en-GB")}</strong>
            {" | Last update: "}
            <strong>{Math.floor((Date.now() - new Date(dataInfo.latestDate!).getTime()) / 86400000)}</strong>
            {" days ago"}
          </span>
          {dataInfo.usedAutoRange && (
            <Badge variant="secondary" className="ml-auto text-[10px] sm:text-xs flex-shrink-0">
              <Info className="h-3 w-3 mr-1" />
              Auto period
            </Badge>
          )}
        </div>
      )}

      {/* Loading indicator */}
      {isLoadingData && (
        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading data...
        </div>
      )}

      {/* PRIMARY KPIs - Sales & Profitability */}
      <section>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Sales Performance
        </h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Revenue"
            value={kpiData.totalRevenue}
            unit="€"
            change={kpiData.revenueGrowth}
            target={kpiTargets.revenue_growth?.target}
            warning={kpiTargets.revenue_growth?.warning}
            icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />}
            gradient="bg-gradient-to-br from-primary/10 to-primary/5"
            size="lg"
          />
          <KPICard
            title="Gross Margin"
            value={kpiData.grossMargin}
            unit="%"
            change={kpiData.marginChange}
            target={kpiTargets.gross_margin?.target}
            warning={kpiTargets.gross_margin?.warning}
            icon={<Percent className="h-4 w-4 sm:h-5 sm:w-5 text-success" />}
            gradient="bg-gradient-to-br from-success/10 to-success/5"
            size="lg"
          />
          <KPICard
            title="Units Sold"
            value={kpiData.unitsSold}
            change={kpiData.unitsChange}
            icon={<ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-chart-3" />}
            gradient="bg-gradient-to-br from-chart-3/10 to-chart-3/5"
            size="lg"
          />
          <KPICard
            title="Avg. Ticket"
            value={kpiData.avgTicket}
            unit="€"
            change={kpiData.avgTicketChange}
            icon={<ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-chart-4" />}
            gradient="bg-gradient-to-br from-chart-4/10 to-chart-4/5"
            size="lg"
          />
        </div>
        
        {/* Average Ticket by Store - Scrollable on mobile */}
        {storeComparison.length > 1 && (
          <div className="mt-4">
            <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Avg. Ticket by Store</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 sm:grid sm:gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 scrollbar-thin">
              {storeComparison.map((store) => (
                <Card key={store.id} className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-muted/30 flex-shrink-0 w-[120px] sm:w-auto">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Store className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium truncate">{store.name || store.code}</span>
                  </div>
                  <div className="mt-1 sm:mt-2">
                                       <span className="text-base sm:text-xl font-bold">{formatKPIValue(store.avgTicket || 0, "€")}</span>
                    <span className="text-xs sm:text-sm text-muted-foreground ml-1">€</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SECONDARY KPIs - Assortment & Operations */}
      <section>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
          <Package className="h-4 w-4 sm:h-5 sm:w-5 text-chart-2" />
          Assortment & Operations
        </h2>
        <div className="grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <KPICard
            title="Active SKU"
            value={kpiData.skuCount}
            icon={<Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />}
            gradient="bg-card"
            size="sm"
          />
          <KPICard
            title="A-Prod. Share"
            value={kpiData.aProductsRevenueShare}
            unit="%"
            target={kpiTargets.a_products_revenue_share?.target}
            warning={kpiTargets.a_products_revenue_share?.warning}
            icon={<BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-chart-1" />}
            gradient="bg-card"
            size="sm"
          />
          <KPICard
            title="Stock Turn"
            value={kpiData.stockTurnover}
            unit="x"
            target={kpiTargets.stock_turnover?.target}
            warning={kpiTargets.stock_turnover?.warning}
            icon={<Warehouse className="h-3 w-3 sm:h-4 sm:w-4 text-chart-2" />}
            gradient="bg-card"
            size="sm"
          />
          <KPICard
            title="Price Index"
            value={kpiData.priceIndexVsMarket}
            unit="%"
            target={100}
            warning={105}
            icon={<Target className="h-3 w-3 sm:h-4 sm:w-4 text-chart-5" />}
            gradient="bg-card"
            size="sm"
          />
          <KPICard
            title="Promo Dep."
            value={kpiData.promoDependency}
            unit="%"
            icon={<AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-warning" />}
            gradient="bg-card"
            size="sm"
          />
        </div>
      </section>

      {/* AI ADVISOR PANEL - Always Visible */}
      <AIAdvisorPanel tenantId={tenantId || undefined} storeId={selectedStore !== "all" ? selectedStore : undefined} />

      {/* Charts & Detailed Analysis */}
      <div id="dashboard-charts" className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        {/* ABC Segmentation */}
        <Card className="rounded-xl sm:rounded-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              ABC Segmentation
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Product and revenue distribution</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <Tabs defaultValue="distribution">
              <TabsList className="mb-3 sm:mb-4 w-full sm:w-auto">
                <TabsTrigger value="distribution" className="flex-1 sm:flex-none text-xs sm:text-sm">Distribution</TabsTrigger>
                <TabsTrigger value="revenue" className="flex-1 sm:flex-none text-xs sm:text-sm">Revenue</TabsTrigger>
              </TabsList>
              
              <TabsContent value="distribution">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={abcData}
                      dataKey="products"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                      paddingAngle={4}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {abcData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="revenue">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={abcData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => `€${Number(value).toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Revenue Trend */}
        <Card className="rounded-xl sm:rounded-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
              Revenue Trend
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Monthly revenue over time</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => `€${Number(value).toLocaleString()}`} />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top & Bottom Products */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="rounded-xl sm:rounded-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-success text-base sm:text-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              Top 10 Produkti
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Highest revenue</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="space-y-2 sm:space-y-3 max-h-[280px] sm:max-h-[350px] overflow-y-auto">
              {topProducts.map((product, i) => (
                <div key={product.id} className="flex justify-between items-center p-2 sm:p-3 bg-muted/30 rounded-lg sm:rounded-xl">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <span className="text-xs sm:text-sm font-bold text-muted-foreground w-5 sm:w-6 flex-shrink-0">#{i + 1}</span>
                    <span className="font-medium truncate text-sm sm:text-base">{product.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-semibold text-sm sm:text-base">€{product.revenue.toLocaleString()}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{product.margin.toFixed(1)}% margin</p>
                  </div>
                </div>
              ))}
              {topProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">No data</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl sm:rounded-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-destructive text-base sm:text-lg">
              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
              Bottom 10 Produkti
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Lowest revenue / margin</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="space-y-2 sm:space-y-3 max-h-[280px] sm:max-h-[350px] overflow-y-auto">
              {bottomProducts.map((product, i) => (
                <div key={product.id} className="flex justify-between items-center p-2 sm:p-3 bg-destructive/5 rounded-lg sm:rounded-xl">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <span className="text-xs sm:text-sm font-bold text-muted-foreground w-5 sm:w-6 flex-shrink-0">#{bottomProducts.length - i}</span>
                    <span className="font-medium truncate text-sm sm:text-base">{product.name}</span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-semibold text-sm sm:text-base">€{product.revenue.toLocaleString()}</p>
                    <Badge variant={product.margin < 10 ? "destructive" : "secondary"} className="text-[10px] sm:text-xs">
                      {product.margin.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
              {bottomProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">No data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Store Comparison */}
      {storeComparison.length > 1 && (
        <Card className="rounded-xl sm:rounded-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Store className="h-4 w-4 sm:h-5 sm:w-5 text-chart-4" />
              Store Comparison
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Performance by store</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <div className="grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
              {storeComparison.slice(0, 8).map((store, i) => (
                <div 
                  key={store.id} 
                  className={cn(
                    "p-3 sm:p-4 rounded-lg sm:rounded-xl",
                    i === 0 ? "bg-success/10 border border-success/20" : 
                    i === storeComparison.length - 1 ? "bg-destructive/10 border border-destructive/20" : 
                    "bg-muted/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <span className="font-medium text-sm sm:text-base truncate">{store.name}</span>
                    {i === 0 && <Badge className="bg-success text-success-foreground text-[10px] sm:text-xs">Top</Badge>}
                  </div>
                  <p className="text-lg sm:text-2xl font-bold">€{store.revenue.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {store.growth >= 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-success" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-destructive" />
                    )}
                    <span className={cn("text-xs sm:text-sm", store.growth >= 0 ? "text-success" : "text-destructive")}>
                      {store.growth >= 0 ? "+" : ""}{store.growth.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
