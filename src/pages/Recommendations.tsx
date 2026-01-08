import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Recommendation {
  id: string;
  product_id: string;
  current_price: number;
  recommended_price: number;
  recommended_change_percent: number;
  reasoning: string;
  abc_class: string | null;
  status: string;
  competitor_avg_price: number | null;
  products?: {
    sku: string;
    name: string;
    cost_price: number;
  };
}

const Recommendations = () => {
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("new");
  const [abcFilter, setAbcFilter] = useState<string>("all");
  const [allRecommendations, setAllRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const { data, error } = await supabase
        .from("pricing_recommendations")
        .select(`
          *,
          products!inner(sku, name, cost_price, brand, abc_category, categories(name))
        `)
        .order("recommended_change_percent", { ascending: false });

      if (error) {
        console.error("Fetch error:", error);
        throw error;
      }
      
      console.log("Fetched recommendations:", data?.length || 0);
      setAllRecommendations(data || []);
      applyFilters(data || []);
    } catch (error: any) {
      console.error("Error fetching recommendations:", error);
      toast({
        title: "Kļūda ielādējot rekomendācijas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (data: Recommendation[]) => {
    let filtered = data;

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // ABC filter
    if (abcFilter !== "all") {
      filtered = filtered.filter(r => r.abc_class === abcFilter);
    }

    setRecommendations(filtered);
  };

  useEffect(() => {
    applyFilters(allRecommendations);
  }, [statusFilter, abcFilter]);

  const generateRecommendations = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-recommendations");

      if (error) throw error;

      toast({
        title: "Izdevās",
        description: data.message || "Rekomendācijas ģenerētas",
      });

      fetchRecommendations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptRecommendation = async (rec: Recommendation) => {
    try {
      // Update product price
      const { error: productError } = await supabase
        .from("products")
        .update({ current_price: rec.recommended_price })
        .eq("id", rec.product_id);

      if (productError) throw productError;

      // Mark recommendation as accepted
      const { error: recError } = await supabase
        .from("pricing_recommendations")
        .update({ status: "accepted" })
        .eq("id", rec.id);

      if (recError) throw recError;

      toast({
        title: "Cena Atjaunināta",
        description: `${rec.products?.name} cena atjaunināta uz €${rec.recommended_price.toFixed(2)}`,
      });

      fetchRecommendations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejectRecommendation = async (recId: string) => {
    try {
      const { error } = await supabase
        .from("pricing_recommendations")
        .update({ status: "rejected" })
        .eq("id", recId);

      if (error) throw error;

      toast({
        title: "Rekomendācija Noraidīta",
      });

      fetchRecommendations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getActionType = (changePercent: number) => {
    if (changePercent > 1) return "increase_price";
    if (changePercent < -1) return "decrease_price";
    return "keep_price";
  };

  const getIcon = (changePercent: number) => {
    const type = getActionType(changePercent);
    switch (type) {
      case "increase_price":
        return <TrendingUp className="h-4 w-4 text-success" />;
      case "decrease_price":
        return <TrendingDown className="h-4 w-4 text-warning" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBadgeVariant = (changePercent: number): "default" | "secondary" | "outline" => {
    const type = getActionType(changePercent);
    switch (type) {
      case "increase_price":
        return "default";
      case "decrease_price":
        return "secondary";
      default:
        return "outline";
    }
  };

  const increaseCount = recommendations.filter(r => r.recommended_change_percent > 1).length;
  const decreaseCount = recommendations.filter(r => r.recommended_change_percent < -1).length;
  const keepCount = recommendations.filter(r => Math.abs(r.recommended_change_percent) <= 1).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI Cenu Rekomendācijas</h1>
          <p className="text-muted-foreground">
            Inteliģentas cenu ieteikumi balstīti uz tirgus analīzi
          </p>
        </div>
        <Button onClick={generateRecommendations} disabled={generating}>
          <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
          {generating ? "Ģenerē..." : "Ģenerēt Jaunas Rekomendācijas"}
        </Button>
      </div>

      {recommendations.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Cenu Paaugstināšana</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{increaseCount}</div>
              <p className="text-xs text-muted-foreground">Produkti kuriem palielināt cenu</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Cenu Samazināšana</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{decreaseCount}</div>
              <p className="text-xs text-muted-foreground">Produkti kuriem samazināt cenu</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Saglabāt Cenu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{keepCount}</div>
              <p className="text-xs text-muted-foreground">Optimāla cena</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Cenu Rekomendācijas</CardTitle>
              <CardDescription>
                Pārskatiet un pieņemiet AI ģenerētas cenu rekomendācijas
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filtrēt pēc statusa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visi Statusi</SelectItem>
                  <SelectItem value="new">Jauni</SelectItem>
                  <SelectItem value="accepted">Pieņemti</SelectItem>
                  <SelectItem value="rejected">Noraidīti</SelectItem>
                </SelectContent>
              </Select>
              <Select value={abcFilter} onValueChange={setAbcFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filtrēt pēc ABC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visas Klases</SelectItem>
                  <SelectItem value="A">Klase A</SelectItem>
                  <SelectItem value="B">Klase B</SelectItem>
                  <SelectItem value="C">Klase C</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Ielādē rekomendācijas...</div>
          ) : allRecommendations.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                <h3 className="text-lg font-semibold mb-2">Nav Rekomendāciju</h3>
                <p className="text-sm mb-4">Ģenerējiet AI cenu rekomendācijas balstoties uz jūsu produktiem, konkurentu cenām un pārdošanas datiem.</p>
              </div>
              <Button onClick={generateRecommendations} disabled={generating} size="lg">
                <RefreshCw className={`h-4 w-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
                {generating ? "Ģenerē..." : "Ģenerēt AI Rekomendācijas"}
              </Button>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nav rekomendāciju, kas atbilst pašreizējiem filtriem</p>
              <p className="text-sm mt-2">Pamēģiniet mainīt filtrus vai ģenerēt jaunas rekomendācijas</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
          <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produkts</TableHead>
                    <TableHead className="text-center">ABC</TableHead>
                    <TableHead className="text-right">Pašreizējā Cena</TableHead>
                    <TableHead className="text-right">Ieteiktā Cena</TableHead>
                    <TableHead className="text-right">Izmaiņas</TableHead>
                    <TableHead className="text-center">Darbība</TableHead>
                    <TableHead className="text-right">Jauna Marža</TableHead>
                    <TableHead>Statuss</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendations.map((rec) => {
                    const newMargin = ((rec.recommended_price - Number(rec.products?.cost_price || 0)) / rec.recommended_price * 100);
                    const changePercent = rec.recommended_change_percent;
                    const actionType = getActionType(changePercent);
                    
                    return (
                      <TableRow key={rec.id}>
                        <TableCell className="font-mono text-sm">{rec.products?.sku}</TableCell>
                        <TableCell>
                          <div className="font-medium">{rec.products?.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {rec.reasoning}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{rec.abc_class || "N/A"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">€{rec.current_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          €{rec.recommended_price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {getIcon(changePercent)}
                            <span className={changePercent > 0 ? "text-success" : changePercent < 0 ? "text-warning" : ""}>
                              {changePercent > 0 ? "+" : ""}{changePercent.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={
                              actionType === "increase_price" ? "default" : 
                              actionType === "decrease_price" ? "secondary" : 
                              "outline"
                            }
                          >
                            {actionType === "increase_price" && "📈 PALIELINĀT"}
                            {actionType === "decrease_price" && "📉 SAMAZINĀT"}
                            {actionType === "keep_price" && "✓ SAGLABĀT"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="default">{newMargin.toFixed(1)}%</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              rec.status === "accepted" ? "default" : 
                              rec.status === "rejected" ? "secondary" : 
                              "outline"
                            }
                          >
                            {rec.status === "new" ? "Jauns" : rec.status === "accepted" ? "Pieņemts" : "Noraidīts"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rec.status === "new" && (
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="default"
                                onClick={() => handleAcceptRecommendation(rec)}
                              >
                                Pieņemt
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleRejectRecommendation(rec.id)}
                              >
                                Noraidīt
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Recommendations;