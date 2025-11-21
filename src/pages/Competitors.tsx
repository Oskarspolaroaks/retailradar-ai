import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Play, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddCompetitorDialog } from "@/components/AddCompetitorDialog";
import { CompetitorPromotionsTab } from "@/components/CompetitorPromotionsTab";
import { CompetitorMappingTab } from "@/components/CompetitorMappingTab";

interface Competitor {
  id: string;
  name: string;
  website_url: string | null;
  type: string | null;
  country: string | null;
  last_catalog_scrape: string | null;
  last_promo_scrape: string | null;
}

const Competitors = () => {
  const { toast } = useToast();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);

  useEffect(() => {
    fetchCompetitors();
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
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickScrape = async (competitor: Competitor) => {
    if (!competitor.website_url) {
      toast({
        title: "Error",
        description: "No website URL configured for this competitor",
        variant: "destructive",
      });
      return;
    }

    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-competitor', {
        body: { 
          url: competitor.website_url, 
          competitor_id: competitor.id 
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Scraped ${data.products?.length || 0} products from ${competitor.name}`,
      });

      fetchCompetitors();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to scrape competitor",
        variant: "destructive",
      });
    } finally {
      setScraping(false);
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
          <h1 className="text-3xl font-bold">Competitor Intelligence</h1>
          <p className="text-muted-foreground mt-2">
            Track competitor products, prices, and promotional campaigns
          </p>
        </div>
        <AddCompetitorDialog onCompetitorAdded={fetchCompetitors} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="mappings">Product Mappings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Competitors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{competitors.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Monitoring
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {competitors.filter(c => c.website_url).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  with website URLs
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Last Scrape
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {competitors.some(c => c.last_catalog_scrape)
                    ? "Daily at 2 AM"
                    : "Not configured"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Automated scheduling active
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Competitors Table */}
          <Card>
            <CardHeader>
              <CardTitle>Tracked Competitors</CardTitle>
              <CardDescription>
                Manage your competitor list and trigger manual scrapes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {competitors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="mb-4">No competitors added yet</p>
                  <AddCompetitorDialog onCompetitorAdded={fetchCompetitors} />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead>Last Scrape</TableHead>
                      <TableHead>Actions</TableHead>
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
                              className="text-primary hover:underline text-sm"
                            >
                              Visit
                            </a>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {competitor.last_catalog_scrape ? (
                            <span className="text-sm text-muted-foreground">
                              {new Date(competitor.last_catalog_scrape).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuickScrape(competitor)}
                              disabled={scraping || !competitor.website_url}
                            >
                              {scraping ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Play className="w-4 h-4 mr-1" />
                                  Scrape
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedCompetitorId(competitor.id)}
                            >
                              View Details
                            </Button>
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

        <TabsContent value="promotions">
          {selectedCompetitorId ? (
            <CompetitorPromotionsTab competitorId={selectedCompetitorId} />
          ) : (
            <Card className="p-8 text-center">
              <h3 className="font-semibold mb-2">Select a Competitor</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose a competitor from the Overview tab to view their promotions
              </p>
              <Button onClick={() => setSelectedCompetitorId(competitors[0]?.id || null)}>
                {competitors.length > 0 ? `View ${competitors[0]?.name} Promotions` : "Add Competitor First"}
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="mappings">
          {selectedCompetitorId ? (
            <CompetitorMappingTab competitorId={selectedCompetitorId} />
          ) : (
            <Card className="p-8 text-center">
              <h3 className="font-semibold mb-2">Select a Competitor</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose a competitor from the Overview tab to manage product mappings
              </p>
              <Button onClick={() => setSelectedCompetitorId(competitors[0]?.id || null)}>
                {competitors.length > 0 ? `View ${competitors[0]?.name} Mappings` : "Add Competitor First"}
              </Button>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Competitors;
