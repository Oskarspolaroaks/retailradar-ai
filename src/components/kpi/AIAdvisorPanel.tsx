import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Package,
  Target,
  X,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Recommendation {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  insight: string;
  recommendation: string;
  expected_impact: string;
  impact_category: string;
  is_dismissed: boolean;
}

interface AIAdvisorPanelProps {
  tenantId?: string;
  storeId?: string;
}

const severityConfig = {
  high: {
    bg: "bg-destructive/10 border-destructive/30",
    badge: "bg-destructive text-destructive-foreground",
    icon: AlertTriangle,
  },
  medium: {
    bg: "bg-warning/10 border-warning/30",
    badge: "bg-warning text-warning-foreground",
    icon: TrendingUp,
  },
  low: {
    bg: "bg-success/10 border-success/30",
    badge: "bg-success text-success-foreground",
    icon: Target,
  },
};

const impactIcons: Record<string, React.ReactNode> = {
  revenue: <DollarSign className="h-4 w-4" />,
  margin: <TrendingUp className="h-4 w-4" />,
  stock: <Package className="h-4 w-4" />,
  pricing: <Target className="h-4 w-4" />,
};

export const AIAdvisorPanel = ({ tenantId, storeId }: AIAdvisorPanelProps) => {
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendations();
  }, [tenantId, storeId]);

  const fetchRecommendations = async () => {
    try {
      let query = supabase
        .from("ai_recommendations")
        .select("*")
        .eq("is_dismissed", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (storeId) {
        query = query.eq("store_id", storeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecommendations((data || []) as Recommendation[]);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-recommendations", {
        body: { storeId },
      });

      if (error) throw error;

      toast({
        title: "Rekomendācijas ģenerētas!",
        description: `Izveidotas ${data.count || 0} jaunas rekomendācijas.`,
      });

      await fetchRecommendations();
    } catch (error: any) {
      console.error("Error generating recommendations:", error);
      toast({
        title: "Kļūda",
        description: error.message || "Neizdevās ģenerēt rekomendācijas",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const dismissRecommendation = async (id: string) => {
    try {
      await supabase
        .from("ai_recommendations")
        .update({ is_dismissed: true })
        .eq("id", id);

      setRecommendations(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error("Error dismissing recommendation:", error);
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/10">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Brain className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-xl">AI Retail Padomdevējs</CardTitle>
            <CardDescription className="text-base">
              Vecākais mazumtirdzniecības eksperts ar 20+ gadu pieredzi
            </CardDescription>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generateRecommendations}
          disabled={generating}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", generating && "animate-spin")} />
          {generating ? "Ģenerē..." : "Atjaunot"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {recommendations.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
              <Brain className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Nav aktīvu rekomendāciju</p>
              <p className="text-sm text-muted-foreground">
                Nospiediet "Atjaunot" lai ģenerētu jaunas AI rekomendācijas
              </p>
            </div>
            <Button onClick={generateRecommendations} disabled={generating}>
              <Brain className="h-4 w-4 mr-2" />
              Ģenerēt Rekomendācijas
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => {
              const config = severityConfig[rec.severity];
              const SeverityIcon = config.icon;
              const isExpanded = expandedId === rec.id;

              return (
                <div
                  key={rec.id}
                  className={cn(
                    "rounded-xl border p-4 transition-all cursor-pointer",
                    config.bg,
                    isExpanded && "ring-2 ring-primary/20"
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="h-8 w-8 rounded-lg bg-background/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <SeverityIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={cn("text-xs", config.badge)}>
                            {rec.severity === "high" ? "Augsta" : rec.severity === "medium" ? "Vidēja" : "Zema"}
                          </Badge>
                          {rec.impact_category && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {impactIcons[rec.impact_category]}
                              {rec.impact_category}
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-sm">{rec.title}</h4>
                        
                        {isExpanded && (
                          <div className="mt-3 space-y-3 text-sm animate-in slide-in-from-top-2">
                            <div>
                              <span className="font-medium text-muted-foreground">Situācija:</span>
                              <p className="mt-1">{rec.insight}</p>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">Rekomendācija:</span>
                              <p className="mt-1">{rec.recommendation}</p>
                            </div>
                            {rec.expected_impact && (
                              <div className="flex items-center gap-2 pt-2 border-t">
                                <TrendingUp className="h-4 w-4 text-success" />
                                <span className="text-success font-medium">{rec.expected_impact}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <ChevronRight className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isExpanded && "rotate-90"
                      )} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissRecommendation(rec.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
