import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet, Share2, FileImage, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface KPIData {
  totalRevenue: number;
  revenueGrowth: number;
  unitsSold: number;
  unitsChange: number;
  avgTicket: number;
  avgTicketChange: number;
  transactionCount: number;
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
  avgTicket?: number;
  growth: number;
}

interface KPIExportButtonProps {
  kpiData: KPIData;
  topProducts: TopProduct[];
  bottomProducts: TopProduct[];
  storeComparison: StoreData[];
  dateRange: string;
  chartsContainerId?: string;
}

export const KPIExportButton = ({
  kpiData,
  topProducts,
  bottomProducts,
  storeComparison,
  dateRange,
  chartsContainerId = "dashboard-charts",
}: KPIExportButtonProps) => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const generateSummaryText = (): string => {
    const dateLabel = `${dateRange} days`;
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let summary = `KPI SUMMARY — ${today}\n`;
    summary += `Period: Last ${dateLabel}\n`;
    summary += `═══════════════════════════════════════\n\n`;

    // Sales Performance
    summary += `SALES PERFORMANCE\n`;
    summary += `─────────────────────────────────────\n`;
    summary += `• Total Revenue: €${kpiData.totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}\n`;
    summary += `• Revenue Change: ${kpiData.revenueGrowth >= 0 ? "+" : ""}${kpiData.revenueGrowth.toFixed(1)}%\n`;
    summary += `• Units Sold: ${kpiData.unitsSold.toLocaleString("en-US")}\n`;
    summary += `• Avg. Ticket: €${kpiData.avgTicket.toFixed(2)}\n`;
    summary += `• Transaction Count: ${kpiData.transactionCount.toLocaleString("en-US")}\n`;
    summary += `• Revenue per Store: €${kpiData.revenuePerStore.toLocaleString("en-US", { maximumFractionDigits: 0 })}\n\n`;

    // Profitability
    summary += `PROFITABILITY\n`;
    summary += `─────────────────────────────────────\n`;
    summary += `• Gross Margin: ${kpiData.grossMargin.toFixed(1)}%\n`;
    summary += `• Margin Change: ${kpiData.marginChange >= 0 ? "+" : ""}${kpiData.marginChange.toFixed(1)}%\n`;
    summary += `• Gross Profit (EUR): €${kpiData.grossMarginEur.toLocaleString("en-US", { maximumFractionDigits: 0 })}\n\n`;

    // Assortment
    summary += `ASSORTMENT\n`;
    summary += `─────────────────────────────────────\n`;
    summary += `• Active SKU: ${kpiData.skuCount}\n`;
    summary += `• A-Products: ${kpiData.aProductsCount} (${kpiData.aProductsRevenueShare.toFixed(1)}% revenue)\n`;
    summary += `• B-Products: ${kpiData.bProductsCount}\n`;
    summary += `• C-Products: ${kpiData.cProductsCount}\n\n`;

    // Operations
    summary += `OPERATIONS\n`;
    summary += `─────────────────────────────────────\n`;
    summary += `• Avg. Stock Level: ${kpiData.avgStockLevel.toLocaleString("en-US")}\n`;
    summary += `• Stock Turnover: ${kpiData.stockTurnover.toFixed(1)}x\n`;
    summary += `• Slow Movers: ${kpiData.slowMoversCount}\n\n`;

    // Pricing
    summary += `PRICING POSITION\n`;
    summary += `─────────────────────────────────────\n`;
    summary += `• Price Index vs Market: ${kpiData.priceIndexVsMarket.toFixed(1)}%\n`;
    summary += `• Cheaper than Market: ${kpiData.cheaperThanMarket}%\n`;
    summary += `• More Expensive: ${kpiData.moreExpensiveThanMarket}%\n`;
    summary += `• Promo Dependency: ${kpiData.promoDependency.toFixed(1)}%\n\n`;

    // Top 5 Products
    if (topProducts.length > 0) {
      summary += `TOP 5 PRODUCTS (by revenue)\n`;
      summary += `─────────────────────────────────────\n`;
      topProducts.slice(0, 5).forEach((p, i) => {
        summary += `${i + 1}. ${p.name.substring(0, 40)} — €${p.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}\n`;
      });
      summary += `\n`;
    }

    // Bottom 5 Products
    if (bottomProducts.length > 0) {
      summary += `BOTTOM 5 PRODUCTS\n`;
      summary += `─────────────────────────────────────\n`;
      bottomProducts.slice(0, 5).forEach((p, i) => {
        summary += `${i + 1}. ${p.name.substring(0, 40)} — €${p.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}\n`;
      });
      summary += `\n`;
    }

    // Store Comparison
    if (storeComparison.length > 0) {
      summary += `STORE COMPARISON\n`;
      summary += `─────────────────────────────────────\n`;
      storeComparison.slice(0, 5).forEach((s, i) => {
        summary += `${i + 1}. ${s.name} (${s.code}) — €${s.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })} | Ticket: €${s.avgTicket?.toFixed(2) || 'N/A'} (${s.growth >= 0 ? "+" : ""}${s.growth.toFixed(1)}%)\n`;
      });
      summary += `\n`;
    }

    summary += `═══════════════════════════════════════\n`;
    summary += `Generated: ${new Date().toLocaleString("en-US")}\n`;
    summary += `RetailAI — Business Intelligence`;

    return summary;
  };

  const generateCSVData = (): string => {
    let csv = "Category,KPI,Value,Unit,Change\n";

    // Sales
    csv += `Sales,Total Revenue,${kpiData.totalRevenue.toFixed(2)},EUR,${kpiData.revenueGrowth.toFixed(1)}%\n`;
    csv += `Sales,Units Sold,${kpiData.unitsSold},pcs,${kpiData.unitsChange.toFixed(1)}%\n`;
    csv += `Sales,Avg Ticket,${kpiData.avgTicket.toFixed(2)},EUR,${kpiData.avgTicketChange.toFixed(1)}%\n`;
    csv += `Sales,Transaction Count,${kpiData.transactionCount},pcs,\n`;
    csv += `Sales,Revenue per Store,${kpiData.revenuePerStore.toFixed(2)},EUR,\n`;

    // Profitability
    csv += `Profitability,Gross Margin,${kpiData.grossMargin.toFixed(2)},%,${kpiData.marginChange.toFixed(1)}%\n`;
    csv += `Profitability,Gross Profit EUR,${kpiData.grossMarginEur.toFixed(2)},EUR,\n`;

    // Assortment
    csv += `Assortment,SKU Count,${kpiData.skuCount},pcs,\n`;
    csv += `Assortment,A-Products,${kpiData.aProductsCount},pcs,\n`;
    csv += `Assortment,B-Products,${kpiData.bProductsCount},pcs,\n`;
    csv += `Assortment,C-Products,${kpiData.cProductsCount},pcs,\n`;
    csv += `Assortment,A-Products Revenue Share,${kpiData.aProductsRevenueShare.toFixed(2)},%,\n`;

    // Operations
    csv += `Operations,Stock Level,${kpiData.avgStockLevel},pcs,\n`;
    csv += `Operations,Stock Turnover,${kpiData.stockTurnover.toFixed(2)},x,\n`;
    csv += `Operations,Slow Movers,${kpiData.slowMoversCount},pcs,\n`;

    // Pricing
    csv += `Pricing,Price Index vs Market,${kpiData.priceIndexVsMarket.toFixed(2)},%,\n`;
    csv += `Pricing,Cheaper than Market,${kpiData.cheaperThanMarket},%,\n`;
    csv += `Pricing,More Expensive,${kpiData.moreExpensiveThanMarket},%,\n`;
    csv += `Pricing,Promo Dependency,${kpiData.promoDependency.toFixed(2)},%,\n`;

    // Top Products
    csv += `\n\nTOP PRODUCTS\n`;
    csv += `Rank,Name,Revenue,Margin\n`;
    topProducts.forEach((p, i) => {
      csv += `${i + 1},"${p.name}",${p.revenue.toFixed(2)},${p.margin.toFixed(2)}%\n`;
    });

    // Store Comparison
    if (storeComparison.length > 0) {
      csv += `\n\nSTORE COMPARISON\n`;
      csv += `Rank,Store,Code,Revenue,Avg Ticket,Change\n`;
      storeComparison.forEach((s, i) => {
        csv += `${i + 1},"${s.name}",${s.code},${s.revenue.toFixed(2)},${s.avgTicket?.toFixed(2) || ''},${s.growth.toFixed(1)}%\n`;
      });
    }

    return csv;
  };

  const downloadPDF = async () => {
    setIsExporting(true);
    toast({
      title: "Generating PDF...",
      description: "Please wait while the PDF report with charts is being created.",
    });

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Header
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, 0, pageWidth, 35, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text("RetailAI Executive Dashboard", margin, 18);
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      const today = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      pdf.text(`KPI Summary | ${today} | Period: ${dateRange} days`, margin, 28);
      
      yPosition = 45;
      pdf.setTextColor(0, 0, 0);

      // KPI Summary Section
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Key Metrics", margin, yPosition);
      yPosition += 8;

      // KPI Grid
      const kpiItems = [
        { label: "Total Revenue", value: `€${kpiData.totalRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, change: kpiData.revenueGrowth },
        { label: "Gross Margin", value: `${kpiData.grossMargin.toFixed(1)}%`, change: kpiData.marginChange },
        { label: "Units Sold", value: kpiData.unitsSold.toLocaleString("en-US"), change: kpiData.unitsChange },
        { label: "Avg. Ticket", value: `€${kpiData.avgTicket.toFixed(2)}`, change: kpiData.avgTicketChange },
      ];

      const boxWidth = (pageWidth - margin * 2 - 15) / 2;
      const boxHeight = 22;

      kpiItems.forEach((item, index) => {
        const xPos = margin + (index % 2) * (boxWidth + 5);
        const yPos = yPosition + Math.floor(index / 2) * (boxHeight + 5);

        // Box background
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(xPos, yPos, boxWidth, boxHeight, 3, 3, "F");

        // Label
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 116, 139);
        pdf.text(item.label, xPos + 5, yPos + 8);

        // Value
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        pdf.text(item.value, xPos + 5, yPos + 17);

        // Change indicator
        const changeText = `${item.change >= 0 ? "+" : ""}${item.change.toFixed(1)}%`;
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        if (item.change >= 0) {
          pdf.setTextColor(34, 197, 94);
        } else {
          pdf.setTextColor(239, 68, 68);
        }
        pdf.text(changeText, xPos + boxWidth - 20, yPos + 17);
      });

      yPosition += (Math.ceil(kpiItems.length / 2) * (boxHeight + 5)) + 10;

      // ABC & Assortment Section
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text("Assortment Analysis", margin, yPosition);
      yPosition += 8;

      const abcData = [
        { category: "A-Products", count: kpiData.aProductsCount, share: kpiData.aProductsRevenueShare, color: [59, 130, 246] },
        { category: "B-Products", count: kpiData.bProductsCount, share: 100 - kpiData.aProductsRevenueShare - 5, color: [16, 185, 129] },
        { category: "C-Products", count: kpiData.cProductsCount, share: 5, color: [249, 115, 22] },
      ];

      abcData.forEach((item, index) => {
        const xPos = margin;
        const yPos = yPosition + index * 12;

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${item.category}: ${item.count} SKU`, xPos, yPos + 5);

        // Progress bar background
        pdf.setFillColor(226, 232, 240);
        pdf.roundedRect(xPos + 60, yPos + 1, 80, 6, 2, 2, "F");

        // Progress bar fill
        pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
        pdf.roundedRect(xPos + 60, yPos + 1, (item.share / 100) * 80, 6, 2, 2, "F");

        pdf.text(`${item.share.toFixed(1)}%`, xPos + 145, yPos + 5);
      });

      yPosition += 45;

      // Capture charts from the page
      const chartsContainer = document.getElementById(chartsContainerId);
      if (chartsContainer) {
        const charts = chartsContainer.querySelectorAll(".recharts-wrapper");
        
        for (let i = 0; i < Math.min(charts.length, 3); i++) {
          const chart = charts[i] as HTMLElement;
          
          try {
            const canvas = await html2canvas(chart, {
              scale: 2,
              backgroundColor: "#ffffff",
              logging: false,
            });

            const imgData = canvas.toDataURL("image/png");
            const imgWidth = pageWidth - margin * 2;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // Check if we need a new page
            if (yPosition + imgHeight > pageHeight - margin) {
              pdf.addPage();
              yPosition = margin;
            }

            pdf.addImage(imgData, "PNG", margin, yPosition, imgWidth, Math.min(imgHeight, 80));
            yPosition += Math.min(imgHeight, 80) + 10;
          } catch (err) {
            console.error("Failed to capture chart:", err);
          }
        }
      }

      // Top Products Section
      if (yPosition > pageHeight - 80) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text("Top 5 Products", margin, yPosition);
      yPosition += 8;

      topProducts.slice(0, 5).forEach((product, index) => {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        const text = `${index + 1}. ${product.name.substring(0, 45)}`;
        const revenue = `€${product.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
        pdf.text(text, margin, yPosition);
        pdf.text(revenue, pageWidth - margin - 30, yPosition);
        yPosition += 6;
      });

      yPosition += 10;

      // Store Comparison
      if (storeComparison.length > 0) {
        if (yPosition > pageHeight - 60) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Store Comparison", margin, yPosition);
        yPosition += 8;

        storeComparison.slice(0, 5).forEach((store, index) => {
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          const text = `${index + 1}. ${store.name} (${store.code})`;
          const revenue = `€${store.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
          const growth = `${store.growth >= 0 ? "+" : ""}${store.growth.toFixed(1)}%`;
          
          pdf.setTextColor(0, 0, 0);
          pdf.text(text, margin, yPosition);
          pdf.text(revenue, pageWidth - margin - 55, yPosition);
          
          if (store.growth >= 0) {
            pdf.setTextColor(34, 197, 94);
          } else {
            pdf.setTextColor(239, 68, 68);
          }
          pdf.text(growth, pageWidth - margin - 20, yPosition);
          yPosition += 6;
        });
      }

      // Footer
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(148, 163, 184);
      pdf.text(
        `Generated: ${new Date().toLocaleString("en-US")} | RetailAI Executive Dashboard`,
        margin,
        pageHeight - 10
      );

      // Save PDF
      pdf.save(`kpi-report-${new Date().toISOString().split("T")[0]}.pdf`);

      toast({
        title: "PDF downloaded!",
        description: "Report with charts saved successfully.",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF file",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = async () => {
    setIsExporting(true);
    try {
      const summary = generateSummaryText();
      await navigator.clipboard.writeText(summary);
      toast({
        title: "Copied!",
        description: "KPI summary copied to clipboard.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy",
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
      a.download = `kpi-summary-${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Downloaded!",
        description: "KPI summary saved as text file.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to download",
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
      a.download = `kpi-data-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Downloaded!",
        description: "KPI data saved as CSV file.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to download",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const shareViaEmail = () => {
    const summary = generateSummaryText();
    const subject = encodeURIComponent(`KPI Summary — ${new Date().toLocaleDateString("en-US")}`);
    const body = encodeURIComponent(summary);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 rounded-xl" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={downloadPDF} className="gap-2 cursor-pointer">
          <FileImage className="h-4 w-4" />
          PDF with charts
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyToClipboard} className="gap-2 cursor-pointer">
          <Share2 className="h-4 w-4" />
          Copy to clipboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadText} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4" />
          Download TXT
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadCSV} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4" />
          Download CSV (Excel)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={shareViaEmail} className="gap-2 cursor-pointer">
          <Share2 className="h-4 w-4" />
          Send via email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
