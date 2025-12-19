import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface KPIData {
  totalRevenue: number;
  revenueGrowth: number;
  unitsSold: number;
  unitsChange: number;
  avgSellingPrice: number;
  aspChange: number;
  revenuePerStore: number;
  grossMargin: number;
  marginChange: number;
  grossMarginEur: number;
  skuCount: number;
  aProductsCount: number;
  bProductsCount: number;
  cProductsCount: number;
  aProductsRevenueShare: number;
  avgStockLevel: number;
  stockTurnover: number;
  slowMoversCount: number;
  priceIndexVsMarket: number;
  cheaperThanMarket: number;
  moreExpensiveThanMarket: number;
  promoDependency: number;
}

interface TopProduct {
  id: string;
  name: string;
  revenue: number;
  margin: number;
}

interface StoreData {
  id: string;
  name: string;
  code: string;
  revenue: number;
  growth: number;
}

interface KPIExportButtonProps {
  kpiData: KPIData;
  topProducts: TopProduct[];
  bottomProducts: TopProduct[];
  storeComparison: StoreData[];
  dateRange: string;
}

export const KPIExportButton = ({
  kpiData,
  topProducts,
  bottomProducts,
  storeComparison,
  dateRange,
}: KPIExportButtonProps) => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const generateSummaryText = (): string => {
    const dateLabel = `${dateRange} dienas`;
    const today = new Date().toLocaleDateString("lv-LV", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let summary = `📊 KPI APKOPOJUMS — ${today}\n`;
    summary += `Periods: Pēdējās ${dateLabel}\n`;
    summary += `═══════════════════════════════════════\n\n`;

    // Sales Performance
    summary += `💰 PĀRDOŠANAS VEIKTSPĒJA\n`;
    summary += `─────────────────────────────────────\n`;
    summary += `• Kopējie ieņēmumi: €${kpiData.totalRevenue.toLocaleString("lv-LV", { maximumFractionDigits: 0 })}\n`;
    summary += `• Ieņēmumu izmaiņa: ${kpiData.revenueGrowth >= 0 ? "+" : ""}${kpiData.revenueGrowth.toFixed(1)}%\n`;
    summary += `• Pārdotās vienības: ${kpiData.unitsSold.toLocaleString("lv-LV")}\n`;
    summary += `• Vidējā pārdošanas cena: €${kpiData.avgSellingPrice.toFixed(2)}\n`;
    summary += `• Ieņēmumi uz veikalu: €${kpiData.revenuePerStore.toLocaleString("lv-LV", { maximumFractionDigits: 0 })}\n\n`;

    // Profitability
    summary += `📈 RENTABILITĀTE\n`;
    summary += `─────────────────────────────────────\n`;
    summary += `• Bruto peļņas marža: ${kpiData.grossMargin.toFixed(1)}%\n`;
    summary += `• Maržas izmaiņa: ${kpiData.marginChange >= 0 ? "+" : ""}${kpiData.marginChange.toFixed(1)}%\n`;
    summary += `• Bruto peļņa (EUR): €${kpiData.grossMarginEur.toLocaleString("lv-LV", { maximumFractionDigits: 0 })}\n\n`;

    // Assortment
    summary += `📦 SORTIMENTS\n`;
    summary += `─────────────────────────────────────\n`;
    summary += `• Aktīvie SKU: ${kpiData.skuCount}\n`;
    summary += `• A-produkti: ${kpiData.aProductsCount} (${kpiData.aProductsRevenueShare.toFixed(1)}% ieņēmumu)\n`;
    summary += `• B-produkti: ${kpiData.bProductsCount}\n`;
    summary += `• C-produkti: ${kpiData.cProductsCount}\n\n`;

    // Operations
    summary += `🏭 OPERĀCIJAS\n`;
    summary += `─────────────────────────────────────\n`;
    summary += `• Vidējais krājumu līmenis: ${kpiData.avgStockLevel.toLocaleString("lv-LV")}\n`;
    summary += `• Krājumu apgrozījums: ${kpiData.stockTurnover.toFixed(1)}x\n`;
    summary += `• Lēni produkti: ${kpiData.slowMoversCount}\n\n`;

    // Pricing
    summary += `💲 CENU POZĪCIJA\n`;
    summary += `─────────────────────────────────────\n`;
    summary += `• Cenu indekss vs tirgus: ${kpiData.priceIndexVsMarket.toFixed(1)}%\n`;
    summary += `• Lētāki par tirgu: ${kpiData.cheaperThanMarket}%\n`;
    summary += `• Dārgāki par tirgu: ${kpiData.moreExpensiveThanMarket}%\n`;
    summary += `• Promo atkarība: ${kpiData.promoDependency.toFixed(1)}%\n\n`;

    // Top 5 Products
    if (topProducts.length > 0) {
      summary += `🏆 TOP 5 PRODUKTI (pēc ieņēmumiem)\n`;
      summary += `─────────────────────────────────────\n`;
      topProducts.slice(0, 5).forEach((p, i) => {
        summary += `${i + 1}. ${p.name.substring(0, 40)} — €${p.revenue.toLocaleString("lv-LV", { maximumFractionDigits: 0 })}\n`;
      });
      summary += `\n`;
    }

    // Bottom 5 Products
    if (bottomProducts.length > 0) {
      summary += `⚠️ BOTTOM 5 PRODUKTI\n`;
      summary += `─────────────────────────────────────\n`;
      bottomProducts.slice(0, 5).forEach((p, i) => {
        summary += `${i + 1}. ${p.name.substring(0, 40)} — €${p.revenue.toLocaleString("lv-LV", { maximumFractionDigits: 0 })}\n`;
      });
      summary += `\n`;
    }

    // Store Comparison
    if (storeComparison.length > 0) {
      summary += `🏪 VEIKALU SALĪDZINĀJUMS\n`;
      summary += `─────────────────────────────────────\n`;
      storeComparison.slice(0, 5).forEach((s, i) => {
        summary += `${i + 1}. ${s.name} (${s.code}) — €${s.revenue.toLocaleString("lv-LV", { maximumFractionDigits: 0 })} (${s.growth >= 0 ? "+" : ""}${s.growth.toFixed(1)}%)\n`;
      });
      summary += `\n`;
    }

    summary += `═══════════════════════════════════════\n`;
    summary += `Ģenerēts: ${new Date().toLocaleString("lv-LV")}\n`;
    summary += `RetailAI — Biznesa Inteliģence`;

    return summary;
  };

  const generateCSVData = (): string => {
    let csv = "Kategorija,KPI,Vērtība,Mērvienība,Izmaiņa\n";

    // Sales
    csv += `Pārdošana,Kopējie ieņēmumi,${kpiData.totalRevenue.toFixed(2)},EUR,${kpiData.revenueGrowth.toFixed(1)}%\n`;
    csv += `Pārdošana,Pārdotās vienības,${kpiData.unitsSold},gab,${kpiData.unitsChange.toFixed(1)}%\n`;
    csv += `Pārdošana,Vidējā cena,${kpiData.avgSellingPrice.toFixed(2)},EUR,${kpiData.aspChange.toFixed(1)}%\n`;
    csv += `Pārdošana,Ieņēmumi uz veikalu,${kpiData.revenuePerStore.toFixed(2)},EUR,\n`;

    // Profitability
    csv += `Rentabilitāte,Bruto marža,${kpiData.grossMargin.toFixed(2)},%,${kpiData.marginChange.toFixed(1)}%\n`;
    csv += `Rentabilitāte,Bruto peļņa EUR,${kpiData.grossMarginEur.toFixed(2)},EUR,\n`;

    // Assortment
    csv += `Sortiments,SKU skaits,${kpiData.skuCount},gab,\n`;
    csv += `Sortiments,A-produkti,${kpiData.aProductsCount},gab,\n`;
    csv += `Sortiments,B-produkti,${kpiData.bProductsCount},gab,\n`;
    csv += `Sortiments,C-produkti,${kpiData.cProductsCount},gab,\n`;
    csv += `Sortiments,A-produktu ieņēmumu daļa,${kpiData.aProductsRevenueShare.toFixed(2)},%,\n`;

    // Operations
    csv += `Operācijas,Krājumu līmenis,${kpiData.avgStockLevel},gab,\n`;
    csv += `Operācijas,Krājumu apgrozījums,${kpiData.stockTurnover.toFixed(2)},x,\n`;
    csv += `Operācijas,Lēni produkti,${kpiData.slowMoversCount},gab,\n`;

    // Pricing
    csv += `Cenas,Cenu indekss vs tirgus,${kpiData.priceIndexVsMarket.toFixed(2)},%,\n`;
    csv += `Cenas,Lētāki par tirgu,${kpiData.cheaperThanMarket},%,\n`;
    csv += `Cenas,Dārgāki par tirgu,${kpiData.moreExpensiveThanMarket},%,\n`;
    csv += `Cenas,Promo atkarība,${kpiData.promoDependency.toFixed(2)},%,\n`;

    // Top Products
    csv += `\n\nTOP PRODUKTI\n`;
    csv += `Vieta,Nosaukums,Ieņēmumi,Marža\n`;
    topProducts.forEach((p, i) => {
      csv += `${i + 1},"${p.name}",${p.revenue.toFixed(2)},${p.margin.toFixed(2)}%\n`;
    });

    // Store Comparison
    if (storeComparison.length > 0) {
      csv += `\n\nVEIKALU SALĪDZINĀJUMS\n`;
      csv += `Vieta,Veikals,Kods,Ieņēmumi,Izmaiņa\n`;
      storeComparison.forEach((s, i) => {
        csv += `${i + 1},"${s.name}",${s.code},${s.revenue.toFixed(2)},${s.growth.toFixed(1)}%\n`;
      });
    }

    return csv;
  };

  const copyToClipboard = async () => {
    setIsExporting(true);
    try {
      const summary = generateSummaryText();
      await navigator.clipboard.writeText(summary);
      toast({
        title: "Nokopēts!",
        description: "KPI apkopojums nokopēts starpliktuvē. Varat ielīmēt e-pastā vai ziņojumā.",
      });
    } catch {
      toast({
        title: "Kļūda",
        description: "Neizdevās nokopēt",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadText = () => {
    setIsExporting(true);
    try {
      const summary = generateSummaryText();
      const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kpi-apkopojums-${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Lejupielādēts!",
        description: "KPI apkopojums saglabāts kā teksta fails.",
      });
    } catch {
      toast({
        title: "Kļūda",
        description: "Neizdevās lejupielādēt",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadCSV = () => {
    setIsExporting(true);
    try {
      const csv = generateCSVData();
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kpi-dati-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Lejupielādēts!",
        description: "KPI dati saglabāti kā CSV fails (Excel saderīgs).",
      });
    } catch {
      toast({
        title: "Kļūda",
        description: "Neizdevās lejupielādēt",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const shareViaEmail = () => {
    const summary = generateSummaryText();
    const subject = encodeURIComponent(`KPI Apkopojums — ${new Date().toLocaleDateString("lv-LV")}`);
    const body = encodeURIComponent(summary);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 rounded-xl" disabled={isExporting}>
          <Download className="h-4 w-4" />
          Eksportēt
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={copyToClipboard} className="gap-2 cursor-pointer">
          <Share2 className="h-4 w-4" />
          Kopēt starpliktuvē
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadText} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4" />
          Lejupielādēt TXT
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadCSV} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4" />
          Lejupielādēt CSV (Excel)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareViaEmail} className="gap-2 cursor-pointer">
          <Share2 className="h-4 w-4" />
          Nosūtīt e-pastā
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
