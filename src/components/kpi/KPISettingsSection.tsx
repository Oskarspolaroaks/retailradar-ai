import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Building2, Store, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface KPITarget {
  id: string;
  tenant_id: string;
  scope: string;
  store_id: string | null;
  kpi_name: string;
  kpi_category: string;
  target_value: number;
  warning_threshold: number | null;
  critical_threshold: number | null;
  unit: string | null;
}

interface StoreData {
  id: string;
  name: string;
  code: string;
}

const DEFAULT_KPIS = [
  { name: "revenue_growth", category: "sales", label: "Ieņēmumu Pieaugums", unit: "%", defaultValue: 5 },
  { name: "gross_margin", category: "profitability", label: "Bruto Peļņas Marža", unit: "%", defaultValue: 25 },
  { name: "units_growth", category: "sales", label: "Pārdoto Vienību Pieaugums", unit: "%", defaultValue: 3 },
  { name: "asp_target", category: "sales", label: "Vidējā Pārdošanas Cena", unit: "€", defaultValue: 10 },
  { name: "stock_turnover", category: "operations", label: "Krājumu Apgrozījums", unit: "x", defaultValue: 12 },
  { name: "price_index", category: "pricing", label: "Cenu Indekss vs Tirgus", unit: "%", defaultValue: 100 },
  { name: "promo_dependency", category: "pricing", label: "Promo Atkarība (max)", unit: "%", defaultValue: 30 },
  { name: "a_products_share", category: "assortment", label: "A-Produktu Ieņēmumu Daļa", unit: "%", defaultValue: 70 },
];

