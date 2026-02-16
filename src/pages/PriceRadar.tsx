import { useState, useEffect, useMemo, Fragment, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, Search, Download, FileSpreadsheet, FileText,
  TrendingDown, TrendingUp, AlertTriangle, Shield, Target, BarChart3,
  ChevronDown, ChevronUp, Info, ExternalLink,
  Play, Brain, Trash2, RefreshCw, Plus, Link2, Minus, Radar
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { AddCompetitorDialog } from "@/components/AddCompetitorDialog";
import { CompetitorMappingTab } from "@/components/CompetitorMappingTab";
import { CompetitorPromotionsTab } from "@/components/CompetitorPromotionsTab";
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

// --- Types ---

interface PriceRadarProduct {
  name: string;
  brand: string;
  category: string;
  myPrice: number;
  myIndex: number | null;
  minPrice: number | null;
  avgPrice: number | null;
  cheapestSite: string | null;
  competitors: Record<string, { price: number }>;
  pos: "cheaper" | "equal" | "expensive" | null;
}

interface Competitor {
  id: string;
  name: string;
  website_url: string | null;
  scraping_url: string | null;
  type: string | null;
  country: string | null;
  last_catalog_scrape: string | null;
  last_promo_scrape: string | null;
}

interface MappingStats {
  total: number;
  matched: number;
  pending: number;
}

// --- Design System Constants ---

const COLORS = {
  cheaper: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", fill: "#10b981", light: "#d1fae5" },
  equal: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", fill: "#f59e0b", light: "#fef3c7" },
  expensive: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", fill: "#ef4444", light: "#fee2e2" },
  neutral: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", fill: "#64748b", light: "#f1f5f9" },
};

const POS_LABELS: Record<string, string> = {
  cheaper: "Lētāks",
  equal: "Vienāds",
  expensive: "Dārgāks",
};

const COMPS = ["barbora.lv", "rimi.lv", "alkoutlet.lv", "superalko.lv", "vynoteka.lv"];
const COMP_LABELS: Record<string, string> = {
  "barbora.lv": "Barbora",
  "rimi.lv": "Rimi",
  "alkoutlet.lv": "AlkOutlet",
  "superalko.lv": "SuperAlko",
  "vynoteka.lv": "Vynoteka",
};

// --- Helpers ---

function getPos(myPrice: number, competitors: Record<string, { price: number }>): "cheaper" | "equal" | "expensive" | null {
  const prices = COMPS.map(c => competitors[c]?.price).filter(Boolean) as number[];
  if (!prices.length) return null;
  if (prices.some(v => v < myPrice - 0.005)) return "expensive";
  if (prices.some(v => Math.abs(v - myPrice) < 0.01)) return "equal";
  return "cheaper";
}

function cellColor(compPrice: number | undefined, myPrice: number): string {
  if (!compPrice) return "";
  if (compPrice > myPrice + 0.005) return "bg-emerald-50/70";
  if (compPrice < myPrice - 0.005) return "bg-rose-50/70";
  return "bg-amber-50/70";
}

function diffPercent(compPrice: number | undefined, myPrice: number): string | null {
  if (!compPrice || !myPrice) return null;
  return ((compPrice - myPrice) / myPrice * 100).toFixed(1);
}

function indexColor(idx: number | null): string {
  if (!idx) return "text-slate-400";
  if (idx <= 95) return "text-emerald-600 font-bold";
  if (idx <= 105) return "text-amber-600 font-semibold";
  return "text-rose-600 font-bold";
}

function indexBg(idx: number | null): string {
  if (!idx) return "";
  if (idx <= 95) return "bg-emerald-50";
  if (idx <= 105) return "bg-amber-50";
  return "bg-rose-50";
}

// --- Component ---

const PriceRadar = () => {
  const { toast } = useToast();
  const tableRef = useRef<HTMLDivElement>(null);

  // Price monitoring state
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<PriceRadarProduct[]>([]);
  const [cat, setCat] = useState("Visas");
  const [pos, setPos] = useState("Visi");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ col: string | null; dir: "asc" | "desc" }>({ col: null, dir: "asc" });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showCharts, setShowCharts] = useState(true);

  // Competitors management state
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [scraping, setScraping] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);
  const [mappingStats, setMappingStats] = useState<MappingStats>({ total: 0, matched: 0, pending: 0 });
  const [productStats, setProductStats] = useState({ total: 0, linked: 0 });

  // Load all data
  useEffect(() => {
    loadPriceData();
    fetchCompetitors();
    fetchStats();
  }, []);

  // ========== PRICE MONITORING DATA ==========

  const loadPriceData = async () => {
    setLoading(true);
    try {
      const { data: compList } = await supabase.from("competitors").select("id, name, website_url");
      const compIdToDomain = new Map<string, string>();
      compList?.forEach(c => {
        const domain = c.website_url?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || c.name.toLowerCase();
        compIdToDomain.set(c.id, domain);
      });

      const { data: mappings, error: mappingError } = await supabase
        .from("competitor_product_mapping")
        .select("our_product_id, competitor_product_sku, competitor_id, competitor_product_name, competitor_brand, competitor_size")
        .in("mapping_status", ["auto_matched", "approved"]);
      if (mappingError) throw mappingError;

      const compSkus = [...new Set((mappings || []).map(m => m.competitor_product_sku).filter(Boolean))];
      // Batch .in() queries to avoid URL length limit (PostgREST 400 error with 400+ UUIDs)
      const BATCH_IN = 200;
      let allCompProducts: any[] = [];
      for (let i = 0; i < compSkus.length; i += BATCH_IN) {
        const batch = compSkus.slice(i, i + BATCH_IN);
        const { data } = await supabase.from("competitor_products").select("id, competitor_sku, competitor_id").in("competitor_sku", batch);
        if (data) allCompProducts.push(...data);
      }
      const compProducts = allCompProducts.length > 0 ? allCompProducts : null;

      const allCompProdIds = compProducts?.map(cp => cp.id) || [];
      let allPriceHistory: any[] = [];
      for (let i = 0; i < allCompProdIds.length; i += BATCH_IN) {
        const batch = allCompProdIds.slice(i, i + BATCH_IN);
        const { data } = await supabase.from("competitor_price_history").select("competitor_product_id, price, date").in("competitor_product_id", batch).order("date", { ascending: false });
        if (data) allPriceHistory.push(...data);
      }
      const priceHistory = allPriceHistory.length > 0 ? allPriceHistory : null;

      const latestPriceMap = new Map<string, number>();
      priceHistory?.forEach(ph => {
        if (!latestPriceMap.has(ph.competitor_product_id) && ph.price) {
          latestPriceMap.set(ph.competitor_product_id, Number(ph.price));
        }
      });

      const ourProductIds = [...new Set((mappings || []).map(m => m.our_product_id).filter(Boolean))];
      let allOurProducts: any[] = [];
      const pageSize = 1000;
      for (let i = 0; i < ourProductIds.length; i += pageSize) {
        const batch = ourProductIds.slice(i, i + pageSize);
        const { data: prods } = await supabase.from("products").select("id, name, sku, current_price, brand, category_id").in("id", batch);
        if (prods) allOurProducts.push(...prods);
      }

      const { data: categories } = await supabase.from("categories").select("id, name");
      const catMap = new Map(categories?.map(c => [c.id, c.name]) || []);
      const ourProductMap = new Map(allOurProducts.map(p => [p.id, p]));

      const productCompPrices = new Map<string, Record<string, { price: number }>>();
      (mappings || []).forEach(m => {
        if (!m.our_product_id || !m.competitor_id) return;
        const domain = compIdToDomain.get(m.competitor_id);
        if (!domain) return;

        const matchingCpId = compProducts?.find(
          cp => cp.competitor_sku === m.competitor_product_sku && cp.competitor_id === m.competitor_id
        )?.id;

        if (matchingCpId) {
          const price = latestPriceMap.get(matchingCpId);
          if (price && price > 0) {
            const existing = productCompPrices.get(m.our_product_id) || {};
            if (!existing[domain]) {
              existing[domain] = { price };
              productCompPrices.set(m.our_product_id, existing);
            }
          }
        }
      });

      const result: PriceRadarProduct[] = [];
      productCompPrices.forEach((competitors, productId) => {
        const ourProd = ourProductMap.get(productId);
        if (!ourProd || !ourProd.current_price) return;
        const myPrice = Number(ourProd.current_price);
        const compPriceValues = Object.values(competitors).map(c => c.price);
        const avgPrice = compPriceValues.length > 0 ? compPriceValues.reduce((a, b) => a + b, 0) / compPriceValues.length : null;
        const minPrice = compPriceValues.length > 0 ? Math.min(...compPriceValues) : null;
        const myIndex = minPrice ? (myPrice / minPrice) * 100 : null;
        const cheapestDomain = compPriceValues.length > 0
          ? Object.entries(competitors).reduce((best, [domain, { price }]) => price < (best.price ?? Infinity) ? { domain, price } : best, { domain: "spiritsandwine.lv", price: myPrice }).domain
          : null;
        const isOurCheapest = minPrice !== null && myPrice <= minPrice + 0.005;

        result.push({
          name: ourProd.name || "", brand: ourProd.brand || "",
          category: catMap.get(ourProd.category_id) || "Nav kategorijas",
          myPrice, myIndex: myIndex ? Math.round(myIndex * 100) / 100 : null,
          minPrice: isOurCheapest ? myPrice : minPrice,
          avgPrice: avgPrice ? Math.round(avgPrice * 100) / 100 : null,
          cheapestSite: isOurCheapest ? "spiritsandwine.lv" : cheapestDomain,
          competitors, pos: getPos(myPrice, competitors),
        });
      });

      result.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      setProducts(result);
    } catch (err: any) {
      console.error("Error loading price data:", err);
      toast({ title: "Kļūda", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ========== COMPETITORS MANAGEMENT ==========

  const fetchCompetitors = async () => {
    try {
      const { data, error } = await supabase
        .from("competitors")
        .select("*")
        .order("name");
      if (error) throw error;
      setCompetitors(data || []);
    } catch (error: any) {
      console.error("Error fetching competitors:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: mappingsData } = await supabase
        .from("competitor_product_mapping")
        .select("mapping_status");

      if (mappingsData) {
        setMappingStats({
          total: mappingsData.length,
          matched: mappingsData.filter(m => m.mapping_status === 'auto_matched' || m.mapping_status === 'approved').length,
          pending: mappingsData.filter(m => m.mapping_status === 'pending').length,
        });
      }

      const { data: compProds } = await supabase
        .from("competitor_products")
        .select("id");

      if (compProds) {
        setProductStats({ total: compProds.length, linked: compProds.length });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleScrape = async (competitor: Competitor) => {
    const url = competitor.scraping_url || competitor.website_url;
    if (!url) {
      toast({ title: "Kļūda", description: "Nav norādīta mājaslapas adrese", variant: "destructive" });
      return;
    }
    setScraping(competitor.id);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-competitor-ai', {
        body: { url, competitor_id: competitor.id, use_ai: true },
      });
      if (error) throw error;
      toast({
        title: data.products?.length > 0 ? "Veiksmīgi" : "Informācija",
        description: data.products?.length > 0
          ? `Izvilkti ${data.products.length} produkti no ${competitor.name}`
          : data.message || "Produkti netika atrasti.",
      });
      fetchCompetitors();
      fetchStats();
    } catch (error: any) {
      toast({ title: "Kļūda", description: error.message || "Neizdevās scrapot konkurentu", variant: "destructive" });
    } finally {
      setScraping(null);
    }
  };

  const handleAIMatch = async (competitorId?: string) => {
    setMatching(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-match-products', {
        body: { mode: 'auto', competitor_id: competitorId },
      });
      if (error) throw error;
      toast({
        title: "AI Matching Pabeigts",
        description: data.message || `Savienoti ${data.matched_mappings || 0} produkti`,
      });
      fetchStats();
    } catch (error: any) {
      toast({ title: "Kļūda", description: error.message || "AI matching neizdevās", variant: "destructive" });
    } finally {
      setMatching(false);
    }
  };

  const handleDeleteCompetitor = async (id: string) => {
    try {
      const { error } = await supabase.from("competitors").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Dzēsts", description: "Konkurents dzēsts" });
      fetchCompetitors();
      fetchStats();
    } catch (error: any) {
      toast({ title: "Kļūda", description: error.message, variant: "destructive" });
    }
  };

  // ========== DERIVED DATA ==========

  const cats = useMemo(() => ["Visas", ...[...new Set(products.map(p => p.category))].sort()], [products]);

  const filtered = useMemo(() => {
    let r = products;
    if (cat !== "Visas") r = r.filter(p => p.category === cat);
    if (pos !== "Visi") r = r.filter(p => p.pos === pos);
    if (q) { const s = q.toLowerCase(); r = r.filter(p => p.name.toLowerCase().includes(s) || p.brand?.toLowerCase().includes(s)); }
    if (sort.col) {
      r = [...r].sort((a, b) => {
        let va: any, vb: any;
        if (sort.col === "name") { va = a.name; vb = b.name; }
        else if (sort.col === "my_price") { va = a.myPrice || 0; vb = b.myPrice || 0; }
        else if (sort.col === "index") { va = a.myIndex || 999; vb = b.myIndex || 999; }
        else { va = a.competitors[sort.col!]?.price || 999; vb = b.competitors[sort.col!]?.price || 999; }
        if (typeof va === "string") return sort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
        return sort.dir === "asc" ? va - vb : vb - va;
      });
    }
    return r;
  }, [products, cat, pos, q, sort]);

  const stats = useMemo(() => {
    const s = cat === "Visas" ? products : products.filter(p => p.category === cat);
    const withPos = s.filter(p => p.pos);
    const cheaper = withPos.filter(p => p.pos === "cheaper");
    const equal = withPos.filter(p => p.pos === "equal");
    const expensive = withPos.filter(p => p.pos === "expensive");
    const withIndex = s.filter(p => p.myIndex);
    const avgIndex = withIndex.length > 0 ? withIndex.reduce((sum, p) => sum + (p.myIndex || 0), 0) / withIndex.length : 0;
    const critical = s.filter(p => p.pos === "expensive" && p.minPrice && p.myPrice && ((p.myPrice - p.minPrice) / p.minPrice) > 0.30);
    const potentialSavings = expensive.reduce((sum, p) => {
      if (p.minPrice && p.myPrice > p.minPrice) return sum + (p.myPrice - p.minPrice);
      return sum;
    }, 0);
    return {
      total: s.length, cheaper: cheaper.length, equal: equal.length, expensive: expensive.length,
      cheaperPct: withPos.length > 0 ? (cheaper.length / withPos.length * 100) : 0,
      expensivePct: withPos.length > 0 ? (expensive.length / withPos.length * 100) : 0,
      avgIndex: Math.round(avgIndex), critical: critical.length,
      potentialSavings: Math.round(potentialSavings * 100) / 100,
    };
  }, [products, cat]);

  const top10Overpriced = useMemo(() => {
    return products
      .filter(p => p.pos === "expensive" && p.minPrice && p.myPrice)
      .map(p => ({
        name: p.name.length > 30 ? p.name.slice(0, 28) + "..." : p.name,
        fullName: p.name,
        diff: p.minPrice ? ((p.myPrice - p.minPrice) / p.minPrice * 100) : 0,
        diffEur: p.minPrice ? (p.myPrice - p.minPrice) : 0,
      }))
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 10);
  }, [products]);

  const donutData = useMemo(() => [
    { name: "Lētāks", value: stats.cheaper, color: COLORS.cheaper.fill },
    { name: "Vienāds", value: stats.equal, color: COLORS.equal.fill },
    { name: "Dārgāks", value: stats.expensive, color: COLORS.expensive.fill },
  ], [stats]);

  const doSort = (c: string) => setSort(s => s.col === c ? { col: c, dir: s.dir === "asc" ? "desc" : "asc" } : { col: c, dir: "asc" });
  const SortIcon = ({ c }: { c: string }) => sort.col === c
    ? <span className="text-[10px] ml-0.5">{sort.dir === "asc" ? "▲" : "▼"}</span>
    : <span className="opacity-30 text-[9px] ml-0.5">↕</span>;

  // ========== EXPORT FUNCTIONS ==========

  const exportCSV = () => {
    const rows = filtered.map(p => ({
      "Produkts": p.name, "Zīmols": p.brand, "Kategorija": p.category,
      "S&W Cena": p.myPrice.toFixed(2), "Pozīcija": p.pos ? POS_LABELS[p.pos] : "",
      ...Object.fromEntries(COMPS.map(c => [COMP_LABELS[c], p.competitors[c]?.price?.toFixed(2) || ""])),
      "Cenu Indekss": p.myIndex?.toFixed(0) || "",
      "Min. tirgū": p.minPrice?.toFixed(2) || "", "Vid. tirgū": p.avgPrice?.toFixed(2) || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PriceRadar");
    XLSX.writeFile(wb, `PriceRadar_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Eksportēts", description: `${filtered.length} produkti eksportēti uz Excel` });
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("PriceRadar — Cenu Monitorings", 14, 13);
    doc.setFontSize(9);
    doc.text(`Spirits & Wine  |  ${new Date().toLocaleDateString("lv-LV")}  |  ${filtered.length} produkti  |  ${COMPS.length} konkurenti`, 14, 22);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    const y0 = 36;
    doc.text(`Kopā: ${stats.total}`, 14, y0);
    doc.setTextColor(16, 185, 129); doc.text(`Lētāks: ${stats.cheaper}`, 55, y0);
    doc.setTextColor(245, 158, 11); doc.text(`Vienāds: ${stats.equal}`, 100, y0);
    doc.setTextColor(239, 68, 68); doc.text(`Dārgāks: ${stats.expensive}`, 145, y0);
    doc.setTextColor(0, 0, 0);
    doc.text(`Vid. indekss: ${stats.avgIndex}`, 195, y0);
    if (cat !== "Visas") doc.text(`Kategorija: ${cat}`, 245, y0);

    const headers = ["Produkts", "S&W €", "Pozīcija", ...COMPS.map(c => COMP_LABELS[c]), "Indekss"];
    const rows = filtered.map(p => [
      p.name.length > 40 ? p.name.slice(0, 38) + ".." : p.name,
      p.myPrice.toFixed(2),
      p.pos ? POS_LABELS[p.pos] : "—",
      ...COMPS.map(c => p.competitors[c]?.price?.toFixed(2) || "—"),
      p.myIndex?.toFixed(0) || "—",
    ]);

    autoTable(doc, {
      head: [headers], body: rows, startY: 42,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 65 }, 1: { halign: "center", cellWidth: 18 }, 2: { halign: "center", cellWidth: 18 } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          const val = String(data.cell.raw);
          if (val === "Dārgāks") { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = "bold"; }
          else if (val === "Lētāks") { data.cell.styles.textColor = [16, 185, 129]; data.cell.styles.fontStyle = "bold"; }
        }
        if (data.section === "body" && data.column.index === headers.length - 1) {
          const idx = Number(data.cell.raw);
          if (idx > 105) { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = "bold"; }
          else if (idx <= 95) { data.cell.styles.textColor = [16, 185, 129]; data.cell.styles.fontStyle = "bold"; }
        }
      },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`RetailRadar AI — PriceRadar  |  Lapa ${i}/${pageCount}`, 14, 200);
      doc.text(new Date().toLocaleString("lv-LV"), 250, 200);
    }
    doc.save(`PriceRadar_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: "Eksportēts", description: "PDF fails saglabāts" });
  };

  // ========== RENDER ==========

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Ielādē PriceRadar datus...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Radar className="h-7 w-7 text-primary" />
            PriceRadar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Konkurentu cenu monitorings, analīze un pārvaldība</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">{new Date().toLocaleDateString("lv-LV")}</Badge>
          <Badge variant="outline" className="text-xs">{products.length} produkti</Badge>
          <Badge variant="outline" className="text-xs">{competitors.length} konkurenti</Badge>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="prices" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="prices" className="text-xs sm:text-sm">
            Cenu Monitorings ({products.length})
          </TabsTrigger>
          <TabsTrigger value="competitors" className="text-xs sm:text-sm">
            Konkurenti ({competitors.length})
          </TabsTrigger>
          <TabsTrigger value="mappings" className="text-xs sm:text-sm">
            Savienojumi ({mappingStats.total})
          </TabsTrigger>
          <TabsTrigger value="promotions" className="text-xs sm:text-sm">
            Akcijas
          </TabsTrigger>
        </TabsList>

        {/* ========== TAB 1: CENU MONITORINGS ========== */}
        <TabsContent value="prices" className="space-y-4">
          {/* Export buttons */}
          <div className="flex justify-end gap-1">
            <Button variant="outline" size="sm" onClick={exportCSV} className="h-8 text-xs gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF} className="h-8 text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
          </div>

          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="relative overflow-hidden border-l-4 border-l-primary">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardHeader className="pb-1 p-3 sm:p-4">
                <CardTitle className="text-[11px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Vidējais cenu indekss
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <div className={`text-2xl sm:text-3xl font-bold ${stats.avgIndex > 105 ? "text-rose-600" : stats.avgIndex < 95 ? "text-emerald-600" : "text-amber-600"}`}>
                  {stats.avgIndex}
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  {stats.avgIndex > 100 ? `${stats.avgIndex - 100}% virs zemākās cenas` : stats.avgIndex < 100 ? `${100 - stats.avgIndex}% zem zemākās cenas` : "Zemākā cena tirgū"}
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-l-4 border-l-emerald-500">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardHeader className="pb-1 p-3 sm:p-4">
                <CardTitle className="text-[11px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Konkurētspējīgi
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <div className="text-2xl sm:text-3xl font-bold text-emerald-600">
                  {stats.cheaper + stats.equal}
                  <span className="text-sm sm:text-base font-normal text-muted-foreground ml-1">/ {stats.total}</span>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  {stats.total > 0 ? ((stats.cheaper + stats.equal) / stats.total * 100).toFixed(0) : 0}% sortimenta ir konkurētspējīgi
                </p>
              </CardContent>
            </Card>

            <Card className={`relative overflow-hidden border-l-4 ${stats.critical > 0 ? "border-l-rose-500" : "border-l-slate-300"}`}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-rose-500/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardHeader className="pb-1 p-3 sm:p-4">
                <CardTitle className="text-[11px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Kritiski dārgi (&gt;30%)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <div className={`text-2xl sm:text-3xl font-bold ${stats.critical > 0 ? "text-rose-600" : "text-slate-400"}`}>
                  {stats.critical}
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  {stats.critical > 0 ? "Produkti ar cenu pārmaksu virs 30%" : "Nav kritisku produktu"}
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-l-4 border-l-amber-500">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-500/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardHeader className="pb-1 p-3 sm:p-4">
                <CardTitle className="text-[11px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" /> Kopējā pārmaksa
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <div className="text-2xl sm:text-3xl font-bold text-amber-600">
                  {stats.potentialSavings.toFixed(0)}
                  <span className="text-sm sm:text-base font-normal text-muted-foreground ml-1">€</span>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  Summa par kuru mēs dārgāki par min. tirgus cenu
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          {showCharts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2 p-4">
                  <CardTitle className="text-sm font-semibold">Cenu pozīcijas sadalījums</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center gap-4">
                    <div className="w-40 h-40 sm:w-48 sm:h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={donutData} cx="50%" cy="50%" innerRadius="55%" outerRadius="85%" paddingAngle={3} dataKey="value" stroke="none">
                            {donutData.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`${value} produkti`, ""]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-3">
                      {donutData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                          <div>
                            <div className="text-sm font-semibold">{d.value} <span className="font-normal text-muted-foreground">({stats.total > 0 ? (d.value / stats.total * 100).toFixed(0) : 0}%)</span></div>
                            <div className="text-xs text-muted-foreground">{d.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 p-4">
                  <CardTitle className="text-sm font-semibold">Top 10 visdārgākie vs tirgus</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {top10Overpriced.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={top10Overpriced} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `+${v}%`} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 9 }} />
                        <Tooltip
                          formatter={(value: number) => [`+${value.toFixed(1)}%`, "Pārmaksa"]}
                          labelFormatter={(label) => {
                            const item = top10Overpriced.find(p => p.name === label);
                            return item?.fullName || label;
                          }}
                        />
                        <Bar dataKey="diff" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                      Nav dārgāku produktu — lielisks rezultāts!
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filter Position Cards + Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {[
                { k: "Visi", label: "Kopā", val: stats.total, icon: null, cls: COLORS.neutral },
                { k: "cheaper", label: "Lētāks", val: stats.cheaper, icon: <TrendingDown className="h-3 w-3" />, cls: COLORS.cheaper },
                { k: "equal", label: "Vienāds", val: stats.equal, icon: null, cls: COLORS.equal },
                { k: "expensive", label: "Dārgāks", val: stats.expensive, icon: <TrendingUp className="h-3 w-3" />, cls: COLORS.expensive },
              ].map(s => (
                <button
                  key={s.k}
                  onClick={() => setPos(pos === s.k ? "Visi" : s.k)}
                  className={`rounded-lg px-3 py-2 text-left border transition-all cursor-pointer min-w-[90px] ${s.cls.bg} ${s.cls.text} ${pos === s.k ? `ring-2 ring-offset-1 shadow-sm ${s.cls.border} border-current` : `${s.cls.border} border-transparent hover:border-current`}`}
                >
                  <div className="text-xl sm:text-2xl font-bold">{s.val}</div>
                  <div className="text-[10px] sm:text-[11px] font-medium flex items-center gap-1">{s.icon}{s.label}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Meklēt produktu..." className="pl-8 h-8 text-xs w-44" />
              </div>
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{cats.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => setShowCharts(!showCharts)}>
                {showCharts ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showCharts ? "Slēpt" : "Grafiki"}
              </Button>
              <span className="text-xs text-muted-foreground">Rādīti: {filtered.length}</span>
            </div>
          </div>

          {/* Price Comparison Table */}
          <div ref={tableRef} className="overflow-x-auto">
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-3 py-2.5 text-left font-semibold cursor-pointer select-none whitespace-nowrap" onClick={() => doSort("name")}>
                      Produkts<SortIcon c="name" />
                    </th>
                    <th className="px-2 py-2.5 text-center font-semibold cursor-pointer select-none w-20" onClick={() => doSort("my_price")}>
                      S&W €<SortIcon c="my_price" />
                    </th>
                    <th className="px-2 py-2.5 text-center font-semibold w-20">Pozīcija</th>
                    {COMPS.map(c => (
                      <th key={c} className="px-1.5 py-2.5 text-center font-semibold cursor-pointer select-none whitespace-nowrap w-[80px]" onClick={() => doSort(c)}>
                        {COMP_LABELS[c]}<SortIcon c={c} />
                      </th>
                    ))}
                    <th className="px-2 py-2.5 text-center font-semibold cursor-pointer select-none w-16" onClick={() => doSort("index")}>
                      <span className="flex items-center justify-center gap-1">Indekss<SortIcon c="index" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={3 + COMPS.length + 1} className="text-center py-12 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Nav produktu atbilstošu filtriem
                    </td></tr>
                  )}
                  {filtered.map((p, i) => {
                    const isExp = expanded === i;
                    return (
                      <Fragment key={i}>
                        <tr
                          onClick={() => setExpanded(isExp ? null : i)}
                          className={`border-b border-slate-100 cursor-pointer transition-colors hover:bg-blue-50/50 ${i % 2 ? "bg-slate-50/30" : "bg-white"}`}
                        >
                          <td className="px-3 py-2 font-medium max-w-[280px]">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 font-normal">{p.category}</Badge>
                              <span className="truncate">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center font-bold text-slate-800">€{p.myPrice.toFixed(2)}</td>
                          <td className="px-1.5 py-1.5 text-center">
                            {p.pos ? (
                              <Badge className={`text-[10px] font-semibold border ${COLORS[p.pos].bg} ${COLORS[p.pos].text} ${COLORS[p.pos].border} hover:opacity-80`}>
                                {POS_LABELS[p.pos]}
                              </Badge>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          {COMPS.map(c => {
                            const cp = p.competitors[c]?.price;
                            const d = diffPercent(cp, p.myPrice);
                            return (
                              <td key={c} className={`px-1.5 py-2 text-center ${cellColor(cp, p.myPrice)}`}>
                                {cp ? (
                                  <div>
                                    <span className="font-semibold">€{cp.toFixed(2)}</span>
                                    {d && (
                                      <span className={`text-[9px] block ${Number(d) > 0 ? "text-emerald-600" : Number(d) < 0 ? "text-rose-600" : "text-amber-600"}`}>
                                        {Number(d) > 0 ? "+" : ""}{d}%
                                      </span>
                                    )}
                                  </div>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                            );
                          })}
                          <td className={`px-2 py-2 text-center ${indexColor(p.myIndex)} ${indexBg(p.myIndex)}`}>
                            {p.myIndex ? p.myIndex.toFixed(0) : "—"}
                          </td>
                        </tr>
                        {isExp && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={3 + COMPS.length + 1} className="px-4 py-3">
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-[11px]">
                                <div className="bg-white rounded-lg px-3 py-2 border">
                                  <div className="text-muted-foreground text-[10px]">Zīmols</div>
                                  <div className="font-semibold">{p.brand || "—"}</div>
                                </div>
                                <div className="bg-white rounded-lg px-3 py-2 border">
                                  <div className="text-muted-foreground text-[10px]">Kategorija</div>
                                  <div className="font-semibold">{p.category}</div>
                                </div>
                                <div className="bg-white rounded-lg px-3 py-2 border">
                                  <div className="text-muted-foreground text-[10px]">Min. tirgū</div>
                                  <div className="font-semibold">€{p.minPrice?.toFixed(2) ?? "—"}</div>
                                </div>
                                <div className="bg-white rounded-lg px-3 py-2 border">
                                  <div className="text-muted-foreground text-[10px]">Vid. tirgū</div>
                                  <div className="font-semibold">€{p.avgPrice?.toFixed(2) ?? "—"}</div>
                                </div>
                                <div className="bg-white rounded-lg px-3 py-2 border">
                                  <div className="text-muted-foreground text-[10px]">Lētākais</div>
                                  <div className="font-semibold">{p.cheapestSite ?? "—"}</div>
                                </div>
                                {p.pos === "expensive" && p.minPrice && p.myPrice && (
                                  <div className="bg-rose-50 rounded-lg px-3 py-2 border border-rose-200">
                                    <div className="text-rose-600 text-[10px]">Starpība</div>
                                    <div className="font-bold text-rose-700">
                                      +€{(p.myPrice - p.minPrice).toFixed(2)} ({((p.myPrice - p.minPrice) / p.minPrice * 100).toFixed(1)}%)
                                    </div>
                                  </div>
                                )}
                                {p.pos === "cheaper" && p.minPrice && p.myPrice && (
                                  <div className="bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200">
                                    <div className="text-emerald-600 text-[10px]">Izdevīgāk par</div>
                                    <div className="font-bold text-emerald-700">€{(p.minPrice - p.myPrice).toFixed(2)}</div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 text-[11px] text-muted-foreground flex-wrap px-1">
            <span className="font-medium">Šūnu krāsas:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" /> Konkurents dārgāks (labi mums)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> Vienāda cena
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-100 border border-rose-300 inline-block" /> Konkurents lētāks (uzmanību!)
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5">
              <Info className="h-3 w-3" /> Indekss: 100 = zemākā tirgus cena, &gt;100 = mēs dārgāki
            </span>
          </div>
        </TabsContent>

        {/* ========== TAB 2: KONKURENTI ========== */}
        <TabsContent value="competitors" className="space-y-4">
          {/* Header with actions */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Konkurentu Pārvaldība</h2>
              <p className="text-sm text-muted-foreground">
                Pārvaldiet konkurentus, palaidiet skrēpingu un AI savienošanu
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleAIMatch()}
                disabled={matching}
              >
                {matching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
                AI Savienošana
              </Button>
              <AddCompetitorDialog onCompetitorAdded={() => { fetchCompetitors(); fetchStats(); }} />
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Konkurenti</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{competitors.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {competitors.filter(c => c.website_url).length} ar URL
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Konkurentu Produkti</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{productStats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {productStats.linked} savienoti ar mūsu produktiem
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">AI Savienojumi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{mappingStats.matched}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {mappingStats.pending} gaida apstiprināšanu
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cenu Indekss</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${stats.avgIndex > 102 ? 'text-red-600' : stats.avgIndex < 98 ? 'text-green-600' : 'text-blue-600'}`}>
                  {stats.avgIndex}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">vs tirgus zemākā cena</p>
              </CardContent>
            </Card>
          </div>

          {/* Competitors Table */}
          <Card>
            <CardHeader>
              <CardTitle>Konkurentu Saraksts</CardTitle>
              <CardDescription>Pārvaldiet konkurentus un palaidiet manuālus scrapes</CardDescription>
            </CardHeader>
            <CardContent>
              {competitors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="mb-4">Nav pievienotu konkurentu</p>
                  <AddCompetitorDialog onCompetitorAdded={() => { fetchCompetitors(); fetchStats(); }} />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nosaukums</TableHead>
                      <TableHead>Mājaslapa</TableHead>
                      <TableHead className="text-center">Monitorēti produkti</TableHead>
                      <TableHead>Darbības</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competitors.map((competitor) => (
                      <TableRow key={competitor.id}>
                        <TableCell className="font-medium">{competitor.name}</TableCell>
                        <TableCell>
                          {competitor.website_url ? (
                            <a href={competitor.website_url} target="_blank" rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" />
                              {competitor.website_url.replace(/^https?:\/\//, '')}
                            </a>
                          ) : <span className="text-muted-foreground">N/A</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {products.filter(p =>
                            p.competitors && Object.keys(p.competitors).some(domain => {
                              const compDomain = competitor.website_url?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
                              return domain === compDomain;
                            })
                          ).length}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline"
                              onClick={() => handleScrape(competitor)}
                              disabled={scraping === competitor.id || !competitor.website_url}>
                              {scraping === competitor.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <><Play className="w-4 h-4 mr-1" /> Scrapot</>
                              )}
                            </Button>
                            <Button size="sm" variant="ghost"
                              onClick={() => handleAIMatch(competitor.id)}
                              disabled={matching}>
                              <Link2 className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Dzēst konkurentu?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Vai tiešām vēlaties dzēst {competitor.name}? Šo darbību nevar atsaukt.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Atcelt</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteCompetitor(competitor.id)}>Dzēst</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== TAB 3: SAVIENOJUMI ========== */}
        <TabsContent value="mappings">
          <CompetitorMappingTab competitorId={selectedCompetitorId || competitors[0]?.id} />
        </TabsContent>

        {/* ========== TAB 4: AKCIJAS ========== */}
        <TabsContent value="promotions">
          <CompetitorPromotionsTab competitorId={selectedCompetitorId || competitors[0]?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PriceRadar;
