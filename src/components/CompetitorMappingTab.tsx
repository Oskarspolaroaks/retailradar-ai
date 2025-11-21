import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Mapping {
  id: string;
  our_product_id: string;
  competitor_product_name: string;
  competitor_product_url: string | null;
  ai_similarity_score: number;
  mapping_status: string;
  products: {
    name: string;
    sku: string;
  };
}

interface CompetitorMappingTabProps {
  competitorId: string;
}

export function CompetitorMappingTab({ competitorId }: CompetitorMappingTabProps) {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [batching, setBatching] = useState(false);

  useEffect(() => {
    loadMappings();
  }, [competitorId]);

  const loadMappings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('competitor_product_mapping')
        .select(`
          *,
          products (name, sku)
        `)
        .eq('competitor_id', competitorId)
        .order('ai_similarity_score', { ascending: false });

      if (error) throw error;
      setMappings(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading mappings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBatchMatch = async (source: 'catalog' | 'promotions') => {
    setBatching(true);
    try {
      const { data, error } = await supabase.functions.invoke('match-products-batch', {
        body: { competitor_id: competitorId, source },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Created ${data.mappings_created} mappings (${data.auto_matched} auto-matched, ${data.pending_review} pending review)`,
      });

      loadMappings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to batch match products",
        variant: "destructive",
      });
    } finally {
      setBatching(false);
    }
  };

  const handleApprove = async (mappingId: string) => {
    try {
      const { error } = await supabase
        .from('competitor_product_mapping')
        .update({ mapping_status: 'user_approved' })
        .eq('id', mappingId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Mapping approved",
      });

      loadMappings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async (mappingId: string) => {
    try {
      const { error } = await supabase
        .from('competitor_product_mapping')
        .update({ mapping_status: 'rejected' })
        .eq('id', mappingId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Mapping rejected",
      });

      loadMappings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'auto_matched':
        return <Badge className="bg-blue-500">Auto Matched</Badge>;
      case 'user_approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending Review</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.85) return "text-green-600 font-semibold";
    if (score >= 0.70) return "text-blue-600 font-semibold";
    if (score >= 0.60) return "text-yellow-600";
    return "text-gray-600";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Product Mappings</h3>
        <div className="flex gap-2">
          <Button
            onClick={() => handleBatchMatch('catalog')}
            disabled={batching}
            variant="outline"
          >
            {batching ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <LinkIcon className="w-4 h-4 mr-2" />
            )}
            Match from Catalog
          </Button>
          <Button
            onClick={() => handleBatchMatch('promotions')}
            disabled={batching}
          >
            {batching ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <LinkIcon className="w-4 h-4 mr-2" />
            )}
            Match from Promotions
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading mappings...</p>
        </Card>
      ) : mappings.length === 0 ? (
        <Card className="p-8 text-center">
          <LinkIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">No mappings yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Run batch matching to automatically link competitor products to your catalog
          </p>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Our Product</TableHead>
              <TableHead>Competitor Product</TableHead>
              <TableHead>Similarity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((mapping) => (
              <TableRow key={mapping.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{mapping.products.name}</div>
                    <div className="text-sm text-muted-foreground">{mapping.products.sku}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{mapping.competitor_product_name}</div>
                  {mapping.competitor_product_url && (
                    <a
                      href={mapping.competitor_product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  )}
                </TableCell>
                <TableCell>
                  <span className={getScoreColor(mapping.ai_similarity_score)}>
                    {(mapping.ai_similarity_score * 100).toFixed(0)}%
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(mapping.mapping_status)}</TableCell>
                <TableCell>
                  {mapping.mapping_status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprove(mapping.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(mapping.id)}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
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
