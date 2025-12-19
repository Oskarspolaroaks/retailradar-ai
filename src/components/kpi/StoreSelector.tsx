import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Building2 } from "lucide-react";

interface StoreSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

interface StoreData {
  id: string;
  name: string;
  code: string;
  city: string | null;
}

export const StoreSelector = ({ value, onChange }: StoreSelectorProps) => {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const { data, error } = await supabase
          .from("stores")
          .select("id, name, code, city")
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        setStores(data || []);
      } catch (error) {
        console.error("Error fetching stores:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStores();
  }, []);

  return (
    <Select value={value} onValueChange={onChange} disabled={loading}>
      <SelectTrigger className="w-[200px] rounded-xl bg-background">
        <div className="flex items-center gap-2">
          {value === "all" ? (
            <Building2 className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Store className="h-4 w-4 text-muted-foreground" />
          )}
          <SelectValue placeholder="Izvēlieties veikalu" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>Visi veikali</span>
          </div>
        </SelectItem>
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.id}>
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              <span>{store.name}</span>
              {store.city && (
                <span className="text-muted-foreground text-xs">({store.city})</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
