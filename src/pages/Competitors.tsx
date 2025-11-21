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


const Competitors = () => {
  const { toast } = useToast();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);

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
    </div>
  );
};

export default Competitors;
