import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Plus, Search, Link as LinkIcon, Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddCompetitorDialog } from "@/components/AddCompetitorDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Competitor {
  id: string;
  name: string;
  website_url: string | null;
  type: string | null;
  country: string | null;
}

interface MatchResult {
  competitor_product_id: string;
  competitor_name: string;
  similarity_score: number;
  match_reasons: string[];
  latest_price: number | null;
  auto_approve_candidate: boolean;
}

const Competitors = () => {
  const { toast } = useToast();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [matching, setMatching] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [scrapingUrl, setScrapingUrl] = useState("");
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>("");

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

  const handleScrape = async () => {
    if (!scrapingUrl || !selectedCompetitor) {
      toast({
        title: "Error",
        description: "Please enter a URL and select a competitor",
        variant: "destructive",
      });
      return;
    }

    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-competitor', {
        body: { url: scrapingUrl, competitor_id: selectedCompetitor },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Scraped ${data.products?.length || 0} products from ${scrapingUrl}`,
      });

      setScrapingUrl("");
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

  const handleMatch = async () => {
    if (!selectedProduct) {
      toast({
        title: "Error",
        description: "Please select a product to match",
        variant: "destructive",
      });
      return;
    }

    setMatching(true);
    try {
      const { data, error } = await supabase.functions.invoke('match-products', {
        body: { 
          product_id: selectedProduct,
          competitor_id: selectedCompetitor 
        },
      });

      if (error) throw error;

      setMatchResults(data.matches || []);
      setShowMatchDialog(true);

      toast({
        title: "Success",
        description: `Found ${data.matches?.length || 0} potential matches`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to match products",
        variant: "destructive",
      });
    } finally {
      setMatching(false);
    }
  };

  const handleApproveMapping = async (matchResult: MatchResult) => {
    try {
      const { error } = await supabase
        .from('competitor_products')
        .update({ 
          our_product_id: selectedProduct,
        })
        .eq('id', matchResult.competitor_product_id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product mapping approved",
      });

      setMatchResults(prev => prev.filter(m => m.competitor_product_id !== matchResult.competitor_product_id));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Competitors</h1>
          <p className="text-muted-foreground">
            Track competitor products, prices and promotions
          </p>
        </div>
        <AddCompetitorDialog onCompetitorAdded={fetchCompetitors} />
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Competitors</TabsTrigger>
          <TabsTrigger value="scrape">Scrape Products</TabsTrigger>
          <TabsTrigger value="match">Match Products</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
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
            <CardHeader>
              <CardTitle>Tracked Competitors</CardTitle>
              <CardDescription>
                Manage your list of competitors
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
                              className="text-primary hover:underline"
                            >
                              Visit
                            </a>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scrape" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scrape Competitor Products</CardTitle>
              <CardDescription>
                Extract product and price information from competitor websites
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Select Competitor
                  </label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={selectedCompetitor || ""}
                    onChange={(e) => setSelectedCompetitor(e.target.value)}
                  >
                    <option value="">-- Select Competitor --</option>
                    {competitors.map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Product Listing URL
                  </label>
                  <Input
                    placeholder="https://competitor.com/products"
                    value={scrapingUrl}
                    onChange={(e) => setScrapingUrl(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleScrape}
                  disabled={scraping || !selectedCompetitor || !scrapingUrl}
                >
                  {scraping ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Scrape Products
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="match" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Product Matching</CardTitle>
              <CardDescription>
                Find competitor equivalents for your products
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Select Your Product
                  </label>
                  <Input
                    placeholder="Enter product ID or SKU"
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Filter by Competitor (Optional)
                  </label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={selectedCompetitor || ""}
                    onChange={(e) => setSelectedCompetitor(e.target.value)}
                  >
                    <option value="">All Competitors</option>
                    {competitors.map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  onClick={handleMatch}
                  disabled={matching || !selectedProduct}
                >
                  {matching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Matching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Find Matches
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Matches</DialogTitle>
            <DialogDescription>
              Review and approve competitor product mappings
            </DialogDescription>
          </DialogHeader>
          
          {matchResults.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No matches found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competitor Product</TableHead>
                  <TableHead>Similarity</TableHead>
                  <TableHead>Match Reasons</TableHead>
                  <TableHead>Latest Price</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchResults.map((match) => (
                  <TableRow key={match.competitor_product_id}>
                    <TableCell className="font-medium">
                      {match.competitor_name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={match.similarity_score > 0.8 ? "default" : "secondary"}
                      >
                        {(match.similarity_score * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {match.match_reasons.join(", ")}
                      </div>
                    </TableCell>
                    <TableCell>
                      {match.latest_price ? `€${match.latest_price.toFixed(2)}` : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApproveMapping(match)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMatchResults(prev => 
                              prev.filter(m => m.competitor_product_id !== match.competitor_product_id)
                            );
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Competitors;
