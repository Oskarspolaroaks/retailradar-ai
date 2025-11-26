import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Zap, Settings, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";

const SmartPrice = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [abcClasses, setAbcClasses] = useState<string[]>(["A", "B", "C"]);
  
  // Generation parameters
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedABC, setSelectedABC] = useState<string>("all");
  const [smartPrices, setSmartPrices] = useState<any[]>([]);

  useEffect(() => {
    fetchConfig();
    fetchCategories();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data } = await supabase
        .from("smart_price_config")
        .select("*")
        .single();

      if (data) {
        setConfig(data);
      } else {
        // Initialize with defaults
        setConfig({
          global_min_margin_percent: 15,
          abc_a_max_discount_percent: 10,
          abc_b_max_discount_percent: 20,
          abc_c_max_discount_percent: 30,
          match_competitor_promo: true,
          never_below_competitor_min: true,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await supabase
        .from("products")
        .select("category")
        .eq("status", "active");

      const uniqueCategories = [...new Set(data?.map(p => p.category).filter(Boolean))];
      setCategories(uniqueCategories as string[]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("smart_price_config")
        .upsert(config);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Smart Price configuration saved",
      });
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

  const generateSmartPrices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-smart-prices", {
        body: {
          category: selectedCategory !== "all" ? selectedCategory : null,
          abc_class: selectedABC !== "all" ? selectedABC : null,
        }
      });

      if (error) throw error;

      setSmartPrices(data.smart_prices || []);
      
      toast({
        title: "Veiksmīgi",
        description: data.message || `Ģenerētas ${data.smart_prices?.length || 0} viedās cenas`,
      });
    } catch (error: any) {
      console.error('Smart price generation error:', error);
      
      // Check if it's a "no products" error
      if (error.message?.includes('Nav atrasts') || error.message?.includes('No products')) {
        toast({
          title: "Nav produktu",
          description: "Lūdzu, vispirms ielādējiet demo datus vai pievienojiet produktus manuāli.",
          variant: "destructive",
          action: (
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/dashboard'}>
              Doties uz Dashboard
            </Button>
          ),
        });
      } else {
        toast({
          title: "Kļūda",
          description: error.message || "Neizdevās ģenerēt viedās cenas",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const allConstraintsMet = (price: any) => {
    return price.constraints_met.min_margin && 
           price.constraints_met.max_discount && 
           price.constraints_met.above_comp_min;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Smart Price</h1>
          <p className="text-muted-foreground">
            Intelligent promotion pricing that protects margins
          </p>
        </div>
      </div>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate">Generate Promo Prices</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle>Generate Smart Promo Prices</CardTitle>
              <CardDescription>
                Select products and generate margin-safe promotional prices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>ABC Class</Label>
                  <Select value={selectedABC} onValueChange={setSelectedABC}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select ABC class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      <SelectItem value="A">Class A</SelectItem>
                      <SelectItem value="B">Class B</SelectItem>
                      <SelectItem value="C">Class C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={generateSmartPrices} disabled={loading}>
                <Zap className={`h-4 w-4 mr-2 ${loading ? 'animate-pulse' : ''}`} />
                {loading ? "Ģenerē..." : "Ģenerēt Viedās Cenas"}
              </Button>
            </CardContent>
          </Card>

          {/* Empty state */}
          {smartPrices.length === 0 && !loading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nav ģenerētu viedo cenu</h3>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                  Izmantojiet filtrus augstāk un nospiediet "Ģenerēt Viedās Cenas" lai aprēķinātu optimālās akcijas cenas produktiem.
                </p>
                {categories.length === 0 && (
                  <p className="text-sm text-warning mb-4">
                    ⚠️ Nav atrasts neviens produkts. Dodieties uz Dashboard un ielādējiet demo datus.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {smartPrices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Smart Promo Prices</CardTitle>
                <CardDescription>
                  {smartPrices.length} products with optimized promotional pricing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>ABC</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">Promo Price</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-right">Promo Margin</TableHead>
                        <TableHead className="text-right">Expected Uplift</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {smartPrices.map((price) => (
                        <TableRow key={price.product_id}>
                          <TableCell className="font-mono text-sm">{price.sku}</TableCell>
                          <TableCell className="font-medium">{price.product_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{price.abc_class}</Badge>
                          </TableCell>
                          <TableCell className="text-right">${price.current_price.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ${price.promo_price.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">
                              {price.discount_percent.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={price.promo_margin >= (config?.global_min_margin_percent || 15) ? "default" : "destructive"}>
                              {price.promo_margin.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <TrendingUp className="h-3 w-3 text-success" />
                              <span className="text-success">
                                +{price.expected_uplift_percent}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {allConstraintsMet(price) ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Safe
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Review
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Smart Price Configuration
              </CardTitle>
              <CardDescription>
                Set margin and discount limits for promotional pricing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="minMargin">Global Minimum Margin (%)</Label>
                  <Input
                    id="minMargin"
                    type="number"
                    value={config?.global_min_margin_percent || 15}
                    onChange={(e) => setConfig({ ...config, global_min_margin_percent: Number(e.target.value) })}
                    min="0"
                    max="100"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum margin that must be maintained during promotions
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="abcA">Class A Max Discount (%)</Label>
                    <Input
                      id="abcA"
                      type="number"
                      value={config?.abc_a_max_discount_percent || 10}
                      onChange={(e) => setConfig({ ...config, abc_a_max_discount_percent: Number(e.target.value) })}
                      min="0"
                      max="100"
                    />
                  </div>

                  <div>
                    <Label htmlFor="abcB">Class B Max Discount (%)</Label>
                    <Input
                      id="abcB"
                      type="number"
                      value={config?.abc_b_max_discount_percent || 20}
                      onChange={(e) => setConfig({ ...config, abc_b_max_discount_percent: Number(e.target.value) })}
                      min="0"
                      max="100"
                    />
                  </div>

                  <div>
                    <Label htmlFor="abcC">Class C Max Discount (%)</Label>
                    <Input
                      id="abcC"
                      type="number"
                      value={config?.abc_c_max_discount_percent || 30}
                      onChange={(e) => setConfig({ ...config, abc_c_max_discount_percent: Number(e.target.value) })}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Match Competitor Promotions</Label>
                      <p className="text-xs text-muted-foreground">
                        Try to match competitor promo prices when possible
                      </p>
                    </div>
                    <Switch
                      checked={config?.match_competitor_promo || false}
                      onCheckedChange={(checked) => setConfig({ ...config, match_competitor_promo: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Never Below Competitor Minimum</Label>
                      <p className="text-xs text-muted-foreground">
                        Ensure promo price is never below lowest competitor
                      </p>
                    </div>
                    <Switch
                      checked={config?.never_below_competitor_min || false}
                      onCheckedChange={(checked) => setConfig({ ...config, never_below_competitor_min: checked })}
                    />
                  </div>
                </div>
              </div>

              <Button onClick={saveConfig} disabled={loading}>
                {loading ? "Saving..." : "Save Configuration"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SmartPrice;