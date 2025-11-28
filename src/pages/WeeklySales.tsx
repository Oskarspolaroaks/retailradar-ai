import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";

const WeeklySales = () => {
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [productSearch, setProductSearch] = useState<string>("");

  const { data: weeklySales, isLoading } = useQuery({
    queryKey: ["weekly-sales"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userTenants } = await supabase
        .from("user_tenants")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!userTenants) throw new Error("No tenant found");

      const { data, error } = await supabase
        .from("weekly_sales")
        .select(`
          *,
          products (
            name,
            sku,
            category,
            brand
          )
        `)
        .eq("tenant_id", userTenants.tenant_id)
        .order("week_end", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredSales = weeklySales?.filter((sale) => {
    const matchesPeriod = periodFilter === "all" || sale.period_type === periodFilter;
    const matchesPartner = partnerFilter === "all" || sale.partner === partnerFilter;
    const matchesProduct = !productSearch || 
      sale.product_name.toLowerCase().includes(productSearch.toLowerCase()) ||
      sale.products?.name?.toLowerCase().includes(productSearch.toLowerCase());
    
    return matchesPeriod && matchesPartner && matchesProduct;
  });

  const uniquePartners = [...new Set(weeklySales?.map(s => s.partner) || [])];

  const totalUnits = filteredSales?.reduce((sum, sale) => sum + (sale.units_sold || 0), 0) || 0;
  const totalMargin = filteredSales?.reduce((sum, sale) => sum + (sale.gross_margin || 0), 0) || 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nedēļas Pārdošanas Pārskats</h1>
        <p className="text-muted-foreground mt-2">
          Spirits&Wine importēto datu analīze
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Kopā Pārdots</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUnits.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">vienības</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Bruto Marža</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">kopējā marža</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Produktu Skaits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSales?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">ieraksti</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtri</CardTitle>
          <CardDescription>Filtrēt pārdošanas datus pēc perioda, partnera un produkta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period">Periods</Label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger id="period">
                  <SelectValue placeholder="Izvēlēties periodu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visi periodi</SelectItem>
                  <SelectItem value="LW">Pēdējā Nedēļa (LW)</SelectItem>
                  <SelectItem value="PW">Iepriekšējā Nedēļa (PW)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partner">Partneris</Label>
              <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                <SelectTrigger id="partner">
                  <SelectValue placeholder="Izvēlēties partneri" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Visi partneri</SelectItem>
                  {uniquePartners.map((partner) => (
                    <SelectItem key={partner} value={partner}>
                      {partner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product">Produkts</Label>
              <Input
                id="product"
                placeholder="Meklēt produktu..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pārdošanas Dati</CardTitle>
          <CardDescription>
            {filteredSales?.length || 0} ieraksti atrasti
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Ielādē datus...</div>
          ) : filteredSales && filteredSales.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produkts</TableHead>
                    <TableHead>Partneris</TableHead>
                    <TableHead>Periods</TableHead>
                    <TableHead>Nedēļas Beigas</TableHead>
                    <TableHead className="text-right">Pārdots</TableHead>
                    <TableHead className="text-right">Bruto Marža</TableHead>
                    <TableHead className="text-right">Atlikums</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{sale.product_name}</div>
                          {sale.products?.name && (
                            <div className="text-xs text-muted-foreground">
                              → {sale.products.name} ({sale.products.sku})
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{sale.partner}</TableCell>
                      <TableCell>
                        <Badge variant={sale.period_type === "LW" ? "default" : "secondary"}>
                          {sale.period_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {new Date(sale.week_end).toLocaleDateString('lv-LV')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {sale.units_sold.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        €{sale.gross_margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {sale.stock_end ? sale.stock_end.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell>
                        {sale.mapped ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-700 border-green-500/20">
                            Kartēts
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-yellow-700 border-yellow-500/20">
                            Nav kartēts
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nav atrasti dati. Importējiet Spirits&Wine failu, lai redzētu datus.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WeeklySales;
