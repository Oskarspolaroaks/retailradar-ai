import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProductsPaginated } from "@/lib/supabasePaginate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calculator, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface Product {
  id: string;
  sku: string;
  name: string;
  cost_price: number;
  current_price: number;
  abc_category: string | null;
  is_private_label: boolean;
  currency: string;
}

interface SimulationResult {
  product: Product;
  current_margin: number;
  simulated_price: number;
  simulated_margin: number;
  price_change: number;
  margin_change: number;
}

// Validation schemas
const batchSimulatorSchema = z.object({
  percent: z.number()
    .min(-99, "Cannot decrease by more than 99%")
    .max(500, "Cannot increase by more than 500%")
    .refine(val => Math.abs(val) >= 0.01, "Change must be at least 0.01%"),
});

const marginSchema = z.object({
  margin: z.number()
    .min(0, "Margin cannot be negative")
    .max(100, "Margin cannot exceed 100%"),
});

const priceSchema = z.object({
  price: z.number()
    .positive("Price must be positive")
    .finite("Price must be a valid number"),
});

const PricingSimulator = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Single product simulator state
  const [costOfGoods, setCostOfGoods] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [desiredMargin, setDesiredMargin] = useState("");
  const [competitorPrice, setCompetitorPrice] = useState("");

  // Batch simulator state
  const [batchCategory, setBatchCategory] = useState<string>("all");
  const [batchPercent, setBatchPercent] = useState("");
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);

  useEffect(() => {
    fetchProducts();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      setIsAdmin(roles?.role === "admin");
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await fetchProductsPaginated("*");
      // Sort by name
      data.sort((a: any, b: any) => a.name.localeCompare(b.name));
      setProducts(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateMargin = (cost: number, price: number) => {
    if (price === 0) return 0;
    return ((price - cost) / price) * 100;
  };

  const calculateTargetPrice = (cost: number, margin: number) => {
    if (margin >= 100) return 0;
    return cost / (1 - margin / 100);
  };

  const handleProductSelect = async (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setCostOfGoods(product.cost_price.toString());
      setCurrentPrice(product.current_price.toString());
      
      // Try to fetch competitor price
      const { data: competitorData } = await supabase
        .from("competitor_price_history")
        .select("price")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (competitorData) {
        setCompetitorPrice(competitorData.price.toString());
      }
    }
  };

  const renderSingleProductSimulator = () => {
    const cost = parseFloat(costOfGoods) || 0;
    const price = parseFloat(currentPrice) || 0;
    const margin = parseFloat(desiredMargin) || 0;
    const compPrice = parseFloat(competitorPrice) || 0;

    const currentMarginPercent = calculateMargin(cost, price);
    const targetPrice = calculateTargetPrice(cost, margin);
    const priceDifference = compPrice > 0 ? price - compPrice : 0;
    const projectedProfit = targetPrice - cost;
    const currentProfit = price - cost;
    const profitChange = projectedProfit - currentProfit;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Product Selection</CardTitle>
            <CardDescription>Choose a product to simulate pricing</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="product-select">Select Product</Label>
            <Select onValueChange={handleProductSelect}>
              <SelectTrigger id="product-select">
                <SelectValue placeholder="Choose a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                    {product.is_private_label && (
                      <Badge className="ml-2" variant="secondary">Private Label</Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Input Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">Cost of Goods</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={costOfGoods}
                  onChange={(e) => setCostOfGoods(e.target.value)}
                  placeholder="50.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current-price">Current Price</Label>
                <Input
                  id="current-price"
                  type="number"
                  step="0.01"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  placeholder="75.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desired-margin">Desired Margin (%)</Label>
                <Input
                  id="desired-margin"
                  type="number"
                  step="0.1"
                  value={desiredMargin}
                  onChange={(e) => setDesiredMargin(e.target.value)}
                  placeholder="40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="competitor-price">Competitor Price (Optional)</Label>
                <Input
                  id="competitor-price"
                  type="number"
                  step="0.01"
                  value={competitorPrice}
                  onChange={(e) => setCompetitorPrice(e.target.value)}
                  placeholder="70.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Simulation Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Current Margin</p>
                <p className="text-2xl font-bold">{currentMarginPercent.toFixed(1)}%</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Target Price</p>
                <p className="text-2xl font-bold">{selectedProduct?.currency} {targetPrice.toFixed(2)}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">vs Competitor</p>
                <p className="text-2xl font-bold">
                  {compPrice > 0 ? `${priceDifference > 0 ? '+' : ''}${priceDifference.toFixed(2)}` : 'N/A'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Profit Change</p>
                <p className="text-2xl font-bold">
                  {profitChange > 0 ? '+' : ''}{profitChange.toFixed(2)}
                </p>
              </div>
            </div>

            {selectedProduct?.is_private_label && (
              <Alert>
                <Lightbulb className="h-4 w-4" />
                <AlertDescription>
                  This is a private label product with typically higher profit margins. Price adjustments carry less risk.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const simulateBatchPricing = () => {
    const percent = parseFloat(batchPercent) || 0;
    
    // Validate input
    try {
      batchSimulatorSchema.parse({ percent });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Invalid Input",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
      return;
    }

    let filteredProducts = products;
    if (batchCategory && batchCategory !== "all") {
      filteredProducts = products.filter((p) => p.abc_category === batchCategory);
    }

    const results: SimulationResult[] = filteredProducts.map((product) => {
      const currentMargin = calculateMargin(product.cost_price, product.current_price);
      const simulatedPrice = product.current_price * (1 + percent / 100);
      const simulatedMargin = calculateMargin(product.cost_price, simulatedPrice);
      const priceChange = simulatedPrice - product.current_price;
      const marginChange = simulatedMargin - currentMargin;

      return {
        product,
        current_margin: currentMargin,
        simulated_price: simulatedPrice,
        simulated_margin: simulatedMargin,
        price_change: priceChange,
        margin_change: marginChange,
      };
    });

    setSimulationResults(results);
  };

  const applyBatchChanges = async () => {
    // Verify admin role server-side before proceeding
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to apply changes",
        variant: "destructive",
      });
      return;
    }

    const { data: hasAdminRole, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError || !hasAdminRole) {
      toast({
        title: "Access Denied",
        description: "Admin privileges required to apply price changes",
        variant: "destructive",
      });
      return;
    }

    const updates = simulationResults.map((result) => ({
      id: result.product.id,
      current_price: result.simulated_price,
    }));

    const { error } = await supabase
      .from("products")
      .update({ current_price: updates[0].current_price })
      .in('id', updates.map(u => u.id));

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Update each product individually
      for (const update of updates) {
        await supabase
          .from("products")
          .update({ current_price: update.current_price })
          .eq("id", update.id);
      }
      
      toast({
        title: "Success",
        description: `Updated prices for ${updates.length} products`,
      });
      setSimulationResults([]);
      fetchProducts();
    }
  };

  const renderBatchSimulator = () => {
    const totalRevenueCurrent = simulationResults.reduce(
      (sum, r) => sum + r.product.current_price,
      0
    );
    const totalRevenueSimulated = simulationResults.reduce(
      (sum, r) => sum + r.simulated_price,
      0
    );
    const avgMarginCurrent =
      simulationResults.reduce((sum, r) => sum + r.current_margin, 0) /
      (simulationResults.length || 1);
    const avgMarginSimulated =
      simulationResults.reduce((sum, r) => sum + r.simulated_margin, 0) /
      (simulationResults.length || 1);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Batch Configuration</CardTitle>
            <CardDescription>Simulate price changes across multiple products</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category-filter">Filter by ABC Category</Label>
                <Select value={batchCategory} onValueChange={setBatchCategory}>
                  <SelectTrigger id="category-filter">
                    <SelectValue placeholder="All products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All products</SelectItem>
                    <SelectItem value="A">Category A</SelectItem>
                    <SelectItem value="B">Category B</SelectItem>
                    <SelectItem value="C">Category C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-percent">Price Change (%)</Label>
                <Input
                  id="batch-percent"
                  type="number"
                  step="0.1"
                  value={batchPercent}
                  onChange={(e) => setBatchPercent(e.target.value)}
                  placeholder="5.0"
                />
              </div>
            </div>
            <Button onClick={simulateBatchPricing} className="w-full">
              <Calculator className="h-4 w-4 mr-2" />
              Simulate Changes
            </Button>
          </CardContent>
        </Card>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Pricing Guidelines:</strong>
            <ul className="list-disc ml-4 mt-2 space-y-1">
              <li>Do NOT raise prices on A-category items - customers notice and sales may drop</li>
              <li>Consider reducing prices on C-category items with high profitability but low sales</li>
              <li>Increase prices on B/C products moderately (1-15%) to boost margins</li>
              <li>Private label products carry less risk for price increases</li>
            </ul>
          </AlertDescription>
        </Alert>

        {simulationResults.length > 0 && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Store-Level Impact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Avg Margin Change</p>
                    <p className="text-2xl font-bold">
                      {avgMarginCurrent.toFixed(1)}% → {avgMarginSimulated.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Revenue Impact</p>
                    <p className="text-2xl font-bold">
                      +{(totalRevenueSimulated - totalRevenueCurrent).toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Simulation Results</CardTitle>
                <CardDescription>{simulationResults.length} products affected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Current Price</TableHead>
                        <TableHead className="text-right">Simulated Price</TableHead>
                        <TableHead className="text-right">Current Margin</TableHead>
                        <TableHead className="text-right">Simulated Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {simulationResults.map((result) => (
                        <TableRow key={result.product.id}>
                          <TableCell>
                            {result.product.name}
                            {result.product.is_private_label && (
                              <Badge className="ml-2" variant="secondary">PL</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge>{result.product.abc_category || "N/A"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {result.product.currency} {result.product.current_price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {result.product.currency} {result.simulated_price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {result.current_margin.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {result.simulated_margin.toFixed(1)}%
                            <span className="text-xs text-muted-foreground ml-1">
                              ({result.margin_change > 0 ? "+" : ""}{result.margin_change.toFixed(1)}%)
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {isAdmin && (
                  <div className="mt-4 flex justify-end">
                    <Button onClick={applyBatchChanges}>Apply Changes to Database</Button>
                  </div>
                )}
                {!isAdmin && (
                  <Alert className="mt-4">
                    <AlertDescription>
                      Only admin users can apply price changes to the database
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Pricing Simulator</h1>
        <p className="text-muted-foreground">
          Simulate pricing changes and analyze their impact on margins and revenue
        </p>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single">Single Product</TabsTrigger>
          <TabsTrigger value="batch">Batch Simulation</TabsTrigger>
        </TabsList>
        <TabsContent value="single" className="space-y-4">
          {renderSingleProductSimulator()}
        </TabsContent>
        <TabsContent value="batch" className="space-y-4">
          {renderBatchSimulator()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PricingSimulator;
