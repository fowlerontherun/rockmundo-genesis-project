import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTrendDirection = "up" | "down" | "neutral";

export interface StatTrend {
  value: string;
  direction: StatTrendDirection;
  label?: string;
}

export interface StatCardProps {
  title: string;
  value: ReactNode;
  description?: string;
  icon?: ReactNode;
  trend?: StatTrend;
  footer?: ReactNode;
  className?: string;
}

const trendStyles: Record<StatTrendDirection, string> = {
  up: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  down: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  neutral: "bg-muted text-muted-foreground",
};

export const StatCard = ({
  title,
  value,
  description,
  icon,
  trend,
  footer,
  className,
}: StatCardProps) => {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon ? (
          <div className="rounded-full bg-primary/10 p-2 text-primary">{icon}</div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
        {trend ? (
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-medium",
              trendStyles[trend.direction]
            )}
          >
            <span>{trend.value}</span>
            {trend.label ? <span className="text-muted-foreground">{trend.label}</span> : null}
          </div>
        ) : null}
        {footer ? <div className="pt-2 text-xs text-muted-foreground">{footer}</div> : null}
      </CardContent>
    </Card>
  );
};

export default StatCard;
