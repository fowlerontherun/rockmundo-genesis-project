import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader = ({
  title,
  subtitle,
  eyebrow,
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
        "relative flex items-center justify-between gap-3 pl-4 pr-3 py-2.5 bg-fm-panel-2 border border-fm-border rounded-sm overflow-hidden",
        className,
      )}
    >
      {/* FM-style left accent bar tinted by current module */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[3px] bg-fm-accent"
      />
      <div className="flex items-center gap-2.5 min-w-0">
        {backTo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(backTo)}
            className="h-7 px-2 gap-1 text-fm-fg-muted hover:text-fm-fg -ml-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-xs">{backLabel || "Back"}</span>
          </Button>
        )}
        {Icon && (
          <div className="h-7 w-7 grid place-items-center rounded-sm bg-fm-accent/10 border border-fm-accent/25 flex-shrink-0">
            <Icon className="h-4 w-4 text-fm-accent" />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-[0.18em] text-fm-fg-muted/80 leading-none mb-1">
            {eyebrow || subtitle || "\u00A0"}
          </div>
          <h1 className="text-[15px] font-bold uppercase tracking-wide text-fm-fg truncate leading-none">
            {title}
          </h1>
        </div>
        {eyebrow && subtitle && (
          <div className="hidden md:block pl-3 ml-1 border-l border-fm-border/70 text-[11px] text-fm-fg-muted truncate max-w-[420px]">
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>}
    </div>
  );
};
