import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  BarChart3, 
  Target,
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  Store
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface KPITarget {
  kpi_name: string;
  kpi_category: string;
  target_value: number;
  warning_threshold?: number;
  unit: string;
}

const DEFAULT_KPIS: KPITarget[] = [
  { kpi_name: "revenue_growth", kpi_category: "sales", target_value: 10, warning_threshold: 5, unit: "%" },
  { kpi_name: "gross_margin", kpi_category: "profitability", target_value: 25, warning_threshold: 20, unit: "%" },
  { kpi_name: "revenue_per_store", kpi_category: "sales", target_value: 100000, warning_threshold: 80000, unit: "€" },
  { kpi_name: "stock_turnover", kpi_category: "operations", target_value: 12, warning_threshold: 8, unit: "x" },
  { kpi_name: "price_index_vs_market", kpi_category: "pricing", target_value: 100, warning_threshold: 105, unit: "%" },
  { kpi_name: "a_products_revenue_share", kpi_category: "assortment", target_value: 70, warning_threshold: 60, unit: "%" },
];

const KPI_CATEGORIES = [
  { id: "sales", name: "Pārdošanas Veiktspēja", icon: TrendingUp, color: "text-chart-1" },
  { id: "profitability", name: "Rentabilitāte", icon: DollarSign, color: "text-chart-2" },
  { id: "assortment", name: "Sortiments & Produkti", icon: Package, color: "text-chart-3" },
  { id: "operations", name: "Krājumi & Operācijas", icon: BarChart3, color: "text-chart-4" },
  { id: "pricing", name: "Cenu Konkurētspēja", icon: Target, color: "text-chart-5" },
];

const KPI_LABELS: Record<string, string> = {
  revenue_growth: "Ieņēmumu Pieaugums",
  gross_margin: "Bruto Peļņa",
  revenue_per_store: "Ieņēmumi uz Veikalu",
  stock_turnover: "Krājumu Apgrozījums",
  price_index_vs_market: "Cenu Indekss vs Tirgus",
  a_products_revenue_share: "A-produktu Ieņēmumu Daļa",
};

interface KPIOnboardingWizardProps {
  tenantId: string;
  onComplete: () => void;
}

