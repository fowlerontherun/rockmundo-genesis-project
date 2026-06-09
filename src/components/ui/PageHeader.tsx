import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({
  title,
  subtitle,
  icon: Icon,
  backTo,
  backLabel,
  actions,
  className,
}: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 bg-fm-panel-2 border border-fm-border rounded-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {backTo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(backTo)}
            className="h-7 px-2 gap-1 text-fm-fg-muted hover:text-fm-fg"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-xs">{backLabel || "Back"}</span>
          </Button>
        )}
        {Icon && <Icon className="h-4 w-4 text-fm-accent flex-shrink-0" />}
        <div className="min-w-0">
          <h1 className="text-sm font-semibold uppercase tracking-wider text-fm-fg truncate leading-none">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-fm-fg-muted mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>}
    </div>
  );
};
