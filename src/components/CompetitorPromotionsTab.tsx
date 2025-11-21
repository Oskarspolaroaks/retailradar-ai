import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FileUp, Loader2, CheckCircle, XCircle, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Promotion {
  id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  valid_from: string | null;
  valid_to: string | null;
  processed: boolean;
  items_count: number;
  created_at: string;
}

interface CompetitorPromotionsTabProps {
  competitorId: string;
}

export function CompetitorPromotionsTab({ competitorId }: CompetitorPromotionsTabProps) {
  const { toast } = useToast();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<string>("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");

  useEffect(() => {
    loadPromotions();
  }, [competitorId]);

  const loadPromotions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('competitor_promotions')
        .select('*')
        .eq('competitor_id', competitorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotions(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading promotions",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPromotion = async () => {
    if (!title || !sourceUrl) {
      toast({
        title: "Error",
        description: "Please fill in required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('competitor_promotions')
        .insert({
          competitor_id: competitorId,
          title,
          source_type: sourceType,
          source_url: sourceUrl,
          valid_from: validFrom || null,
          valid_to: validTo || null,
          processed: false,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Promotion added successfully",
      });

      setShowAddDialog(false);
      setTitle("");
      setSourceUrl("");
      setValidFrom("");
      setValidTo("");
      loadPromotions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleParsePromotion = async (promotionId: string) => {
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-promotion', {
        body: { promotion_id: promotionId },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Parsed ${data.items_parsed} promotion items`,
      });

      loadPromotions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to parse promotion",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Competitor Promotions</h3>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <FileUp className="w-4 h-4 mr-2" />
              Add Promotion
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Competitor Promotion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Weekly Leaflet - Week 47"
                />
              </div>
              
              <div>
                <Label>Source Type</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Source URL</Label>
                <Input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://example.com/promotions"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valid From</Label>
                  <Input
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Valid To</Label>
                  <Input
                    type="date"
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={handleAddPromotion} className="w-full">
                Add Promotion
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading promotions...</p>
        </Card>
      ) : promotions.length === 0 ? (
        <Card className="p-8 text-center">
          <FileUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">No promotions yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add competitor promotional leaflets to track their pricing campaigns
          </p>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Valid Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.map((promo) => (
              <TableRow key={promo.id}>
                <TableCell className="font-medium">{promo.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{promo.source_type}</Badge>
                </TableCell>
                <TableCell>
                  {promo.valid_from && promo.valid_to ? (
                    <span className="text-sm">
                      {new Date(promo.valid_from).toLocaleDateString()} - {new Date(promo.valid_to).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not set</span>
                  )}
                </TableCell>
                <TableCell>
                  {promo.processed ? (
                    <Badge className="bg-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Processed
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="w-3 h-3 mr-1" />
                      Pending
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{promo.items_count || 0}</TableCell>
                <TableCell>
                  {!promo.processed && (
                    <Button
                      size="sm"
                      onClick={() => handleParsePromotion(promo.id)}
                      disabled={parsing}
                    >
                      {parsing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Parse"
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