export const KPIOnboardingWizard = ({ tenantId, onComplete }: KPIOnboardingWizardProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [kpiTargets, setKpiTargets] = useState<KPITarget[]>(DEFAULT_KPIS);
  const [setupScope, setSetupScope] = useState<"company" | "both">("company");

  const totalSteps = 3;
  const progress = ((step + 1) / totalSteps) * 100;

  const updateKPIValue = (kpiName: string, field: "target_value" | "warning_threshold", value: number) => {
    setKpiTargets(prev => 
      prev.map(kpi => 
        kpi.kpi_name === kpiName ? { ...kpi, [field]: value } : kpi
      )
    );
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Insert all KPI targets
      const kpiData = kpiTargets.map(kpi => ({
        tenant_id: tenantId,
        scope: "company",
        kpi_name: kpi.kpi_name,
        kpi_category: kpi.kpi_category,
        target_value: kpi.target_value,
        warning_threshold: kpi.warning_threshold,
        unit: kpi.unit,
      }));

      const { error: kpiError } = await supabase
        .from("kpi_targets")
        .insert(kpiData);

      if (kpiError) throw kpiError;

      // Mark onboarding as complete
      const { error: onboardingError } = await supabase
        .from("tenant_onboarding")
        .upsert({
          tenant_id: tenantId,
          kpi_setup_completed: true,
          completed_at: new Date().toISOString(),
        });

      if (onboardingError) throw onboardingError;

      toast({
        title: "KPI iestatīšana pabeigta!",
        description: "Jūsu biznesa KPI tagad tiks izsekoti.",
      });

      onComplete();
    } catch (error: any) {
      console.error("Error saving KPI targets:", error);
      toast({
        title: "Kļūda",
        description: error.message || "Neizdevās saglabāt KPI mērķus",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <Card className="w-full max-w-3xl mx-4 shadow-2xl border-primary/20">
        <CardHeader className="space-y-4 pb-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Target className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-2xl">Definējiet Jūsu Biznesa KPI</CardTitle>
                <CardDescription className="text-base mt-1">
                  Šie KPI tiks izmantoti, lai izsekotu jūsu izaugsmi un vadītu AI rekomendācijas
                </CardDescription>
              </div>
            </div>
            <span className="text-sm text-muted-foreground font-medium">
              Solis {step + 1} no {totalSteps}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>

        <CardContent className="pt-6 pb-8">
          {step === 0 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Izvēlieties KPI apjomu</h3>
              <p className="text-muted-foreground">
                Jūs varat definēt KPI uzņēmuma līmenī vai arī pievienot veikalu līmeņa mērķus vēlāk.
              </p>
              
              <div className="grid gap-4 md:grid-cols-2">
                <Card 
                  className={`cursor-pointer transition-all hover:border-primary ${
                    setupScope === "company" ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setSetupScope("company")}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Uzņēmuma Līmenis</h4>
                        <p className="text-sm text-muted-foreground">
                          Vienoti KPI visam uzņēmumam
                        </p>
                      </div>
                      {setupScope === "company" && (
                        <Check className="h-5 w-5 text-primary ml-auto" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all hover:border-primary ${
                    setupScope === "both" ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setSetupScope("both")}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-chart-3/10 flex items-center justify-center">
                        <Store className="h-6 w-6 text-chart-3" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Uzņēmums + Veikali</h4>
                        <p className="text-sm text-muted-foreground">
                          Atsevišķi mērķi katram veikalam
                        </p>
                      </div>
                      {setupScope === "both" && (
                        <Check className="h-5 w-5 text-primary ml-auto" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Iestatiet KPI Mērķus</h3>
              <p className="text-muted-foreground mb-6">
                Definējiet mērķa vērtības un brīdinājumu sliekšņus katram KPI.
              </p>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {KPI_CATEGORIES.map(category => {
                  const categoryKPIs = kpiTargets.filter(kpi => kpi.kpi_category === category.id);
                  if (categoryKPIs.length === 0) return null;
                  
                  const Icon = category.icon;
                  
                  return (
                    <Card key={category.id} className="border-muted">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-5 w-5 ${category.color}`} />
                          <CardTitle className="text-base">{category.name}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {categoryKPIs.map(kpi => (
                          <div key={kpi.kpi_name} className="grid gap-4 md:grid-cols-3 items-end">
                            <div>
                              <Label className="text-sm font-medium">
                                {KPI_LABELS[kpi.kpi_name] || kpi.kpi_name}
                              </Label>
                              <p className="text-xs text-muted-foreground">Mērķis ({kpi.unit})</p>
                            </div>
                            <div>
                              <Label className="text-xs">Mērķa vērtība</Label>
                              <Input
                                type="number"
                                value={kpi.target_value}
                                onChange={(e) => updateKPIValue(kpi.kpi_name, "target_value", parseFloat(e.target.value) || 0)}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Brīdinājuma slieksnis</Label>
                              <Input
                                type="number"
                                value={kpi.warning_threshold || ""}
                                onChange={(e) => updateKPIValue(kpi.kpi_name, "warning_threshold", parseFloat(e.target.value) || 0)}
                                className="mt-1"
                                placeholder="Neobligāti"
                              />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 text-center py-8">
              <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <Check className="h-10 w-10 text-success" />
              </div>
              <h3 className="text-2xl font-semibold">Gatavs Sākt!</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Jūsu KPI mērķi ir iestatīti. RetailAI tagad izsekos jūsu veiktspēju un sniegs 
                AI vadītās rekomendācijas, lai palīdzētu jums sasniegt savus mērķus.
              </p>
              
              <div className="grid gap-3 max-w-sm mx-auto mt-8">
                {kpiTargets.slice(0, 4).map(kpi => (
                  <div key={kpi.kpi_name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">{KPI_LABELS[kpi.kpi_name]}</span>
                    <span className="font-semibold">{kpi.target_value}{kpi.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>

        <div className="px-6 py-4 border-t flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || loading}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Atpakaļ
          </Button>

          {step < totalSteps - 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              className="gap-2"
            >
              Turpināt
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={loading}
              className="gap-2 bg-success hover:bg-success/90"
            >
              {loading ? "Saglabā..." : "Pabeigt Iestatīšanu"}
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};
