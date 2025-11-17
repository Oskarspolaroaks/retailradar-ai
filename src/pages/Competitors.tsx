import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Sparkles, TrendingDown, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddCompetitorDialog } from "@/components/AddCompetitorDialog";

interface Competitor {
  id: string;
  name: string;
  website_url: string | null;
  type: string | null;
  country: string | null;
}

interface Promotion {
  id: string;
  promotion_name: string;
  slogan: string | null;
  description: string | null;
  product_category: string | null;
  discount_percent: number | null;
  discount_amount: number | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean | null;
  competitor_id: string;
  competitors: { name: string };
}

const Competitors = () => {
  const { toast } = useToast();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    fetchCompetitors();
    fetchPromotions();
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

  const fetchPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from("competitor_promotions")
        .select("*, competitors(name)")
        .order("start_date", { ascending: false });

      if (error) throw error;
      setPromotions(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const analyzePromotions = async () => {
    setAiLoading(true);
    setAiAnalysis("");

    try {
      const activePromos = promotions.filter(p => p.is_active);
      
      const { data, error } = await supabase.functions.invoke("analyze-promotions", {
        body: { promotions: activePromos },
      });

      if (error) throw error;

      setAiAnalysis(data.analysis || "No analysis available");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const filteredPromotions = promotions.filter(
    (p) => categoryFilter === "all" || p.product_category === categoryFilter
  );

  const categories = Array.from(new Set(promotions.map(p => p.product_category).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Competitors</h1>
          <p className="text-muted-foreground">
            Track competitor promotions and pricing strategies
          </p>
        </div>
        <AddCompetitorDialog onCompetitorAdded={fetchCompetitors} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
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
              Active Promotions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {promotions.filter(p => p.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Discount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {promotions.length > 0
                ? Math.round(
                    promotions.reduce((sum, p) => sum + (p.discount_percent || 0), 0) /
                      promotions.length
                  )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Competitor Promotions</CardTitle>
              <CardDescription>
                Monitor and analyze competitor promotional strategies
              </CardDescription>
            </div>
            <Button onClick={analyzePromotions} disabled={aiLoading || promotions.length === 0}>
              <Sparkles className="h-4 w-4 mr-2" />
              {aiLoading ? "Analyzing..." : "Generate AI Analysis"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat || ""}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {aiAnalysis && (
              <Card className="bg-accent/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    AI Strategic Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{aiAnalysis}</p>
                </CardContent>
              </Card>
            )}

            {filteredPromotions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No promotions found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competitor</TableHead>
                    <TableHead>Promotion</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPromotions.map((promo) => (
                    <TableRow key={promo.id}>
                      <TableCell className="font-medium">
                        {promo.competitors.name}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{promo.promotion_name}</div>
                          {promo.slogan && (
                            <div className="text-sm text-muted-foreground">{promo.slogan}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{promo.product_category}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-destructive" />
                          <span className="font-medium">{promo.discount_percent}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {new Date(promo.start_date).toLocaleDateString()} -{" "}
                          {promo.end_date
                            ? new Date(promo.end_date).toLocaleDateString()
                            : "Ongoing"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={promo.is_active ? "default" : "secondary"}>
                          {promo.is_active ? "Active" : "Ended"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
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
    </div>
  );
};

export default Competitors;
