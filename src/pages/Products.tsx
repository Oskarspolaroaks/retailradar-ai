import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProductsPaginated } from "@/lib/supabasePaginate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddProductDialog } from "@/components/AddProductDialog";
import { ImportDataDialog } from "@/components/ImportDataDialog";
import { WeeklySalesImportDialog } from "@/components/WeeklySalesImportDialog";
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

interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  cost_price: number;
  current_price: number;
  currency: string;
  status: string;
  abc_category: string | null;
  is_private_label: boolean;
  categories: { name: string } | null;
}

const Products = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [abcFilter, setAbcFilter] = useState<string>("all");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = await fetchProductsPaginated("*, categories(name)");
      // Sort by created_at descending
      data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setProducts(data || []);
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

  const deleteAllProducts = async () => {
    setDeleting(true);
    try {
      // First delete related data
      await supabase.from("sales_daily").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("weekly_sales").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("pricing_recommendations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("product_price_elasticity").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      
      // Delete all products
      const { error } = await supabase
        .from("products")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;

      toast({
        title: "Veiksmīgi izdzēsts",
        description: "Visi produkti un saistītie dati ir dzēsti",
      });
      
      setProducts([]);
    } catch (error: any) {
      toast({
        title: "Kļūda",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const calculateMargin = (costPrice: number, currentPrice: number) => {
    if (!currentPrice || currentPrice === 0) return "0.0";
    return ((currentPrice - costPrice) / currentPrice * 100).toFixed(1);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = 
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesABC = abcFilter === "all" || product.abc_category === abcFilter;
    
    return matchesSearch && matchesABC;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Produkti</h1>
          <p className="text-muted-foreground">
            Pārvaldiet produktu katalogu un cenas
          </p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting || products.length === 0}>
                {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Dzēst Visus
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Dzēst visus produktus?</AlertDialogTitle>
                <AlertDialogDescription>
                  Šī darbība izdzēsīs VISUS {products.length} produktus un saistītos datus (pārdošanas, rekomendācijas). Šo darbību nevar atcelt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Atcelt</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAllProducts} className="bg-destructive text-destructive-foreground">
                  Dzēst Visus
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <WeeklySalesImportDialog onImportComplete={fetchProducts} />
          <ImportDataDialog onImportComplete={fetchProducts} />
          <AddProductDialog onProductAdded={fetchProducts} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Produktu Katalogs</CardTitle>
          <CardDescription>
            {products.length} produkti katalogā
          </CardDescription>
          <div className="flex gap-4 mt-4">
            <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Meklēt produktus pēc nosaukuma, SKU vai zīmola..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            </div>
            <Select value={abcFilter} onValueChange={setAbcFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Visas ABC Kategorijas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Visas Kategorijas</SelectItem>
                <SelectItem value="A">Kategorija A</SelectItem>
                <SelectItem value="B">Kategorija B</SelectItem>
                <SelectItem value="C">Kategorija C</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Ielādē produktus...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Nav atrasti produkti</p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Pievienot Pirmo Produktu
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nosaukums</TableHead>
                    <TableHead>Zīmols</TableHead>
                    <TableHead>Kategorija</TableHead>
                    <TableHead>ABC</TableHead>
                    <TableHead className="text-right">Iepirkuma Cena</TableHead>
                    <TableHead className="text-right">Pārdošanas Cena</TableHead>
                    <TableHead className="text-right">Marža %</TableHead>
                    <TableHead>Statuss</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.brand || "-"}</TableCell>
                      <TableCell>{product.categories?.name || "-"}</TableCell>
                      <TableCell>
                        {product.abc_category ? (
                          <Badge variant={
                            product.abc_category === 'A' ? 'default' : 
                            product.abc_category === 'B' ? 'secondary' : 
                            'outline'
                          }>
                            {product.abc_category}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        € {Number(product.cost_price || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        € {Number(product.current_price || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={Number(calculateMargin(product.cost_price, product.current_price)) > 20 ? "default" : "secondary"}>
                          {calculateMargin(product.cost_price, product.current_price)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.status === "active" ? "default" : "secondary"}>
                          {product.status === "active" ? "Aktīvs" : "Neaktīvs"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Products;