export const KPISettingsSection = () => {
  const { toast } = useToast();
  const [companyKPIs, setCompanyKPIs] = useState<KPITarget[]>([]);
  const [storeKPIs, setStoreKPIs] = useState<Record<string, KPITarget[]>>({});
  const [stores, setStores] = useState<StoreData[]>([]);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Get tenant
      const { data: userTenants } = await supabase
        .from("user_tenants")
        .select("tenant_id")
        .limit(1)
        .maybeSingle();

      if (!userTenants?.tenant_id) {
        setIsLoading(false);
        return;
      }

      setTenantId(userTenants.tenant_id);

      // Fetch stores and KPI targets in parallel
      const [storesResult, kpiResult] = await Promise.all([
        supabase
          .from("stores")
          .select("id, name, code")
          .eq("tenant_id", userTenants.tenant_id)
          .eq("is_active", true),
        supabase
          .from("kpi_targets")
          .select("*")
          .eq("tenant_id", userTenants.tenant_id)
      ]);

      if (storesResult.data) {
        setStores(storesResult.data);
        if (storesResult.data.length > 0) {
          setSelectedStore(storesResult.data[0].id);
        }
      }

      if (kpiResult.data) {
        const company = kpiResult.data.filter(k => k.scope === "company");
        const storeTargets: Record<string, KPITarget[]> = {};
        
        kpiResult.data
          .filter(k => k.scope === "store" && k.store_id)
          .forEach(k => {
            if (!storeTargets[k.store_id!]) {
              storeTargets[k.store_id!] = [];
            }
            storeTargets[k.store_id!].push(k);
          });

        setCompanyKPIs(company);
        setStoreKPIs(storeTargets);
      }
    } catch (error) {
      console.error("Error fetching KPI data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getKPIValue = (kpis: KPITarget[], kpiName: string): number => {
    const kpi = kpis.find(k => k.kpi_name === kpiName);
    return kpi?.target_value ?? DEFAULT_KPIS.find(d => d.name === kpiName)?.defaultValue ?? 0;
  };

  const getKPIWarning = (kpis: KPITarget[], kpiName: string): number | null => {
    const kpi = kpis.find(k => k.kpi_name === kpiName);
    return kpi?.warning_threshold ?? null;
  };

  const updateKPIValue = (
    scope: "company" | "store",
    kpiName: string,
    field: "target_value" | "warning_threshold",
    value: number,
    storeId?: string
  ) => {
    if (scope === "company") {
      setCompanyKPIs(prev => {
        const existing = prev.find(k => k.kpi_name === kpiName);
        if (existing) {
          return prev.map(k => 
            k.kpi_name === kpiName ? { ...k, [field]: value } : k
          );
        } else {
          const defaultKpi = DEFAULT_KPIS.find(d => d.name === kpiName);
          return [...prev, {
            id: `new-${kpiName}`,
            tenant_id: tenantId!,
            scope: "company",
            store_id: null,
            kpi_name: kpiName,
            kpi_category: defaultKpi?.category || "sales",
            target_value: field === "target_value" ? value : defaultKpi?.defaultValue || 0,
            warning_threshold: field === "warning_threshold" ? value : null,
            critical_threshold: null,
            unit: defaultKpi?.unit || "%"
          }];
        }
      });
    } else if (storeId) {
      setStoreKPIs(prev => {
        const storeTargets = prev[storeId] || [];
        const existing = storeTargets.find(k => k.kpi_name === kpiName);
        
        if (existing) {
          return {
            ...prev,
            [storeId]: storeTargets.map(k =>
              k.kpi_name === kpiName ? { ...k, [field]: value } : k
            )
          };
        } else {
          const defaultKpi = DEFAULT_KPIS.find(d => d.name === kpiName);
          return {
            ...prev,
            [storeId]: [...storeTargets, {
              id: `new-store-${storeId}-${kpiName}`,
              tenant_id: tenantId!,
              scope: "store",
              store_id: storeId,
              kpi_name: kpiName,
              kpi_category: defaultKpi?.category || "sales",
              target_value: field === "target_value" ? value : defaultKpi?.defaultValue || 0,
              warning_threshold: field === "warning_threshold" ? value : null,
              critical_threshold: null,
              unit: defaultKpi?.unit || "%"
            }]
          };
        }
      });
    }
  };

  const saveKPIs = async (scope: "company" | "store", storeId?: string) => {
    if (!tenantId) return;
    
    setIsSaving(true);
    try {
      const kpisToSave = scope === "company" 
        ? companyKPIs 
        : (storeId ? storeKPIs[storeId] || [] : []);

      // Upsert each KPI
      for (const kpi of kpisToSave) {
        const isNew = kpi.id.startsWith("new-");
        
        if (isNew) {
          const { error } = await supabase
            .from("kpi_targets")
            .insert({
              tenant_id: tenantId,
              scope: kpi.scope,
              store_id: kpi.store_id,
              kpi_name: kpi.kpi_name,
              kpi_category: kpi.kpi_category,
              target_value: kpi.target_value,
              warning_threshold: kpi.warning_threshold,
              critical_threshold: kpi.critical_threshold,
              unit: kpi.unit
            });
          
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("kpi_targets")
            .update({
              target_value: kpi.target_value,
              warning_threshold: kpi.warning_threshold,
              critical_threshold: kpi.critical_threshold
            })
            .eq("id", kpi.id);
          
          if (error) throw error;
        }
      }

      toast({
        title: "Saglabāts",
        description: scope === "company" 
          ? "Uzņēmuma KPI mērķi veiksmīgi saglabāti"
          : "Veikala KPI mērķi veiksmīgi saglabāti"
      });

      // Refresh data
      fetchData();
    } catch (error: any) {
      toast({
        title: "Kļūda",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyCompanyToStore = (storeId: string) => {
    const storeTargets: KPITarget[] = companyKPIs.map(kpi => ({
      ...kpi,
      id: `new-store-${storeId}-${kpi.kpi_name}`,
      scope: "store",
      store_id: storeId
    }));

    setStoreKPIs(prev => ({
      ...prev,
      [storeId]: storeTargets
    }));

    toast({
      title: "Kopēts",
      description: "Uzņēmuma mērķi nokopēti uz veikalu"
    });
  };

  const renderKPIInputs = (
    kpis: KPITarget[],
    scope: "company" | "store",
    storeId?: string
  ) => (
    <div className="space-y-6">
      {/* Sales Performance */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            Pārdošana
          </Badge>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DEFAULT_KPIS.filter(k => k.category === "sales").map(kpiDef => (
            <div key={kpiDef.name} className="space-y-2">
              <Label>{kpiDef.label} ({kpiDef.unit})</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Mērķis"
                  value={getKPIValue(kpis, kpiDef.name)}
                  onChange={(e) => updateKPIValue(
                    scope, 
                    kpiDef.name, 
                    "target_value", 
                    parseFloat(e.target.value) || 0,
                    storeId
                  )}
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Brīdinājums"
                  className="w-24"
                  value={getKPIWarning(kpis, kpiDef.name) ?? ""}
                  onChange={(e) => updateKPIValue(
                    scope,
                    kpiDef.name,
                    "warning_threshold",
                    parseFloat(e.target.value) || 0,
                    storeId
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Profitability */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            Rentabilitāte
          </Badge>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DEFAULT_KPIS.filter(k => k.category === "profitability").map(kpiDef => (
            <div key={kpiDef.name} className="space-y-2">
              <Label>{kpiDef.label} ({kpiDef.unit})</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Mērķis"
                  value={getKPIValue(kpis, kpiDef.name)}
                  onChange={(e) => updateKPIValue(
                    scope,
                    kpiDef.name,
                    "target_value",
                    parseFloat(e.target.value) || 0,
                    storeId
                  )}
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Brīdinājums"
                  className="w-24"
                  value={getKPIWarning(kpis, kpiDef.name) ?? ""}
                  onChange={(e) => updateKPIValue(
                    scope,
                    kpiDef.name,
                    "warning_threshold",
                    parseFloat(e.target.value) || 0,
                    storeId
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Operations */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
            Operācijas
          </Badge>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DEFAULT_KPIS.filter(k => k.category === "operations").map(kpiDef => (
            <div key={kpiDef.name} className="space-y-2">
              <Label>{kpiDef.label} ({kpiDef.unit})</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Mērķis"
                  value={getKPIValue(kpis, kpiDef.name)}
                  onChange={(e) => updateKPIValue(
                    scope,
                    kpiDef.name,
                    "target_value",
                    parseFloat(e.target.value) || 0,
                    storeId
                  )}
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Brīdinājums"
                  className="w-24"
                  value={getKPIWarning(kpis, kpiDef.name) ?? ""}
                  onChange={(e) => updateKPIValue(
                    scope,
                    kpiDef.name,
                    "warning_threshold",
                    parseFloat(e.target.value) || 0,
                    storeId
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing & Assortment */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
            Cenas & Sortiments
          </Badge>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DEFAULT_KPIS.filter(k => k.category === "pricing" || k.category === "assortment").map(kpiDef => (
            <div key={kpiDef.name} className="space-y-2">
              <Label>{kpiDef.label} ({kpiDef.unit})</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Mērķis"
                  value={getKPIValue(kpis, kpiDef.name)}
                  onChange={(e) => updateKPIValue(
                    scope,
                    kpiDef.name,
                    "target_value",
                    parseFloat(e.target.value) || 0,
                    storeId
                  )}
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Brīdinājums"
                  className="w-24"
                  value={getKPIWarning(kpis, kpiDef.name) ?? ""}
                  onChange={(e) => updateKPIValue(
                    scope,
                    kpiDef.name,
                    "warning_threshold",
                    parseFloat(e.target.value) || 0,
                    storeId
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          KPI Mērķi
        </CardTitle>
        <CardDescription>
          Definējiet biznesa mērķus uzņēmuma un veikalu līmenī
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="company" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Uzņēmuma Mērķi
            </TabsTrigger>
            <TabsTrigger value="stores" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Veikalu Mērķi
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="mt-6">
            {renderKPIInputs(companyKPIs, "company")}
            <div className="mt-6 flex justify-end">
              <Button onClick={() => saveKPIs("company")} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saglabā..." : "Saglabāt Uzņēmuma Mērķus"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="stores" className="mt-6">
            {stores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nav pievienotu veikalu. Pievienojiet veikalus, lai definētu individuālus mērķus.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Label>Izvēlieties veikalu:</Label>
                  <Select value={selectedStore || ""} onValueChange={setSelectedStore}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Izvēlieties veikalu" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map(store => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name} ({store.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedStore && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyCompanyToStore(selectedStore)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Kopēt no uzņēmuma
                    </Button>
                  )}
                </div>

                {selectedStore && (
                  <>
                    {renderKPIInputs(
                      storeKPIs[selectedStore] || [],
                      "store",
                      selectedStore
                    )}
                    <div className="mt-6 flex justify-end">
                      <Button 
                        onClick={() => saveKPIs("store", selectedStore)} 
                        disabled={isSaving}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? "Saglabā..." : "Saglabāt Veikala Mērķus"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
