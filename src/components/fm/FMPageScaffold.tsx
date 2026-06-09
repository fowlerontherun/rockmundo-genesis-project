import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FMKpiBar, type KpiItem } from "./FMKpiBar";
import { cn } from "@/lib/utils";

export const FMPageScaffold = ({
  title,
  subtitle,
  icon,
  backTo,
  backLabel,
  headerActions,
  kpis,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  backTo?: string;
  backLabel?: string;
  headerActions?: ReactNode;
  kpis?: KpiItem[];
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-3", className)}>
    <PageHeader
      title={title}
      subtitle={subtitle}
      icon={icon}
      backTo={backTo}
      backLabel={backLabel}
      actions={headerActions}
    />
    {kpis && kpis.length > 0 && <FMKpiBar items={kpis} />}
    <div className="flex flex-col gap-3">{children}</div>
  </div>
);

export default FMPageScaffold;
