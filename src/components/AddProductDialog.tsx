import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface AddProductDialogProps {
  onProductAdded?: () => void;
}

interface Category {
  id: string;
  name: string;
}

const productSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(50, "SKU must be less than 50 characters"),
  name: z.string().min(1, "Product name is required").max(200, "Name must be less than 200 characters"),
  brand: z.string().max(100, "Brand must be less than 100 characters").optional(),
  category_id: z.string().optional(),
  cost_price: z.number().positive("Cost price must be positive"),
  current_price: z.number().positive("Current price must be positive"),
  barcode: z.string().max(50, "Barcode must be less than 50 characters").optional(),
  vat_rate: z.number().min(0, "VAT rate cannot be negative").max(100, "VAT rate cannot exceed 100%"),
});

export const AddProductDialog = ({ onProductAdded }: AddProductDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    brand: "",
    category_id: "",
    subcategory: "",
    cost_price: "",
    current_price: "",
    is_private_label: false,
    barcode: "",
    vat_rate: "20",
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("id, name");
    setCategories(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validate form data
    try {
      productSchema.parse({
        sku: formData.sku,
        name: formData.name,
        brand: formData.brand || undefined,
        category_id: formData.category_id || undefined,
        cost_price: parseFloat(formData.cost_price),
        current_price: parseFloat(formData.current_price),
        barcode: formData.barcode || undefined,
        vat_rate: parseFloat(formData.vat_rate),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

    try {
      const { error } = await supabase.from("products").insert([
        {
          sku: formData.sku,
          name: formData.name,
          brand: formData.brand,
          category_id: formData.category_id || null,
          subcategory: formData.subcategory,
          cost_price: parseFloat(formData.cost_price),
          current_price: parseFloat(formData.current_price),
          is_private_label: formData.is_private_label,
          barcode: formData.barcode || null,
          vat_rate: parseFloat(formData.vat_rate) / 100,
          currency: "USD",
          status: "active",
        },
      ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product added successfully",
      });

      setOpen(false);
      setFormData({
        sku: "",
        name: "",
        brand: "",
        category_id: "",
        subcategory: "",
        cost_price: "",
        current_price: "",
        is_private_label: false,
        barcode: "",
        vat_rate: "20",
      });
      onProductAdded?.();
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Enter the details for the new product
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category_id">Kategorija</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Izvēlieties kategoriju" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost_price">Cost Price *</Label>
                <Input
                  id="cost_price"
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="current_price">Selling Price *</Label>
                <Input
                  id="current_price"
                  type="number"
                  step="0.01"
                  value={formData.current_price}
                  onChange={(e) => setFormData({ ...formData, current_price: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode/EAN</Label>
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vat_rate">VAT Rate (%)</Label>
                <Input
                  id="vat_rate"
                  type="number"
                  value={formData.vat_rate}
                  onChange={(e) => setFormData({ ...formData, vat_rate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="private_label"
                checked={formData.is_private_label}
                onCheckedChange={(checked) => setFormData({ ...formData, is_private_label: checked })}
              />
              <Label htmlFor="private_label">Private Label Product</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
