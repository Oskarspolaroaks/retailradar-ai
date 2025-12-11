import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Play, Loader2, Brain, Trash2, RefreshCw, Link2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddCompetitorDialog } from "@/components/AddCompetitorDialog";
import { CompetitorPromotionsTab } from "@/components/CompetitorPromotionsTab";
import { CompetitorMappingTab } from "@/components/CompetitorMappingTab";
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

const Competitors = () => {
  const { toast } = useToast();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [mappingStats, setMappingStats] = useState<MappingStats>({ total: 0, matched: 0, pending: 0 });
  const [productStats, setProductStats] = useState({ total: 0, linked: 0 });

  useEffect(() => {
    fetchCompetitors();
    fetchStats();
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
        .select("id, our_product_id");
      
      if (!prodError && products) {
        setProductStats({
          total: products.length,
          linked: products.filter(p => p.our_product_id).length,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
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
      // Try AI scraper first
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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Pārskats</TabsTrigger>
          <TabsTrigger value="mappings">Produktu Savienojumi ({mappingStats.total})</TabsTrigger>
          <TabsTrigger value="promotions">Akcijas</TabsTrigger>
        </TabsList>

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
                  Pēdējais Scrape
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {competitors.some(c => c.last_catalog_scrape)
                    ? new Date(Math.max(...competitors.filter(c => c.last_catalog_scrape).map(c => new Date(c.last_catalog_scrape!).getTime()))).toLocaleDateString('lv')
                    : "Nav veikts"}
                </div>
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
                      <TableHead>Tips</TableHead>
                      <TableHead>Valsts</TableHead>
                      <TableHead>Mājaslapa</TableHead>
                      <TableHead>Pēdējais Scrape</TableHead>
                      <TableHead>Darbības</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competitors.map((competitor) => (
                      <TableRow key={competitor.id}>
                        <TableCell className="font-medium">{competitor.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{competitor.type || "N/A"}</Badge>
                        </TableCell>
                        <TableCell>{competitor.country || "N/A"}</TableCell>
                        <TableCell>
                          {competitor.website_url ? (
                            <a
                              href={competitor.website_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Atvērt
                            </a>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {competitor.last_catalog_scrape ? (
                            <span className="text-sm text-muted-foreground">
                              {new Date(competitor.last_catalog_scrape).toLocaleDateString('lv')}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Nekad</span>
                          )}
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedCompetitorId(competitor.id)}
                            >
                              Skatīt
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
