import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSalesDailyColumnsPaginated } from "@/lib/supabasePaginate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, TrendingDown, TrendingUp, Package, DollarSign, AlertCircle } from "lucide-react";
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

const ROLE_COLORS = {
  traffic_builder: 'hsl(var(--chart-1))',
  margin_driver: 'hsl(var(--chart-2))',
  image_builder: 'hsl(var(--chart-3))',
  long_tail: 'hsl(var(--chart-4))',
  other: 'hsl(var(--chart-5))',
};

const Symphony = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categoryMetrics, setCategoryMetrics] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [slowMovers, setSlowMovers] = useState<any[]>([]);
  const [trendProducts, setTrendProducts] = useState<any[]>([]);
  const [roleDistribution, setRoleDistribution] = useState<any[]>([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory !== "all") {
      fetchCategoryData();
    }
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const { data } = await supabase
        .from("categories")
        .select("name");

      const uniqueCategories = data?.map(c => c.name).filter(Boolean) || [];
      setCategories(uniqueCategories as string[]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchCategoryData = async () => {
    setLoading(true);
    try {
      // Fetch products in category via categories table
      const { data: categoryData } = await supabase
        .from("categories")
        .select("id")
        .eq("name", selectedCategory)
        .single();
      
      const { data: productsData } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", categoryData?.id || '')
        .eq("status", "active");

      setProducts(productsData || []);

      // Fetch category metrics
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const { data: metricsData } = await supabase
        .from("category_metrics")
        .select("*")
        .eq("category", selectedCategory)
        .gte("period_start", startDate.toISOString().split('T')[0])
        .order("period_start", { ascending: false })
        .limit(1)
        .single();

      setCategoryMetrics(metricsData);

      // Calculate role distribution
      const roles = productsData?.reduce((acc: any, p) => {
        const role = p.category_role || 'other';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {});

      const roleData = Object.entries(roles || {}).map(([name, value]) => ({
        name: name.replace('_', ' '),
        value: value as number,
        fill: ROLE_COLORS[name as keyof typeof ROLE_COLORS] || ROLE_COLORS.other
      }));

      setRoleDistribution(roleData);

      // Identify slow movers and trend products
      await identifySlowMoversAndTrends(productsData || []);

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

  const identifySlowMoversAndTrends = async (productsData: any[]) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const midDate = new Date();
    midDate.setDate(midDate.getDate() - 45);

    const productIds = productsData.map(p => p.id);

    // Get sales data with pagination
    const recentSales = await fetchSalesDailyColumnsPaginated(
      "product_id, units_sold, selling_price, purchase_price",
      {
        dateGte: midDate.toISOString().split('T')[0],
        productIds: productIds
      }
    );

    const olderSales = await fetchSalesDailyColumnsPaginated(
      "product_id, units_sold, selling_price, purchase_price",
      {
        dateGte: startDate.toISOString().split('T')[0],
        dateLte: midDate.toISOString().split('T')[0],
        productIds: productIds
      }
    );

    // Calculate sales by product (revenue = selling_price - purchase_price)
    const recentSalesByProduct = new Map();
    const olderSalesByProduct = new Map();

    recentSales?.forEach(s => {
      const revenue = ((Number(s.selling_price) || 0) - (Number(s.purchase_price) || 0)) * (Number(s.units_sold) || 0);
      const current = recentSalesByProduct.get(s.product_id) || { units: 0, revenue: 0 };
      recentSalesByProduct.set(s.product_id, {
        units: current.units + Number(s.units_sold),
        revenue: current.revenue + revenue
      });
    });

    olderSales?.forEach(s => {
      const revenue = ((Number(s.selling_price) || 0) - (Number(s.purchase_price) || 0)) * (Number(s.units_sold) || 0);
      const current = olderSalesByProduct.get(s.product_id) || { units: 0, revenue: 0 };
      olderSalesByProduct.set(s.product_id, {
        units: current.units + Number(s.units_sold),
        revenue: current.revenue + revenue
      });
    });

    // Identify slow movers (low recent sales)
    const slowMoversData = productsData
      .map(p => ({
        ...p,
        recent_units: recentSalesByProduct.get(p.id)?.units || 0,
        recent_revenue: recentSalesByProduct.get(p.id)?.revenue || 0,
      }))
      .filter(p => p.recent_units < 5)
      .sort((a, b) => a.recent_units - b.recent_units)
      .slice(0, 10);

    setSlowMovers(slowMoversData);

    // Identify trend products (strong growth)
    const trendData = productsData
      .map(p => {
        const recent = recentSalesByProduct.get(p.id);
        const older = olderSalesByProduct.get(p.id);
        
        if (!recent || !older || older.revenue === 0) return null;

        const growth = ((recent.revenue - older.revenue) / older.revenue) * 100;

        return {
          ...p,
          recent_revenue: recent.revenue,
          older_revenue: older.revenue,
          growth_percent: growth,
        };
      })
      .filter(p => p && p.growth_percent > 20)
      .sort((a, b) => (b?.growth_percent || 0) - (a?.growth_percent || 0))
      .slice(0, 10);

    setTrendProducts(trendData.filter(Boolean) as any[]);
  };

  const recalculateMetrics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("calculate-category-metrics", {
        body: { category: selectedCategory !== "all" ? selectedCategory : null }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data.message || "Category metrics recalculated",
      });

      fetchCategoryData();
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

  // Prepare scatter data for revenue vs margin matrix
  const scatterData = products.map(p => {
    const margin = ((Number(p.current_price) - Number(p.cost_price)) / Number(p.current_price)) * 100;
    return {
      x: 100, // Revenue proxy (would need actual sales)
      y: margin,
      name: p.name,
      role: p.category_role || 'other',
      fill: ROLE_COLORS[p.category_role as keyof typeof ROLE_COLORS] || ROLE_COLORS.other
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Symphony</h1>
          <p className="text-muted-foreground">
            Category performance & product role orchestration
          </p>
        </div>
        <Button onClick={recalculateMetrics} disabled={loading || selectedCategory === "all"}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Recalculate Metrics
        </Button>
      </div>

      {/* Category Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Category</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCategory !== "all" && (
        <>
          {/* KPI Cards */}
          {categoryMetrics && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${categoryMetrics.total_revenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">Last 90 days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Margin</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${categoryMetrics.total_margin.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {((categoryMetrics.total_margin / categoryMetrics.total_revenue) * 100).toFixed(1)}% margin rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">SKU Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{categoryMetrics.sku_count}</div>
                  <p className="text-xs text-muted-foreground mt-1">{categoryMetrics.slow_movers_count} slow movers</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Promo Dependency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{categoryMetrics.promo_revenue_share.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Revenue from promotions</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Product Role Distribution</CardTitle>
                <CardDescription>Products by strategic role</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={roleDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.value}`}
                      outerRadius={100}
                      dataKey="value"
                    >
                      {roleDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue vs Margin Matrix</CardTitle>
                <CardDescription>Products by performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="x" name="Volume" hide />
                    <YAxis type="number" dataKey="y" name="Margin %" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Products" data={scatterData} fill="hsl(var(--primary))" />
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Slow Movers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                Slow Movers
              </CardTitle>
              <CardDescription>
                Products with very low sales - candidates for delisting or repricing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {slowMovers.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">No slow movers identified</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Recent Units</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead>Recommendation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slowMovers.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {product.category_role?.replace('_', ' ') || 'other'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{product.recent_units}</TableCell>
                        <TableCell className="text-right">${product.recent_revenue.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">Review for delisting</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Trend Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                Trending Products
              </CardTitle>
              <CardDescription>
                Products with strong growth - opportunities for expansion
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trendProducts.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">No trending products identified</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Growth</TableHead>
                      <TableHead className="text-right">Recent Revenue</TableHead>
                      <TableHead>Recommendation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trendProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {product.category_role?.replace('_', ' ') || 'other'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="default">
                            +{product.growth_percent.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">${product.recent_revenue.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="default">Expand distribution</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Symphony;