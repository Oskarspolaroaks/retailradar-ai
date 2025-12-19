import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeLabel?: string;
  target?: number;
  warningThreshold?: number;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const KPICard = ({
  title,
  value,
  unit = "",
  change,
  changeLabel = "vs iepriekšējais periods",
  target,
  warningThreshold,
  icon,
  trend,
  size = "md",
  className,
}: KPICardProps) => {
  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  
  // Determine status based on target and threshold
  let status: "success" | "warning" | "danger" | "neutral" = "neutral";
  if (target !== undefined) {
    if (numericValue >= target) {
      status = "success";
    } else if (warningThreshold !== undefined && numericValue >= warningThreshold) {
      status = "warning";
    } else if (warningThreshold !== undefined && numericValue < warningThreshold) {
      status = "danger";
    }
  }

  // Determine trend icon
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground";

  const statusColors = {
    success: "border-l-success bg-success/5",
    warning: "border-l-warning bg-warning/5",
    danger: "border-l-destructive bg-destructive/5",
    neutral: "border-l-primary bg-primary/5",
  };

  const sizeClasses = {
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  const valueClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <Card className={cn(
      "border-l-4 transition-all hover:shadow-md",
      statusColors[status],
      className
    )}>
      <CardContent className={cn("space-y-2", sizeClasses[size])}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          {icon && (
            <div className="h-8 w-8 rounded-lg bg-background/50 flex items-center justify-center">
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-1">
          <span className={cn("font-bold tracking-tight", valueClasses[size])}>
            {typeof value === "number" ? value.toLocaleString("lv-LV", { maximumFractionDigits: 1 }) : value}
          </span>
          {unit && <span className="text-muted-foreground text-sm">{unit}</span>}
        </div>

        {change !== undefined && (
          <div className="flex items-center gap-2">
            <div className={cn("flex items-center gap-1 text-sm font-medium", trendColor)}>
              <TrendIcon className="h-3 w-3" />
              <span>{change > 0 ? "+" : ""}{change.toFixed(1)}%</span>
            </div>
            <span className="text-xs text-muted-foreground">{changeLabel}</span>
          </div>
        )}

        {target !== undefined && status === "warning" && (
          <div className="flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="h-3 w-3" />
            <span>Zem mērķa ({target}{unit})</span>
          </div>
        )}

        {target !== undefined && status === "danger" && (
          <div className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            <span>Kritisks: zem {warningThreshold}{unit}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
