import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Play, Loader2, Brain, Trash2, RefreshCw, Link2, ExternalLink, TrendingUp, TrendingDown, Minus, Search, ArrowUpDown, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddCompetitorDialog } from "@/components/AddCompetitorDialog";
import { CompetitorPromotionsTab } from "@/components/CompetitorPromotionsTab";
import { CompetitorMappingTab } from "@/components/CompetitorMappingTab";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface Competitor {
  id: string;
  name: string;
  website_url: string | null;
  scraping_url: string | null;
  type: string | null;
  country: string | null;
  last_catalog_scrape: string | null;
  last_promo_scrape: string | null;
}

interface MappingStats {
  total: number;
  matched: number;
  pending: number;
}

interface PriceComparison {
  productId: string;
  productName: string;
  productSku: string;
  ourPrice: number;
  competitorPrices: { competitorName: string; price: number }[];
  avgCompetitorPrice: number;
  minCompetitorPrice: number;
  maxCompetitorPrice: number;
  priceIndex: number; // ourPrice / avgCompPrice * 100
  position: "cheaper" | "equal" | "expensive";
  category: string;
}

const Competitors = () => {
  const { toast } = useToast();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [mappingStats, setMappingStats] = useState<MappingStats>({ total: 0, matched: 0, pending: 0 });
  const [productStats, setProductStats] = useState({ total: 0, linked: 0 });
  const [priceComparisons, setPriceComparisons] = useState<PriceComparison[]>([]);
  const [priceSearchQuery, setPriceSearchQuery] = useState("");
  const [pricePositionFilter, setPricePositionFilter] = useState("all");
  const [priceSortBy, setPriceSortBy] = useState<"index" | "name" | "diff">("index");
  const [loadingPrices, setLoadingPrices] = useState(false);

  useEffect(() => {
    fetchCompetitors();
    fetchStats();
    fetchPriceComparisons();
  }, []);

  const fetchCompetitors = async () => {
    try {
      const { data, error } = await supabase
        .from("competitors")
        .select("*")
        .order("name");

      if (error) throw error;
      setCompetitors(data || []);
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

  const fetchStats = async () => {
    try {
      // Mapping stats
      const { data: mappings, error: mappingError } = await supabase
        .from("competitor_product_mapping")
        .select("mapping_status");

      if (!mappingError && mappings) {
        setMappingStats({
          total: mappings.length,
          matched: mappings.filter(m => m.mapping_status === 'auto_matched' || m.mapping_status === 'approved').length,
          pending: mappings.filter(m => m.mapping_status === 'pending').length,
        });
      }

      // Product stats
      const { data: products, error: prodError } = await supabase
        .from("competitor_products")
        .select("id");

      if (!prodError && products) {
        setProductStats({
          total: products.length,
          linked: products.length, // All are linked from Excel import
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchPriceComparisons = async () => {
    setLoadingPrices(true);
    try {
      // Fetch all mappings with product info
      const { data: mappings, error: mappingError } = await supabase
        .from("competitor_product_mapping")
        .select("our_product_id, competitor_product_sku, competitor_id")
        .in("mapping_status", ["auto_matched", "approved"]);

      if (mappingError) throw mappingError;
      if (!mappings || mappings.length === 0) {
        setPriceComparisons([]);
        return;
      }

      // Fetch competitor products with prices (if they exist)
      const competitorProductSkus = mappings.map(m => m.competitor_product_sku).filter(Boolean);
      const { data: compProducts } = competitorProductSkus.length > 0
        ? await supabase
            .from("competitor_products")
            .select("id, competitor_name, competitor_id, competitor_sku")
            .in("competitor_sku", competitorProductSkus)
        : { data: [] };

      // Also check competitor_price_history for price data
      const { data: priceHistory } = competitorProductSkus.length > 0
        ? await supabase
            .from("competitor_price_history")
            .select("competitor_product_id, price, date")
            .order("date", { ascending: false })
        : { data: [] };

      // Fetch our products
      const ourProductIds = [...new Set(mappings.map(m => m.our_product_id).filter(Boolean))];
      // Paginate to get all products
      let allOurProducts: any[] = [];
      const pageSize = 1000;
      for (let i = 0; i < ourProductIds.length; i += pageSize) {
        const batch = ourProductIds.slice(i, i + pageSize);
        const { data: products } = await supabase
          .from("products")
          .select("id, name, sku, current_price, category")
          .in("id", batch);
        if (products) allOurProducts = allOurProducts.concat(products);
      }

      // Fetch competitors for names
      const { data: compList } = await supabase
        .from("competitors")
        .select("id, name");

      // Build lookup maps
      const ourProductMap = new Map(allOurProducts.map(p => [p.id, p]));
      const compProductMap = new Map(compProducts?.map(cp => [cp.competitor_sku, cp]) || []);
      const compNameMap = new Map(compList?.map(c => [c.id, c.name]) || []);

      // Build latest price map from history (keyed by competitor_product_id)
      const latestPriceMap = new Map<string, number>();
      priceHistory?.forEach(ph => {
        if (!latestPriceMap.has(ph.competitor_product_id) && ph.price) {
          latestPriceMap.set(ph.competitor_product_id, Number(ph.price));
        }
      });

      // Group mappings by our_product_id
      const productGroups = new Map<string, { competitorName: string; price: number }[]>();
      mappings.forEach(m => {
        if (!m.our_product_id || !m.competitor_product_sku) return;
        const compProd = compProductMap.get(m.competitor_product_sku);
        // Try to get price from price history or competitor_products
        const price = compProd ? latestPriceMap.get(compProd.id) : undefined;
        if (!price || price <= 0) return;

        const competitorName = compNameMap.get(m.competitor_id || compProd?.competitor_id) || "Konkurents";
        const existing = productGroups.get(m.our_product_id) || [];
        existing.push({ competitorName, price });
        productGroups.set(m.our_product_id, existing);
      });

      // Build price comparisons
      const comparisons: PriceComparison[] = [];
      productGroups.forEach((compPrices, productId) => {
        const ourProduct = ourProductMap.get(productId);
        if (!ourProduct || !ourProduct.current_price) return;

        const ourPrice = Number(ourProduct.current_price);
        if (ourPrice <= 0) return;

        const prices = compPrices.map(cp => cp.price);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const index = (ourPrice / avgPrice) * 100;

        let position: "cheaper" | "equal" | "expensive" = "equal";
        if (ourPrice < avgPrice * 0.98) position = "cheaper";
        else if (ourPrice > avgPrice * 1.02) position = "expensive";

        comparisons.push({
          productId,
          productName: ourProduct.name,
          productSku: ourProduct.sku,
          ourPrice,
          competitorPrices: compPrices,
          avgCompetitorPrice: avgPrice,
          minCompetitorPrice: minPrice,
          maxCompetitorPrice: maxPrice,
          priceIndex: index,
          position,
          category: ourProduct.category || "",
        });
      });

      setPriceComparisons(comparisons);
    } catch (error: any) {
      console.error("Error fetching price comparisons:", error);
    } finally {
      setLoadingPrices(false);
    }
  };

  const handleScrape = async (competitor: Competitor) => {
    const url = competitor.scraping_url || competitor.website_url;
    if (!url) {
      toast({
        title: "Kļūda",
        description: "Nav norādīta mājaslapas adrese",
        variant: "destructive",
      });
      return;
    }

    setScraping(competitor.id);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-competitor-ai', {
        body: {
          url,
          competitor_id: competitor.id,
          use_ai: true,
        },
      });

      if (error) throw error;

      if (data.products?.length > 0) {
        toast({
          title: "Veiksmīgi",
          description: `Izvilkti ${data.products.length} produkti no ${competitor.name}`,
        });
      } else {
        toast({
          title: "Informācija",
          description: data.message || `Produkti netika atrasti. Mājaslapa var izmantot JavaScript rendering.`,
        });
      }

      fetchCompetitors();
      fetchStats();
    } catch (error: any) {
      toast({
        title: "Kļūda",
        description: error.message || "Neizdevās scrapot konkurentu",
        variant: "destructive",
      });
    } finally {
      setScraping(null);
    }
  };

  const handleAIMatch = async (competitorId?: string) => {
    setMatching(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-match-products', {
        body: {
          mode: 'auto',
          competitor_id: competitorId,
        },
      });

      if (error) throw error;

      toast({
        title: "AI Matching Pabeigts",
        description: data.message || `Savienoti ${data.matched_mappings || 0} produkti`,
      });

      fetchStats();
    } catch (error: any) {
      toast({
        title: "Kļūda",
        description: error.message || "AI matching neizdevās",
        variant: "destructive",
      });
    } finally {
      setMatching(false);
    }
  };

  const handleDeleteCompetitor = async (id: string) => {
    try {
      const { error } = await supabase
        .from("competitors")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Dzēsts",
        description: "Konkurents dzēsts",
      });

      fetchCompetitors();
      fetchStats();
    } catch (error: any) {
      toast({
        title: "Kļūda",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Price comparison stats
  const priceStats = {
    total: priceComparisons.length,
    cheaper: priceComparisons.filter(p => p.position === "cheaper").length,
    equal: priceComparisons.filter(p => p.position === "equal").length,
    expensive: priceComparisons.filter(p => p.position === "expensive").length,
    avgIndex: priceComparisons.length > 0
      ? priceComparisons.reduce((sum, p) => sum + p.priceIndex, 0) / priceComparisons.length
      : 100,
  };

  // Filter and sort price comparisons
  const filteredComparisons = priceComparisons
    .filter(p => {
      const matchesSearch = !priceSearchQuery ||
        p.productName.toLowerCase().includes(priceSearchQuery.toLowerCase()) ||
        p.productSku.toLowerCase().includes(priceSearchQuery.toLowerCase());
      const matchesPosition = pricePositionFilter === "all" || p.position === pricePositionFilter;
      return matchesSearch && matchesPosition;
    })
    .sort((a, b) => {
      if (priceSortBy === "index") return b.priceIndex - a.priceIndex;
      if (priceSortBy === "name") return a.productName.localeCompare(b.productName);
      if (priceSortBy === "diff") return Math.abs(b.priceIndex - 100) - Math.abs(a.priceIndex - 100);
      return 0;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Konkurentu Izlūkošana</h1>
          <p className="text-muted-foreground mt-2">
            Sekojiet konkurentu produktiem, cenām un akcijām
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleAIMatch()}
            disabled={matching}
          >
            {matching ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Brain className="w-4 h-4 mr-2" />
            )}
            AI Produktu Savienošana
          </Button>
          <AddCompetitorDialog onCompetitorAdded={fetchCompetitors} />
        </div>
      </div>

      <Tabs defaultValue="prices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="prices">Cenu Salīdzinājums ({priceStats.total})</TabsTrigger>
          <TabsTrigger value="overview">Konkurenti ({competitors.length})</TabsTrigger>
          <TabsTrigger value="mappings">Produktu Savienojumi ({mappingStats.total})</TabsTrigger>
          <TabsTrigger value="promotions">Akcijas</TabsTrigger>
        </TabsList>

        {/* PRICE COMPARISON TAB */}
        <TabsContent value="prices" className="space-y-4">
          {/* Price Index Summary Cards */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cenu Indekss
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${priceStats.avgIndex > 102 ? 'text-red-600' : priceStats.avgIndex < 98 ? 'text-green-600' : 'text-blue-600'}`}>
                  {priceStats.avgIndex.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {priceStats.avgIndex > 102 ? "Virs tirgus" : priceStats.avgIndex < 98 ? "Zem tirgus" : "Tirgus līmenī"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Monitorēti Produkti
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{priceStats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  no {competitors.length} konkurentiem
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  Lētāki
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{priceStats.cheaper}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {priceStats.total > 0 ? ((priceStats.cheaper / priceStats.total) * 100).toFixed(0) : 0}% no monitorētajiem
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Minus className="h-3 w-3" />
                  Vienādi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{priceStats.equal}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {priceStats.total > 0 ? ((priceStats.equal / priceStats.total) * 100).toFixed(0) : 0}% no monitorētajiem
                </p>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Dārgāki
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{priceStats.expensive}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {priceStats.total > 0 ? ((priceStats.expensive / priceStats.total) * 100).toFixed(0) : 0}% no monitorētajiem
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Price Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Detalizēts Cenu Salīdzinājums
              </CardTitle>
              <CardDescription>
                Jūsu cenas salīdzinājumā ar konkurentu cenām. Indekss &gt; 100 = dārgāki par tirgu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Meklēt produktu..."
                    value={priceSearchQuery}
                    onChange={(e) => setPriceSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={pricePositionFilter} onValueChange={setPricePositionFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Visas pozīcijas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Visas pozīcijas</SelectItem>
                    <SelectItem value="cheaper">Lētāki</SelectItem>
                    <SelectItem value="equal">Vienādi</SelectItem>
                    <SelectItem value="expensive">Dārgāki</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priceSortBy} onValueChange={(v) => setPriceSortBy(v as any)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Kārtot pēc" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="index">Pēc indeksa (augstākais)</SelectItem>
                    <SelectItem value="diff">Pēc starpības</SelectItem>
                    <SelectItem value="name">Pēc nosaukuma</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={fetchPriceComparisons}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {loadingPrices ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Ielādē cenu datus...</p>
                </div>
              ) : filteredComparisons.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nav cenu datu. Importējiet konkurentu cenas vai palaidiet scraper.</p>
                </div>
              ) : (
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Produkts</TableHead>
                        <TableHead className="text-right">Mūsu Cena</TableHead>
                        <TableHead className="text-right">Vid. Konkurentu</TableHead>
                        <TableHead className="text-right">Min</TableHead>
                        <TableHead className="text-right">Max</TableHead>
                        <TableHead className="text-center">Indekss</TableHead>
                        <TableHead className="text-center">Pozīcija</TableHead>
                        <TableHead>Konkurenti</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredComparisons.map((comp) => (
                        <TableRow key={comp.productId}>
                          <TableCell>
                            <div className="font-medium text-sm">{comp.productName}</div>
                            <div className="text-xs text-muted-foreground">{comp.productSku}</div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            €{comp.ourPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            €{comp.avgCompetitorPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            €{comp.minCompetitorPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            €{comp.maxCompetitorPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${
                              comp.priceIndex > 105 ? 'text-red-600' :
                              comp.priceIndex < 95 ? 'text-green-600' :
                              'text-blue-600'
                            }`}>
                              {comp.priceIndex.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {comp.position === "cheaper" && (
                              <Badge className="bg-green-500/10 text-green-700 border-green-500/20">
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Lētāks
                              </Badge>
                            )}
                            {comp.position === "equal" && (
                              <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                                <Minus className="h-3 w-3 mr-1" />
                                Vienāds
                              </Badge>
                            )}
                            {comp.position === "expensive" && (
                              <Badge className="bg-red-500/10 text-red-700 border-red-500/20">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Dārgāks
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {comp.competitorPrices.map((cp, i) => (
                                <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                  {cp.competitorName}: €{cp.price.toFixed(2)}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {filteredComparisons.length > 0 && (
                <p className="text-xs text-muted-foreground text-right">
                  Rāda {filteredComparisons.length} no {priceComparisons.length} produktiem
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Konkurenti
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{competitors.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {competitors.filter(c => c.website_url).length} ar URL
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Konkurentu Produkti
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{productStats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {productStats.linked} savienoti ar mūsu produktiem
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  AI Savienojumi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{mappingStats.matched}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {mappingStats.pending} gaida apstiprināšanu
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cenu Indekss
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${priceStats.avgIndex > 102 ? 'text-red-600' : priceStats.avgIndex < 98 ? 'text-green-600' : 'text-blue-600'}`}>
                  {priceStats.avgIndex.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  vs tirgus vidējā cena
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Competitors Table */}
          <Card>
            <CardHeader>
              <CardTitle>Konkurentu Saraksts</CardTitle>
              <CardDescription>
                Pārvaldiet konkurentus un palaidiet manuālus scrapes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {competitors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="mb-4">Nav pievienotu konkurentu</p>
                  <AddCompetitorDialog onCompetitorAdded={fetchCompetitors} />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nosaukums</TableHead>
                      <TableHead>Mājaslapa</TableHead>
                      <TableHead className="text-center">Produkti</TableHead>
                      <TableHead>Darbības</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competitors.map((competitor) => (
                      <TableRow key={competitor.id}>
                        <TableCell className="font-medium">{competitor.name}</TableCell>
                        <TableCell>
                          {competitor.website_url ? (
                            <a
                              href={competitor.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {competitor.website_url.replace(/^https?:\/\//, '')}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {priceComparisons.filter(p =>
                            p.competitorPrices.some(cp => cp.competitorName === competitor.name)
                          ).length}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleScrape(competitor)}
                              disabled={scraping === competitor.id || !competitor.website_url}
                            >
                              {scraping === competitor.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Play className="w-4 h-4 mr-1" />
                                  Scrapot
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAIMatch(competitor.id)}
                              disabled={matching}
                            >
                              <Link2 className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Dzēst konkurentu?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Vai tiešām vēlaties dzēst {competitor.name}? Šo darbību nevar atsaukt.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Atcelt</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCompetitor(competitor.id)}>
                                    Dzēst
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings">
          <CompetitorMappingTab competitorId={selectedCompetitorId || competitors[0]?.id} />
        </TabsContent>

        <TabsContent value="promotions">
          <CompetitorPromotionsTab competitorId={selectedCompetitorId || competitors[0]?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Competitors;
