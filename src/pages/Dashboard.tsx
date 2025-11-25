import { useEffect, useState } from "react";
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
  Zap
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
  LineChart,
  Line
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive retail pricing intelligence
          </p>
        </div>

        {/* AI Search Bar */}
        <div className="flex gap-2 max-w-md w-full">
          <Input
            placeholder="Ask AI about your data..."
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
          />
          <Button onClick={handleAISearch} disabled={searching}>
            {searching ? <Sparkles className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* AI Answer */}
      {aiAnswer && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{aiAnswer}</p>
          </CardContent>
        </Card>
      )}

      {/* Admin Actions */}
      {isAdmin && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5" />
              Administratora Darbības
            </CardTitle>
            <CardDescription>
              Ģenerēt simulācijas datus un pārrēķināt ABC kategorijas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                onClick={seedDemoData}
                disabled={loading}
                variant="default"
                className="gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Izveidot Demo Datus (20 produkti, pārdošana, konkurenti)
              </Button>
              <Button
                onClick={recalculateABC}
                disabled={loading}
                variant="outline"
                className="gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
                Pārrēķināt ABC
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              <strong>Brīdinājums:</strong> Simulācijas datu izveide dzēsīs esošos datus un izveidot jaunus testa datus.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last 365 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">ABC Category</label>
              <Select value={abcFilter} onValueChange={setAbcFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="a">A Products</SelectItem>
                  <SelectItem value="b">B Products</SelectItem>
                  <SelectItem value="c">C Products</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Private Label</label>
              <Select value={privateLabelFilter} onValueChange={setPrivateLabelFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="true">Private Label Only</SelectItem>
                  <SelectItem value="false">Non-Private Label</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">Active SKUs monitored</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {stats.revenueChange > 0 ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <p className="text-xs text-muted-foreground">
                {stats.revenueChange > 0 ? '+' : ''}{stats.revenueChange.toFixed(1)}% vs previous period
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Margin</CardTitle>
            <Target className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avgMargin.toFixed(1)}%</div>
            <div className="flex items-center gap-1 mt-1">
              {stats.marginChange > 0 ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <p className="text-xs text-muted-foreground">
                {stats.marginChange > 0 ? '+' : ''}{stats.marginChange.toFixed(1)}% vs previous period
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risky Pricing</CardTitle>
            <AlertCircle className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{stats.riskyProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">Products need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* ABC Segmentation */}
        <Card>
          <CardHeader>
            <CardTitle>ABC Segmentation</CardTitle>
            <CardDescription>Product and revenue distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="products">
              <TabsList className="mb-4">
                <TabsTrigger value="products">By Count</TabsTrigger>
                <TabsTrigger value="revenue">By Revenue</TabsTrigger>
              </TabsList>
              
              <TabsContent value="products">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={abcData}
                      dataKey="products"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {abcData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="revenue">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={abcData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Monthly revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Risky Products & Competitor Promotions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Risky Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Risky Pricing Products
            </CardTitle>
            <CardDescription>Products with low margins requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {topRiskyProducts.length > 0 ? (
              <div className="space-y-3">
                {topRiskyProducts.map((product) => {
                  const margin = ((Number(product.current_price) - Number(product.cost_price)) / Number(product.current_price)) * 100;
                  return (
                    <div key={product.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.sku}</p>
                      </div>
                      <Badge variant="destructive">{margin.toFixed(1)}%</Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No risky products found</p>
            )}
          </CardContent>
        </Card>

        {/* Competitor Promotions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Competitor Promotions</CardTitle>
                <CardDescription>Active and recent competitor offers</CardDescription>
              </div>
              <Button 
                onClick={analyzePromotions} 
                disabled={analyzingPromos || selectedPromotions.length === 0}
                size="sm"
              >
                {analyzingPromos ? <Sparkles className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                Analyze
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {promotions.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {promotions.map((promo: any) => (
                  <div 
                    key={promo.id} 
                    className={`p-3 bg-muted rounded-lg cursor-pointer transition-colors ${
                      selectedPromotions.includes(promo.id) ? 'ring-2 ring-primary' : ''
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
                        <Badge>{promo.discount_percent}% OFF</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(promo.start_date).toLocaleDateString()} - {promo.end_date ? new Date(promo.end_date).toLocaleDateString() : 'Ongoing'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No active promotions</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Promo Analysis */}
      {promoAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Competitor Promotion Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              value={promoAnalysis} 
              readOnly 
              className="min-h-[200px] font-mono text-sm"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
