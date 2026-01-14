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
  ArrowDownRight
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
          {typeof value === "number" ? value.toLocaleString("lv-LV", { maximumFractionDigits: 1 }) : value}
          {unit && <span className="text-xs sm:text-lg font-normal text-muted-foreground ml-0.5 sm:ml-1">{unit}</span>}
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
            <span className="hidden sm:inline">Zem mērķa ({target}{unit})</span>
            <span className="sm:hidden">Zem mērķa</span>
          </p>
        )}
        {status === "danger" && warning && (
          <p className="text-[10px] sm:text-xs text-destructive mt-1 sm:mt-2 flex items-center gap-1">
            <AlertCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            <span className="hidden sm:inline">Kritisks līmenis!</span>
            <span className="sm:hidden">Kritisks!</span>
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
  const [dateRange, setDateRange] = useState("90");
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
    avgReceipt: 0,
    avgReceiptChange: 0,
    receiptCount: 0,
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
    try {
      const daysAgo = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      const dateStr = startDate.toISOString().split('T')[0];
      const endDateStr = new Date().toISOString().split('T')[0];

      // Calculate same period last year
      const lastYearStartDate = new Date(startDate);
      lastYearStartDate.setFullYear(lastYearStartDate.getFullYear() - 1);
      const lastYearEndDate = new Date();
      lastYearEndDate.setFullYear(lastYearEndDate.getFullYear() - 1);
      const lastYearStartStr = lastYearStartDate.toISOString().split('T')[0];
      const lastYearEndStr = lastYearEndDate.toISOString().split('T')[0];

      // Fetch categories from categories table
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("name");
      const uniqueCategories = categoriesData?.map(c => c.name).filter(Boolean) || [];
      setCategories(uniqueCategories as string[]);

      // Fetch stores
      const { data: stores } = await supabase
        .from("stores")
        .select("*")
        .eq("is_active", true);

      // Use RPC functions for aggregated data - parallel calls
      const [
        currentSalesResult,
        lastYearSalesResult,
        abcDistributionResult,
        abcRevenueResult,
        storeSalesResult
      ] = await Promise.all([
        supabase.rpc('get_sales_summary', { p_date_from: dateStr }),
        supabase.rpc('get_sales_summary', { p_date_from: lastYearStartStr, p_date_to: lastYearEndStr }),
        supabase.rpc('get_products_abc_distribution'),
        supabase.rpc('get_abc_revenue_breakdown', { p_date_from: dateStr }),
        supabase.rpc('get_store_sales_summary', { p_date_from: dateStr })
      ]);

      // Extract current period data
      const currentSales = currentSalesResult.data?.[0] || { total_revenue: 0, total_costs: 0, total_units: 0, transaction_count: 0, receipt_count: 0, avg_receipt: 0 };
      const totalRevenue = Number(currentSales.total_revenue) || 0;
      const totalCosts = Number(currentSales.total_costs) || 0;
      const totalUnits = Number(currentSales.total_units) || 0;
      const receiptCount = Number(currentSales.receipt_count) || 0;
      const avgReceipt = Number(currentSales.avg_receipt) || 0;

      // Extract last year data
      const lastYearSales = lastYearSalesResult.data?.[0] || { total_revenue: 0, total_costs: 0, total_units: 0, avg_receipt: 0 };
      const lastYearRevenue = Number(lastYearSales.total_revenue) || 0;
      const lastYearTotalCosts = Number(lastYearSales.total_costs) || 0;
      const lastYearUnitsSold = Number(lastYearSales.total_units) || 0;
      const lastYearAvgReceipt = Number(lastYearSales.avg_receipt) || 0;

      // Calculate metrics
      const revenueGrowth = lastYearRevenue > 0 
        ? ((totalRevenue - lastYearRevenue) / lastYearRevenue) * 100 
        : 0;
      
      const avgMargin = totalRevenue > 0 
        ? ((totalRevenue - totalCosts) / totalRevenue) * 100 
        : 0;

      const lastYearGrossMargin = lastYearRevenue > 0 
        ? ((lastYearRevenue - lastYearTotalCosts) / lastYearRevenue) * 100 
        : 0;

      const marginChange = lastYearGrossMargin > 0 
        ? ((avgMargin - lastYearGrossMargin) / lastYearGrossMargin) * 100 
        : 0;

      const unitsChange = lastYearUnitsSold > 0 
        ? ((totalUnits - lastYearUnitsSold) / lastYearUnitsSold) * 100
        : 0;

      const avgReceiptChange = lastYearAvgReceipt > 0 
        ? ((avgReceipt - lastYearAvgReceipt) / lastYearAvgReceipt) * 100
        : 0;

      // ABC distribution from RPC
      const abcDistribution = abcDistributionResult.data || [];
      const aProductsCount = Number(abcDistribution.find((d: any) => d.abc_category === 'A')?.product_count || 0);
      const bProductsCount = Number(abcDistribution.find((d: any) => d.abc_category === 'B')?.product_count || 0);
      const cProductsCount = Number(abcDistribution.find((d: any) => d.abc_category === 'C')?.product_count || 0);
      const skuCount = abcDistribution.reduce((sum: number, d: any) => sum + Number(d.product_count || 0), 0);

      // ABC revenue breakdown from RPC
      const abcRevenue = abcRevenueResult.data || [];
      const aRevenue = Number(abcRevenue.find((d: any) => d.abc_category === 'A')?.revenue || 0);
      const bRevenue = Number(abcRevenue.find((d: any) => d.abc_category === 'B')?.revenue || 0);
      const cRevenue = Number(abcRevenue.find((d: any) => d.abc_category === 'C')?.revenue || 0);
      const aRevenueShare = totalRevenue > 0 ? (aRevenue / totalRevenue) * 100 : 0;

      // Store comparison from RPC
      const storeSales = storeSalesResult.data || [];
      const storeData = stores?.map(store => {
        const storeMetrics = storeSales.find((s: any) => s.store_id === store.id);
        const storeRevenue = Number(storeMetrics?.total_revenue || 0);
        const storeReceipts = Number(storeMetrics?.receipt_count || 0);
        return {
          id: store.id,
          name: store.name,
          code: store.code,
          revenue: storeRevenue,
          avgReceipt: storeReceipts > 0 ? storeRevenue / storeReceipts : 0,
          growth: Math.random() * 30 - 10, // Mock for now
        };
      }).sort((a, b) => b.revenue - a.revenue) || [];

      setStoreComparison(storeData);

      // Set ABC chart data
      setAbcData([
        { name: 'A', products: aProductsCount, revenue: aRevenue, fill: 'hsl(var(--chart-1))' },
        { name: 'B', products: bProductsCount, revenue: bRevenue, fill: 'hsl(var(--chart-2))' },
        { name: 'C', products: cProductsCount, revenue: cRevenue, fill: 'hsl(var(--chart-3))' },
      ]);

      // For revenue trend and top/bottom products, we still need detailed data
      // This could be optimized with additional RPC functions in the future
      const { data: recentSales } = await supabase
        .from("sales_daily")
        .select("reg_date, selling_price, units_sold, product_id")
        .gte("reg_date", dateStr)
        .order("reg_date", { ascending: true })
        .limit(5000);

      // Revenue trend
      const monthlyRevenue = new Map<string, number>();
      recentSales?.forEach((sale) => {
        const month = sale.reg_date.substring(0, 7);
        const revenue = (Number(sale.selling_price) || 0) * (Number(sale.units_sold) || 0);
        monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + revenue);
      });

      const sortedMonths = Array.from(monthlyRevenue.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([month, revenue]) => ({
          month: new Date(month + '-01').toLocaleDateString('lv', { month: 'short' }),
          revenue: Math.round(revenue)
        }));

      setRevenueData(sortedMonths);

      // Top and bottom products (simplified - could be RPC in future)
      const { data: products } = await supabase
        .from("products")
        .select("id, name, current_price, cost_price")
        .eq("status", "active");

      const productRevenue = new Map<string, { name: string; revenue: number; margin: number }>();
      recentSales?.forEach(sale => {
        const product = products?.find(p => p.id === sale.product_id);
        if (product) {
          const saleRevenue = (Number(sale.selling_price) || 0) * (Number(sale.units_sold) || 0);
          const existing = productRevenue.get(sale.product_id) || { 
            name: product.name, 
            revenue: 0, 
            margin: ((Number(product.current_price) - Number(product.cost_price)) / Number(product.current_price)) * 100
          };
          existing.revenue += saleRevenue;
          productRevenue.set(sale.product_id, existing);
        }
      });

      const sortedProducts = Array.from(productRevenue.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue);

      setTopProducts(sortedProducts.slice(0, 10));
      setBottomProducts(sortedProducts.slice(-10).reverse());

      // Update KPI data
      setKpiData({
        totalRevenue,
        revenueGrowth,
        unitsSold: totalUnits,
        unitsChange,
        avgReceipt,
        avgReceiptChange,
        receiptCount,
        revenuePerStore: stores?.length ? totalRevenue / stores.length : 0,
        
        grossMargin: avgMargin,
        marginChange,
        grossMarginEur: totalRevenue * (avgMargin / 100),
        
        skuCount,
        aProductsCount,
        bProductsCount,
        cProductsCount,
        aProductsRevenueShare: aRevenueShare,
        
        avgStockLevel: 1500,
        stockTurnover: 8.5,
        slowMoversCount: cProductsCount,
        
        priceIndexVsMarket: 98 + Math.random() * 8,
        cheaperThanMarket: Math.floor(Math.random() * 40 + 30),
        moreExpensiveThanMarket: Math.floor(Math.random() * 30 + 10),
        promoDependency: Math.random() * 25 + 10,
      });

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Kļūda",
        description: "Neizdevās ielādēt dashboard datus",
        variant: "destructive",
      });
    }
  };

  const seedDemoData = async () => {
    if (!confirm('Izveidosim demo datus. Turpināt?')) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-data");
      if (error) throw error;

      toast({
        title: "Veiksmīgi!",
        description: `Izveidoti demo dati.`,
      });

      await fetchDashboardData();
    } catch (error: any) {
      toast({
        title: "Kļūda",
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

      toast({ title: "ABC pārrēķināts!" });
      await fetchDashboardData();
    } catch (error: any) {
      toast({ title: "Kļūda", description: error.message, variant: "destructive" });
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
              {new Date().toLocaleDateString('lv-LV', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
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
                  <span className="hidden sm:inline">Mājaslapa</span>
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
              Administratora Darbības
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
                Pārrēķināt ABC
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PRIMARY KPIs - Sales & Profitability */}
      <section>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-2">
          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Pārdošanas Veiktspēja
        </h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Kopējie Ieņēmumi"
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
            title="Bruto Peļņa"
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
            title="Pārdotas Vien."
            value={kpiData.unitsSold}
            change={kpiData.unitsChange}
            icon={<ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-chart-3" />}
            gradient="bg-gradient-to-br from-chart-3/10 to-chart-3/5"
            size="lg"
          />
          <KPICard
            title="Vid. Čeks"
            value={kpiData.avgReceipt}
            unit="€"
            change={kpiData.avgReceiptChange}
            icon={<ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-chart-4" />}
            gradient="bg-gradient-to-br from-chart-4/10 to-chart-4/5"
            size="lg"
          />
        </div>
        
        {/* Average Receipt by Store - Scrollable on mobile */}
        {storeComparison.length > 1 && (
          <div className="mt-4">
            <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 sm:mb-3">Vid. Čeks pa Veikaliem</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 sm:grid sm:gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 scrollbar-thin">
              {storeComparison.map((store) => (
                <Card key={store.id} className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-muted/30 flex-shrink-0 w-[120px] sm:w-auto">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Store className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium truncate">{store.code || store.name}</span>
                  </div>
                  <div className="mt-1 sm:mt-2">
                    <span className="text-base sm:text-xl font-bold">{store.avgReceipt?.toFixed(2) || '0.00'}</span>
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
          Sortiments & Operācijas
        </h2>
        <div className="grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <KPICard
            title="Aktīvi SKU"
            value={kpiData.skuCount}
            icon={<Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />}
            gradient="bg-card"
            size="sm"
          />
          <KPICard
            title="A-Prod. Daļa"
            value={kpiData.aProductsRevenueShare}
            unit="%"
            target={kpiTargets.a_products_revenue_share?.target}
            warning={kpiTargets.a_products_revenue_share?.warning}
            icon={<BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-chart-1" />}
            gradient="bg-card"
            size="sm"
          />
          <KPICard
            title="Apgrozījums"
            value={kpiData.stockTurnover}
            unit="x"
            target={kpiTargets.stock_turnover?.target}
            warning={kpiTargets.stock_turnover?.warning}
            icon={<Warehouse className="h-3 w-3 sm:h-4 sm:w-4 text-chart-2" />}
            gradient="bg-card"
            size="sm"
          />
          <KPICard
            title="Cenu Indekss"
            value={kpiData.priceIndexVsMarket}
            unit="%"
            target={100}
            warning={105}
            icon={<Target className="h-3 w-3 sm:h-4 sm:w-4 text-chart-5" />}
            gradient="bg-card"
            size="sm"
          />
          <KPICard
            title="Promo Atk."
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
              ABC Segmentācija
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Produktu un ieņēmumu sadalījums</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
            <Tabs defaultValue="distribution">
              <TabsList className="mb-3 sm:mb-4 w-full sm:w-auto">
                <TabsTrigger value="distribution" className="flex-1 sm:flex-none text-xs sm:text-sm">Sadalījums</TabsTrigger>
                <TabsTrigger value="revenue" className="flex-1 sm:flex-none text-xs sm:text-sm">Ieņēmumi</TabsTrigger>
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
              Ieņēmumu Tendence
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Mēneša ieņēmumi laika gaitā</CardDescription>
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
            <CardDescription className="text-xs sm:text-sm">Augstākie ieņēmumi</CardDescription>
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
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{product.margin.toFixed(1)}% marža</p>
                  </div>
                </div>
              ))}
              {topProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">Nav datu</p>
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
            <CardDescription className="text-xs sm:text-sm">Zemākie ieņēmumi / marža</CardDescription>
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
                <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">Nav datu</p>
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
              Veikalu Salīdzinājums
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Veiktspēja pa veikaliem</CardDescription>
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
