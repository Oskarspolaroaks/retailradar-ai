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
  ExternalLink
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
  Area,
  AreaChart
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AISearchBar } from "@/components/AISearchBar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Dashboard = () => {
  const { toast } = useToast();
  
  // Filters
  const [dateRange, setDateRange] = useState("90");
  const [abcFilter, setAbcFilter] = useState("all");
  const [privateLabelFilter, setPrivateLabelFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Data
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalRevenue: 0,
    avgMargin: 0,
    riskyProducts: 0,
    revenueChange: 0,
    marginChange: 0,
  });
  
  const [abcData, setAbcData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [topRiskyProducts, setTopRiskyProducts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [selectedPromotions, setSelectedPromotions] = useState<string[]>([]);
  const [promoAnalysis, setPromoAnalysis] = useState("");
  const [analyzingPromos, setAnalyzingPromos] = useState(false);
  
  // AI Search
  const [aiQuery, setAiQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    checkAdminStatus();
    fetchDashboardData();
    fetchPromotions();
  }, [dateRange, abcFilter, privateLabelFilter, categoryFilter]);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      setIsAdmin(data || false);
    }
  };

  const recalculateABC = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("calculate-abc", {
        body: { period_days: parseInt(dateRange) },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data.message || "ABC categories recalculated",
      });

      fetchDashboardData();
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

  const seedDemoData = async () => {
    if (!confirm('Izveidosim demo datus: 20 produktus, pārdošanas vēsturi, konkurentus un rekomendācijas. Esošie dati tiks dzēsti. Vai turpināt?')) {
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-data");

      if (error) throw error;

      toast({
        title: "Veiksmīgi!",
        description: `Izveidoti ${data.counts.products} produkti, ${data.counts.sales} pārdošanas ieraksti, ${data.counts.competitors} konkurenti. Tagad dodieties uz Recommendations lapu un nospiediet "Ģenerēt Jaunas Rekomendācijas".`,
      });

      // Refresh dashboard data
      await fetchDashboardData();
      await fetchPromotions();
    } catch (error: any) {
      console.error("Error seeding data:", error);
      toast({
        title: "Kļūda",
        description: error.message || "Neizdevās izveidot datus",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const daysAgo = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      const dateStr = startDate.toISOString().split('T')[0];

      // Build product query
      let productQuery = supabase
        .from("products")
        .select("*")
        .eq("status", "active");

      if (abcFilter !== "all") {
        productQuery = productQuery.eq("abc_category", abcFilter.toUpperCase());
      }
      if (privateLabelFilter !== "all") {
        productQuery = productQuery.eq("is_private_label", privateLabelFilter === "true");
      }
      if (categoryFilter !== "all") {
        productQuery = productQuery.eq("category", categoryFilter);
      }

      const { data: products } = await productQuery;

      // Get categories for filter
      const { data: allProducts } = await supabase
        .from("products")
        .select("category")
        .eq("status", "active");
      
      const uniqueCategories = [...new Set(allProducts?.map(p => p.category).filter(Boolean))];
      setCategories(uniqueCategories as string[]);

      // Fetch sales data
      const { data: salesData } = await supabase
        .from("sales_daily")
        .select("*")
        .gte("date", dateStr) as any;

      const totalRevenue = salesData?.reduce((sum: number, sale: any) => sum + Number(sale.revenue), 0) || 0;

      // Calculate margins
      const avgMargin = products?.length
        ? products.reduce((sum, p) => {
            const margin = ((Number(p.current_price) - Number(p.cost_price)) / Number(p.current_price)) * 100;
            return sum + margin;
          }, 0) / products.length
        : 0;

      // ABC distribution
      const abcCounts = {
        A: products?.filter(p => p.abc_category === 'A').length || 0,
        B: products?.filter(p => p.abc_category === 'B').length || 0,
        C: products?.filter(p => p.abc_category === 'C').length || 0,
      };

      const abcRevenue = await Promise.all(
        ['A', 'B', 'C'].map(async (cat) => {
          const catProducts = products?.filter(p => p.abc_category === cat).map(p => p.id) || [];
          const { data: catSales } = await supabase
            .from("sales_daily")
            .select("revenue")
            .in("product_id", catProducts)
            .gte("date", dateStr) as any;
          
          const revenue = catSales?.reduce((sum: number, s: any) => sum + Number(s.revenue), 0) || 0;
          return revenue;
        })
      );

      setAbcData([
        { name: 'A', products: abcCounts.A, revenue: abcRevenue[0], fill: 'hsl(var(--chart-1))' },
        { name: 'B', products: abcCounts.B, revenue: abcRevenue[1], fill: 'hsl(var(--chart-2))' },
        { name: 'C', products: abcCounts.C, revenue: abcRevenue[2], fill: 'hsl(var(--chart-3))' },
      ]);

      // Revenue trend by month
      const monthlyRevenue = new Map<string, number>();
      salesData?.forEach((sale: any) => {
        const month = sale.date.substring(0, 7);
        monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + Number(sale.revenue));
      });

      const sortedMonths = Array.from(monthlyRevenue.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([month, revenue]) => ({
          month: new Date(month + '-01').toLocaleDateString('en', { month: 'short' }),
          revenue: Math.round(revenue)
        }));

      setRevenueData(sortedMonths);

      // Find risky products (low margin or priced too high vs competitors)
      const riskyProducts = products?.filter(p => {
        const margin = ((Number(p.current_price) - Number(p.cost_price)) / Number(p.current_price)) * 100;
        return margin < 10;
      }).slice(0, 5) || [];

      setTopRiskyProducts(riskyProducts);

      setStats({
        totalProducts: products?.length || 0,
        totalRevenue: totalRevenue,
        avgMargin: avgMargin,
        riskyProducts: riskyProducts.length,
        revenueChange: Math.random() * 20 - 5, // Mock trend
        marginChange: Math.random() * 10 - 3, // Mock trend
      });

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    }
  };

  const fetchPromotions = async () => {
    try {
      // Promotions feature temporarily disabled during schema migration
      setPromotions([]);
    } catch (error) {
      console.error("Error fetching promotions:", error);
    }
  };

  const analyzePromotions = async () => {
    if (selectedPromotions.length === 0) {
      toast({
        title: "No promotions selected",
        description: "Please select at least one promotion to analyze",
        variant: "destructive",
      });
      return;
    }

    setAnalyzingPromos(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-promotions', {
        body: { promotionIds: selectedPromotions }
      });

      if (error) throw error;

      setPromoAnalysis(data.analysis);
      toast({
        title: "Analysis complete",
        description: `Analyzed ${data.promotions_analyzed} promotions`,
      });
    } catch (error: any) {
      console.error("Error analyzing promotions:", error);
      toast({
        title: "Analysis failed",
        description: error.message || "Failed to analyze promotions",
        variant: "destructive",
      });
    } finally {
      setAnalyzingPromos(false);
    }
  };

  const handleAISearch = async () => {
    if (!aiQuery.trim()) return;

    setSearching(true);
    setAiAnswer(""); // Clear previous answer
    try {
      const { data, error } = await supabase.functions.invoke('ai-query', {
        body: { query: aiQuery }
      });

      if (error) throw error;

      setAiAnswer(data.answer);
    } catch (error: any) {
      console.error("Error with AI search:", error);
      let errorMessage = error.message || "Failed to process query";
      
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        errorMessage = "AI rate limit exceeded. Please try again in a moment.";
      } else if (error.message?.includes('402') || error.message?.includes('credits')) {
        errorMessage = "AI credits depleted. Please add funds to continue.";
      }
      
      toast({
        title: "Search failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Modern Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-accent/20 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.1),transparent_50%)]" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Retail pricing intelligence at a glance
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* AI Search Bar */}
            <div className="flex gap-2 bg-background/80 backdrop-blur-sm rounded-xl p-1 border shadow-sm">
              <Input
                placeholder="Ask AI about your data..."
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
                className="border-0 bg-transparent focus-visible:ring-0 min-w-[200px]"
              />
              <Button onClick={handleAISearch} disabled={searching} size="sm" className="rounded-lg">
                {searching ? <Sparkles className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <Link to="/">
              <Button variant="outline" className="gap-2 rounded-xl bg-background/80 backdrop-blur-sm hover:bg-background">
                <ExternalLink className="h-4 w-4" />
                Mājaslapa
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* AI Answer */}
      {aiAnswer && (
        <Card className="bg-gradient-to-br from-primary/5 to-accent/10 border-primary/20 rounded-2xl animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap leading-relaxed">{aiAnswer}</p>
          </CardContent>
        </Card>
      )}

      {/* Admin Actions */}
      {isAdmin && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              Administratora Darbības
            </CardTitle>
            <CardDescription className="ml-13">
              Ģenerēt simulācijas datus un pārrēķināt ABC kategorijas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              <Button
                onClick={seedDemoData}
                disabled={loading}
                className="gap-2 rounded-xl"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Izveidot Demo Datus
              </Button>
              <Button
                onClick={recalculateABC}
                disabled={loading}
                variant="outline"
                className="gap-2 rounded-xl"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
                Pārrēķināt ABC
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters - Compact Modern Design */}
      <div className="flex flex-wrap gap-3 items-center p-4 rounded-2xl bg-muted/30 border">
        <span className="text-sm font-medium text-muted-foreground">Filtri:</span>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[140px] rounded-xl bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 dienas</SelectItem>
            <SelectItem value="90">90 dienas</SelectItem>
            <SelectItem value="365">365 dienas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={abcFilter} onValueChange={setAbcFilter}>
          <SelectTrigger className="w-[140px] rounded-xl bg-background">
            <SelectValue placeholder="ABC" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi ABC</SelectItem>
            <SelectItem value="a">A klase</SelectItem>
            <SelectItem value="b">B klase</SelectItem>
            <SelectItem value="c">C klase</SelectItem>
          </SelectContent>
        </Select>

        <Select value={privateLabelFilter} onValueChange={setPrivateLabelFilter}>
          <SelectTrigger className="w-[150px] rounded-xl bg-background">
            <SelectValue placeholder="Private Label" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visi produkti</SelectItem>
            <SelectItem value="true">Private Label</SelectItem>
            <SelectItem value="false">Ne-PL</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] rounded-xl bg-background">
            <SelectValue placeholder="Kategorija" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Visas kategorijas</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Modern KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kopā Produkti</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tracking-tight">{stats.totalProducts}</div>
            <p className="text-sm text-muted-foreground mt-2">Aktīvie SKU</p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Kopējie Ieņēmumi</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tracking-tight">
              €{stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {stats.revenueChange > 0 ? (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-0">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{stats.revenueChange.toFixed(1)}%
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {stats.revenueChange.toFixed(1)}%
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">vs iepr. periods</span>
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-violet-500/10 to-violet-600/5 hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vidējā Marža</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-violet-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tracking-tight">{stats.avgMargin.toFixed(1)}%</div>
            <div className="flex items-center gap-2 mt-2">
              {stats.marginChange > 0 ? (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-0">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{stats.marginChange.toFixed(1)}%
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-destructive/10 text-destructive border-0">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {stats.marginChange.toFixed(1)}%
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">vs iepr. periods</span>
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-amber-500/10 to-amber-600/5 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Riska Cenas</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tracking-tight text-amber-600">{stats.riskyProducts}</div>
            <p className="text-sm text-muted-foreground mt-2">Nepieciešama uzmanība</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* ABC Segmentation */}
        <Card className="rounded-2xl border-0 shadow-sm bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <PieChart className="h-4 w-4 text-primary" />
              </div>
              ABC Segmentācija
            </CardTitle>
            <CardDescription>Produktu un ieņēmumu sadalījums</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="products">
              <TabsList className="mb-4 rounded-xl bg-muted/50">
                <TabsTrigger value="products" className="rounded-lg">Pēc Skaita</TabsTrigger>
                <TabsTrigger value="revenue" className="rounded-lg">Pēc Ieņēmumiem</TabsTrigger>
              </TabsList>
              
              <TabsContent value="products">
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
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {abcData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} className="drop-shadow-sm" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                      }} 
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="revenue">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={abcData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      formatter={(value) => `€${Number(value).toLocaleString()}`} 
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                      }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Revenue Trend */}
        <Card className="rounded-2xl border-0 shadow-sm bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              Ieņēmumu Tendence
            </CardTitle>
            <CardDescription>Mēneša ieņēmumi laika gaitā</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RechartsLineChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  formatter={(value) => `€${Number(value).toLocaleString()}`}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  fill="url(#revenueGradient)"
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Risky Products & Competitor Promotions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Risky Products */}
        <Card className="rounded-2xl border-0 shadow-sm bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </div>
              Riska Produkti
            </CardTitle>
            <CardDescription>Produkti ar zemām maržām</CardDescription>
          </CardHeader>
          <CardContent>
            {topRiskyProducts.length > 0 ? (
              <div className="space-y-3">
                {topRiskyProducts.map((product, index) => {
                  const margin = ((Number(product.current_price) - Number(product.cost_price)) / Number(product.current_price)) * 100;
                  return (
                    <div 
                      key={product.id} 
                      className="flex justify-between items-center p-4 bg-gradient-to-r from-muted/50 to-transparent rounded-xl hover:from-muted transition-all duration-200"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.sku}</p>
                      </div>
                      <Badge variant="destructive" className="rounded-lg">
                        {margin.toFixed(1)}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Nav riska produktu</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Competitor Promotions */}
        <Card className="rounded-2xl border-0 shadow-sm bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle>Konkurentu Akcijas</CardTitle>
                  <CardDescription>Aktīvās un nesenās akcijas</CardDescription>
                </div>
              </div>
              <Button 
                onClick={analyzePromotions} 
                disabled={analyzingPromos || selectedPromotions.length === 0}
                size="sm"
                className="rounded-xl"
              >
                {analyzingPromos ? <Sparkles className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Analizēt
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {promotions.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {promotions.map((promo: any) => (
                  <div 
                    key={promo.id} 
                    className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedPromotions.includes(promo.id) 
                        ? 'bg-primary/10 ring-2 ring-primary' 
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                    onClick={() => {
                      setSelectedPromotions(prev => 
                        prev.includes(promo.id) 
                          ? prev.filter(id => id !== promo.id)
                          : [...prev, promo.id]
                      );
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{promo.promotion_name}</p>
                        <p className="text-sm text-muted-foreground">{promo.competitors?.name}</p>
                      </div>
                      {promo.discount_percent && (
                        <Badge className="rounded-lg">{promo.discount_percent}% OFF</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(promo.start_date).toLocaleDateString()} - {promo.end_date ? new Date(promo.end_date).toLocaleDateString() : 'Aktīva'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Nav aktīvo akciju</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Promo Analysis */}
      {promoAnalysis && (
        <Card className="rounded-2xl border-0 shadow-sm animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              Konkurentu Akciju Analīze
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="whitespace-pre-wrap leading-relaxed">{promoAnalysis}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
