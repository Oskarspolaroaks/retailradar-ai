import { KPICard } from "./KPICard";
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  BarChart3,
  Target,
  Percent,
  ShoppingCart,
  Warehouse
} from "lucide-react";

interface KPISummarySectionProps {
  data: {
    totalRevenue: number;
    revenueGrowth: number;
    grossMargin: number;
    marginChange: number;
    totalUnits: number;
    unitsChange: number;
    avgSellingPrice: number;
    aspChange: number;
    skuCount: number;
    aProductsShare: number;
    stockTurnover: number;
    priceIndex: number;
  };
  targets?: Record<string, { target: number; warning: number }>;
}

export const KPISummarySection = ({ data, targets = {} }: KPISummarySectionProps) => {
  return (
    <div className="space-y-6">
      {/* Primary KPIs - Large Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Kopējie Ieņēmumi"
          value={data.totalRevenue}
          unit="€"
          change={data.revenueGrowth}
          trend={data.revenueGrowth >= 0 ? "up" : "down"}
          target={targets.revenue?.target}
          warningThreshold={targets.revenue?.warning}
          icon={<DollarSign className="h-4 w-4 text-primary" />}
          size="lg"
        />
        <KPICard
          title="Bruto Peļņa"
          value={data.grossMargin}
          unit="%"
          change={data.marginChange}
          trend={data.marginChange >= 0 ? "up" : "down"}
          target={targets.margin?.target}
          warningThreshold={targets.margin?.warning}
          icon={<Percent className="h-4 w-4 text-chart-2" />}
          size="lg"
        />
        <KPICard
          title="Pārdotas Vienības"
          value={data.totalUnits}
          change={data.unitsChange}
          trend={data.unitsChange >= 0 ? "up" : "down"}
          icon={<ShoppingCart className="h-4 w-4 text-chart-3" />}
          size="lg"
        />
        <KPICard
          title="Vid. Pārdošanas Cena"
          value={data.avgSellingPrice}
          unit="€"
          change={data.aspChange}
          trend={data.aspChange >= 0 ? "up" : "down"}
          icon={<TrendingUp className="h-4 w-4 text-chart-4" />}
          size="lg"
        />
      </div>

      {/* Secondary KPIs - Medium Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Aktīvi SKU"
          value={data.skuCount}
          icon={<Package className="h-4 w-4 text-muted-foreground" />}
          size="md"
        />
        <KPICard
          title="A-Produktu Daļa"
          value={data.aProductsShare}
          unit="%"
          target={targets.aShare?.target}
          warningThreshold={targets.aShare?.warning}
          trend={data.aProductsShare >= 70 ? "up" : "down"}
          icon={<BarChart3 className="h-4 w-4 text-chart-1" />}
          size="md"
        />
        <KPICard
          title="Krājumu Apgrozījums"
          value={data.stockTurnover}
          unit="x"
          target={targets.turnover?.target}
          warningThreshold={targets.turnover?.warning}
          icon={<Warehouse className="h-4 w-4 text-chart-2" />}
          size="md"
        />
        <KPICard
          title="Cenu Indekss vs Tirgus"
          value={data.priceIndex}
          unit="%"
          target={100}
          warningThreshold={105}
          trend={data.priceIndex <= 100 ? "up" : "down"}
          icon={<Target className="h-4 w-4 text-chart-5" />}
          size="md"
        />
      </div>
    </div>
  );
};
