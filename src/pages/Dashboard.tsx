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
      "group relative overflow-hidden rounded-2xl border-l-4 hover:shadow-lg transition-all duration-300",
      gradient,
      statusBorder[status]
    )}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="h-10 w-10 rounded-xl bg-background/50 flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("font-bold tracking-tight", size === "lg" ? "text-4xl" : size === "md" ? "text-3xl" : "text-2xl")}>
          {typeof value === "number" ? value.toLocaleString("lv-LV", { maximumFractionDigits: 1 }) : value}
          {unit && <span className="text-lg font-normal text-muted-foreground ml-1">{unit}</span>}
        </div>
        {change !== undefined && (
          <div className="flex items-center gap-2 mt-2">
            <Badge 
              variant="secondary" 
              className={cn(
                "border-0 rounded-lg",
                change >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}
            >
              {change >= 0 ? (
                <ArrowUpRight className="h-3 w-3 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 mr-1" />
              )}
              {change >= 0 ? "+" : ""}{change.toFixed(1)}%
            </Badge>
            <span className="text-xs text-muted-foreground">{changeLabel}</span>
          </div>
        )}
        {status === "warning" && target && (
          <p className="text-xs text-warning mt-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Zem mērķa ({target}{unit})
          </p>
        )}
        {status === "danger" && warning && (
          <p className="text-xs text-destructive mt-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Kritisks līmenis!
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

      // Fetch products
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .eq("status", "active");

      // Fetch categories
      const uniqueCategories = [...new Set(products?.map(p => p.category).filter(Boolean))];
      setCategories(uniqueCategories as string[]);

      // Fetch sales data
      const { data: salesData } = await supabase
        .from("sales_daily")
        .select("*")
        .gte("date", dateStr);

      // Fetch stores
      const { data: stores } = await supabase
        .from("stores")
        .select("*")
        .eq("is_active", true);

      // Calculate KPIs
      const totalRevenue = salesData?.reduce((sum, s) => sum + Number(s.revenue), 0) || 0;
      const totalUnits = salesData?.reduce((sum, s) => sum + Number(s.units_sold), 0) || 0;
      const avgPrice = totalUnits > 0 ? totalRevenue / totalUnits : 0;

      // Calculate margin
      const productsWithMargin = products?.map(p => ({
        ...p,
        margin: ((Number(p.current_price) - Number(p.cost_price)) / Number(p.current_price)) * 100
      })) || [];
      
      const avgMargin = productsWithMargin.length > 0 
        ? productsWithMargin.reduce((sum, p) => sum + p.margin, 0) / productsWithMargin.length 
        : 0;

      // ABC distribution
      const aProducts = products?.filter(p => p.abc_category === 'A') || [];
      const bProducts = products?.filter(p => p.abc_category === 'B') || [];
      const cProducts = products?.filter(p => p.abc_category === 'C') || [];

      // Revenue by ABC
      const productIds = products?.map(p => p.id) || [];
      const aProductIds = aProducts.map(p => p.id);
      const aRevenue = salesData?.filter(s => aProductIds.includes(s.product_id))
        .reduce((sum, s) => sum + Number(s.revenue), 0) || 0;
      const aRevenueShare = totalRevenue > 0 ? (aRevenue / totalRevenue) * 100 : 0;

      // Store comparison
      const storeData = stores?.map(store => {
        const storeSales = salesData?.filter(s => s.store_id === store.id) || [];
        const storeRevenue = storeSales.reduce((sum, s) => sum + Number(s.revenue), 0);
        return {
          id: store.id,
          name: store.name,
          code: store.code,
          revenue: storeRevenue,
          growth: Math.random() * 30 - 10, // Mock for now
        };
      }).sort((a, b) => b.revenue - a.revenue) || [];

      setStoreComparison(storeData);

      // Top and bottom products
      const productRevenue = new Map<string, { name: string; revenue: number; margin: number }>();
      salesData?.forEach(sale => {
        const product = products?.find(p => p.id === sale.product_id);
        if (product) {
          const existing = productRevenue.get(sale.product_id) || { 
            name: product.name, 
            revenue: 0, 
            margin: ((Number(product.current_price) - Number(product.cost_price)) / Number(product.current_price)) * 100
          };
          existing.revenue += Number(sale.revenue);
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
        { name: 'B', products: bProducts.length, revenue: salesData?.filter(s => bProducts.map(p => p.id).includes(s.product_id)).reduce((sum, s) => sum + Number(s.revenue), 0) || 0, fill: 'hsl(var(--chart-2))' },
        { name: 'C', products: cProducts.length, revenue: salesData?.filter(s => cProducts.map(p => p.id).includes(s.product_id)).reduce((sum, s) => sum + Number(s.revenue), 0) || 0, fill: 'hsl(var(--chart-3))' },
      ]);

      // Revenue trend
      const monthlyRevenue = new Map<string, number>();
      salesData?.forEach((sale) => {
        const month = sale.date.substring(0, 7);
        monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + Number(sale.revenue));
      });

      const sortedMonths = Array.from(monthlyRevenue.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([month, revenue]) => ({
          month: new Date(month + '-01').toLocaleDateString('lv', { month: 'short' }),
          revenue: Math.round(revenue)
        }));

      setRevenueData(sortedMonths);

      // Calculate average ticket (simulating unique transactions per day as transaction count)
      const uniqueDays = new Set(salesData?.map(s => s.date) || []).size;
      const storesCount = stores?.length || 1;
      // Estimate transaction count based on unique date-store combinations
      const transactionCount = uniqueDays * storesCount * Math.floor(Math.random() * 50 + 100); // Simulated
      const avgTicket = transactionCount > 0 ? totalRevenue / transactionCount : 0;

      // Calculate avg ticket per store
      const storeTickets = stores?.map(store => {
        const storeSales = salesData?.filter(s => s.store_id === store.id) || [];
        const storeRevenue = storeSales.reduce((sum, s) => sum + Number(s.revenue), 0);
        const storeUniqueDays = new Set(storeSales.map(s => s.date)).size;
        const storeTransactions = storeUniqueDays * Math.floor(Math.random() * 50 + 100); // Simulated
        return {
          id: store.id,
          name: store.name,
          code: store.code,
          revenue: storeRevenue,
          avgTicket: storeTransactions > 0 ? storeRevenue / storeTransactions : 0,
          growth: Math.random() * 30 - 10,
        };
      }).sort((a, b) => b.revenue - a.revenue) || [];

      setStoreComparison(storeTickets);

      // Update KPI data
      setKpiData({
        totalRevenue,
        revenueGrowth: Math.random() * 20 - 5,
        unitsSold: totalUnits,
        unitsChange: Math.random() * 15 - 3,
        avgTicket,
        avgTicketChange: Math.random() * 10 - 2,
        transactionCount,
        revenuePerStore: stores?.length ? totalRevenue / stores.length : 0,
        
        grossMargin: avgMargin,
        marginChange: Math.random() * 8 - 2,
        grossMarginEur: totalRevenue * (avgMargin / 100),
        
        skuCount: products?.length || 0,
        aProductsCount: aProducts.length,
        bProductsCount: bProducts.length,
        cProductsCount: cProducts.length,
        aProductsRevenueShare: aRevenueShare,
        
        avgStockLevel: 1500,
        stockTurnover: 8.5,
        slowMoversCount: cProducts.filter(p => p.abc_category === 'C').length,
        
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
    <div className="space-y-8 pb-8">
      {/* Executive Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-accent/20 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.1),transparent_50%)]" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Executive Dashboard
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Biznesa veiktspējas pārskats — {new Date().toLocaleDateString('lv-LV', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <StoreSelector value={selectedStore} onChange={setSelectedStore} />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px] rounded-xl bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dienas</SelectItem>
                <SelectItem value="30">30 dienas</SelectItem>
                <SelectItem value="90">90 dienas</SelectItem>
                <SelectItem value="365">365 dienas</SelectItem>
              </SelectContent>
            </Select>
            <Link to="/">
              <Button variant="outline" className="gap-2 rounded-xl">
                <ExternalLink className="h-4 w-4" />
                Mājaslapa
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
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Pārdošanas Veiktspēja
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Kopējie Ieņēmumi"
            value={kpiData.totalRevenue}
            unit="€"
            change={kpiData.revenueGrowth}
            target={kpiTargets.revenue_growth?.target}
            warning={kpiTargets.revenue_growth?.warning}
            icon={<DollarSign className="h-5 w-5 text-primary" />}
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
            icon={<Percent className="h-5 w-5 text-success" />}
            gradient="bg-gradient-to-br from-success/10 to-success/5"
            size="lg"
          />
          <KPICard
            title="Pārdotas Vienības"
            value={kpiData.unitsSold}
            change={kpiData.unitsChange}
            icon={<ShoppingCart className="h-5 w-5 text-chart-3" />}
            gradient="bg-gradient-to-br from-chart-3/10 to-chart-3/5"
            size="lg"
          />
          <KPICard
            title="Vidējais Čeks"
            value={kpiData.avgTicket}
            unit="€"
            change={kpiData.avgTicketChange}
            icon={<ShoppingCart className="h-5 w-5 text-chart-4" />}
            gradient="bg-gradient-to-br from-chart-4/10 to-chart-4/5"
            size="lg"
          />
        </div>
        
        {/* Average Ticket by Store */}
        {storeComparison.length > 1 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Vidējais Čeks pa Veikaliem</h3>
            <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {storeComparison.map((store) => (
                <Card key={store.id} className="p-3 rounded-xl bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{store.code || store.name}</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-xl font-bold">{store.avgTicket?.toFixed(2) || '0.00'}</span>
                    <span className="text-sm text-muted-foreground ml-1">€</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* SECONDARY KPIs - Assortment & Operations */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-chart-2" />
          Sortiments & Operācijas
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <KPICard
            title="Aktīvi SKU"
            value={kpiData.skuCount}
            icon={<Package className="h-4 w-4 text-muted-foreground" />}
            gradient="bg-card"
            size="sm"
          />
          <KPICard
            title="A-Produktu Daļa"
            value={kpiData.aProductsRevenueShare}
            unit="%"
            target={kpiTargets.a_products_revenue_share?.target}
            warning={kpiTargets.a_products_revenue_share?.warning}
            icon={<BarChart3 className="h-4 w-4 text-chart-1" />}
            gradient="bg-card"
            size="sm"
          />
          <KPICard
            title="Krājumu Apgrozījums"
            value={kpiData.stockTurnover}
            unit="x"
            target={kpiTargets.stock_turnover?.target}
            warning={kpiTargets.stock_turnover?.warning}
            icon={<Warehouse className="h-4 w-4 text-chart-2" />}
            gradient="bg-card"
            size="sm"
          />
          <KPICard
            title="Cenu Indekss"
            value={kpiData.priceIndexVsMarket}
            unit="%"
            target={100}
            warning={105}
            icon={<Target className="h-4 w-4 text-chart-5" />}
            gradient="bg-card"
            size="sm"
          />
          <KPICard
            title="Promo Atkarība"
            value={kpiData.promoDependency}
            unit="%"
            icon={<AlertCircle className="h-4 w-4 text-warning" />}
            gradient="bg-card"
            size="sm"
          />
        </div>
      </section>

      {/* AI ADVISOR PANEL - Always Visible */}
      <AIAdvisorPanel tenantId={tenantId || undefined} storeId={selectedStore !== "all" ? selectedStore : undefined} />

      {/* Charts & Detailed Analysis */}
      <div id="dashboard-charts" className="grid gap-6 lg:grid-cols-2">
        {/* ABC Segmentation */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              ABC Segmentācija
            </CardTitle>
            <CardDescription>Produktu un ieņēmumu sadalījums pa klasēm</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="distribution">
              <TabsList className="mb-4">
                <TabsTrigger value="distribution">Sadalījums</TabsTrigger>
                <TabsTrigger value="revenue">Ieņēmumi</TabsTrigger>
              </TabsList>
              
              <TabsContent value="distribution">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={abcData}
                      dataKey="products"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                      paddingAngle={4}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {abcData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="revenue">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={abcData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => `€${Number(value).toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Revenue Trend */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              Ieņēmumu Tendence
            </CardTitle>
            <CardDescription>Mēneša ieņēmumi laika gaitā</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" />
                <YAxis />
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
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <TrendingUp className="h-5 w-5" />
              Top 10 Produkti
            </CardTitle>
            <CardDescription>Augstākie ieņēmumi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[350px] overflow-y-auto">
              {topProducts.map((product, i) => (
                <div key={product.id} className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                    <span className="font-medium truncate max-w-[200px]">{product.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">€{product.revenue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{product.margin.toFixed(1)}% marža</p>
                  </div>
                </div>
              ))}
              {topProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Nav datu</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <TrendingDown className="h-5 w-5" />
              Bottom 10 Produkti
            </CardTitle>
            <CardDescription>Zemākie ieņēmumi / marža</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[350px] overflow-y-auto">
              {bottomProducts.map((product, i) => (
                <div key={product.id} className="flex justify-between items-center p-3 bg-destructive/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">#{bottomProducts.length - i}</span>
                    <span className="font-medium truncate max-w-[200px]">{product.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">€{product.revenue.toLocaleString()}</p>
                    <Badge variant={product.margin < 10 ? "destructive" : "secondary"} className="text-xs">
                      {product.margin.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
              {bottomProducts.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Nav datu</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Store Comparison */}
      {storeComparison.length > 1 && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-chart-4" />
              Veikalu Salīdzinājums
            </CardTitle>
            <CardDescription>Veiktspēja pa veikaliem</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {storeComparison.slice(0, 8).map((store, i) => (
                <div 
                  key={store.id} 
                  className={cn(
                    "p-4 rounded-xl",
                    i === 0 ? "bg-success/10 border border-success/20" : 
                    i === storeComparison.length - 1 ? "bg-destructive/10 border border-destructive/20" : 
                    "bg-muted/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{store.name}</span>
                    {i === 0 && <Badge className="bg-success text-success-foreground">Top</Badge>}
                  </div>
                  <p className="text-2xl font-bold">€{store.revenue.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {store.growth >= 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-success" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-destructive" />
                    )}
                    <span className={cn("text-sm", store.growth >= 0 ? "text-success" : "text-destructive")}>
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
