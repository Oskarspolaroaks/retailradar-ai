import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, Link as LinkIcon, Brain, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Mapping {
  id: string;
  our_product_id: string | null;
  competitor_id: string | null;
  competitor_product_name: string;
  competitor_product_url: string | null;
  competitor_brand: string | null;
  competitor_size: string | null;
  ai_similarity_score: number | null;
  mapping_status: string;
  products?: {
    name: string;
    sku: string;
  } | null;
}

interface CompetitorMappingTabProps {
  competitorId?: string;
}

export function CompetitorMappingTab({ competitorId }: CompetitorMappingTabProps) {
  const { toast } = useToast();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadMappings();
  }, [competitorId]);

  const loadMappings = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('competitor_product_mapping')
        .select(`
          *,
          products (name, sku)
        `)
        .order('ai_similarity_score', { ascending: false, nullsFirst: false });

      // Filter by competitor if provided, otherwise load all mappings
      if (competitorId) {
        query = query.eq('competitor_id', competitorId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMappings(data || []);
    } catch (error: any) {
      toast({
        title: "Kļūda ielādējot savienojumus",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAIMatch = async () => {
    setMatching(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-match-products', {
        body: { 
          mode: 'auto',
          competitor_id: competitorId 
        },
      });

      if (error) throw error;

      toast({
        title: "AI Matching Pabeigts",
        description: data.message || `Savienoti ${data.matched_mappings || 0} produkti`,
      });

      loadMappings();
    } catch (error: any) {
      toast({
        title: "Kļūda",
        description: error.message || "AI matching neizdevās",
        variant: "destructive",
      });
    } finally {
      setMatching(false);
    }
  };

  const handleApprove = async (mappingId: string) => {
    try {
      const { error } = await supabase
        .from('competitor_product_mapping')
        .update({ mapping_status: 'approved' })
        .eq('id', mappingId);

      if (error) throw error;

      toast({
        title: "Apstiprināts",
        description: "Savienojums apstiprināts",
      });

      loadMappings();
    } catch (error: any) {
      toast({
        title: "Kļūda",
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
        title: "Noraidīts",
        description: "Savienojums noraidīts",
      });

      loadMappings();
    } catch (error: any) {
      toast({
        title: "Kļūda",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'auto_matched':
        return <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/20">AI Savienots</Badge>;
      case 'approved':
      case 'user_approved':
        return <Badge className="bg-green-500/10 text-green-700 border-green-500/20">Apstiprināts</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Noraidīts</Badge>;
      case 'pending':
        return <Badge variant="secondary">Gaida Pārskatu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 0.85) return "text-green-600 font-semibold";
    if (score >= 0.70) return "text-blue-600 font-semibold";
    if (score >= 0.60) return "text-yellow-600";
    return "text-muted-foreground";
  };

  const filteredMappings = mappings.filter(m => {
    const matchesSearch = !searchQuery || 
      m.competitor_product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.products?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || m.mapping_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: mappings.length,
    matched: mappings.filter(m => m.mapping_status === 'auto_matched' || m.mapping_status === 'approved').length,
    pending: mappings.filter(m => m.mapping_status === 'pending').length,
    rejected: mappings.filter(m => m.mapping_status === 'rejected').length,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Produktu Savienojumi</CardTitle>
            <CardDescription>
              {competitorId
                ? "AI automātiski savieno konkurentu produktus ar jūsu katalogu pēc nosaukuma, zīmola un tilpuma līdzības"
                : `Visi produktu savienojumi no ${new Set(mappings.map(m => m.competitor_id)).size} konkurentiem`}
            </CardDescription>
          </div>
          <Button
            onClick={handleAIMatch}
            disabled={matching}
          >
            {matching ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Brain className="w-4 h-4 mr-2" />
            )}
            Palaist AI Savienošanu
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Kopā</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-500/10">
            <div className="text-2xl font-bold text-green-600">{stats.matched}</div>
            <div className="text-xs text-muted-foreground">Savienoti</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-yellow-500/10">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Gaida</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/10">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-xs text-muted-foreground">Noraidīti</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Meklēt produktus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Visi statusi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Visi statusi</SelectItem>
              <SelectItem value="auto_matched">AI Savienoti</SelectItem>
              <SelectItem value="pending">Gaida pārskatu</SelectItem>
              <SelectItem value="approved">Apstiprināti</SelectItem>
              <SelectItem value="rejected">Noraidīti</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadMappings}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Ielādē savienojumus...</p>
          </div>
        ) : filteredMappings.length === 0 ? (
          <div className="p-8 text-center">
            <LinkIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">Nav savienojumu</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Palaidiet AI savienošanu, lai automātiski savienotu konkurentu produktus ar jūsu katalogu
            </p>
            <Button onClick={handleAIMatch} disabled={matching}>
              <Brain className="w-4 h-4 mr-2" />
              Palaist AI Savienošanu
            </Button>
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mūsu Produkts</TableHead>
                  <TableHead>Konkurenta Produkts</TableHead>
                  <TableHead className="text-center">Līdzība</TableHead>
                  <TableHead className="text-center">Statuss</TableHead>
                  <TableHead className="text-right">Darbības</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell>
                      {mapping.products ? (
                        <div>
                          <div className="font-medium">{mapping.products.name}</div>
                          <div className="text-xs text-muted-foreground">{mapping.products.sku}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Nav savienots</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{mapping.competitor_product_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[mapping.competitor_brand, mapping.competitor_size].filter(Boolean).join(' • ')}
                      </div>
                      {mapping.competitor_product_url && (
                        <a
                          href={mapping.competitor_product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Skatīt
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {mapping.ai_similarity_score ? (
                        <span className={getScoreColor(mapping.ai_similarity_score)}>
                          {(mapping.ai_similarity_score * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(mapping.mapping_status)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(mapping.mapping_status === 'pending' || mapping.mapping_status === 'auto_matched') && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(mapping.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Apstiprināt
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => handleReject(mapping.id)}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
