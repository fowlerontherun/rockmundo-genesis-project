import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Tone = "default" | "success" | "warning" | "danger" | "info" | "muted";

const toneClasses: Record<Tone, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  muted: "bg-muted text-muted-foreground border-border",
};

export interface StandardStatusBadgeProps {
  children: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
}

export function StandardStatusBadge({ children, tone = "default", icon: Icon, className }: StandardStatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("gap-1 text-xs capitalize", toneClasses[tone], className)}>
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </Badge>
  );
}

export interface MetricCardItem {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
}

export function MetricCard({ label, value, icon: Icon, tone = "default" }: MetricCardItem) {
  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cn("h-4 w-4", toneClasses[tone].split(" ").find((c) => c.startsWith("text-")))} />}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function MetricCardGrid({ items, className }: { items: MetricCardItem[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4", className)}>
      {items.map((item, index) => (
        <MetricCard key={index} {...item} />
      ))}
    </div>
  );
}

export interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SectionCard({ title, description, icon: Icon, actions, children, className, contentClassName }: SectionCardProps) {
  return (
    <Card className={className}>
      {(title || description || actions) && (
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && (
                <CardTitle className="flex items-center gap-2 text-lg">
                  {Icon && <Icon className="h-4 w-4" />}
                  {title}
                </CardTitle>
              )}
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn(!title && !description && !actions && "pt-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
