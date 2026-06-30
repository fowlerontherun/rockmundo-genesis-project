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
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Breadcrumb row (spec §2.1) — back · section · description */}
      <div className="flex items-center gap-2 text-[12px] text-fm-fg-muted">
        {backTo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(backTo)}
            className="h-6 px-1.5 gap-1 text-fm-fg-muted hover:text-fm-fg -ml-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-xs">{backLabel || "Back"}</span>
          </Button>
        )}
        {eyebrow && (
          <span className="text-fm-accent font-medium">{eyebrow}</span>
        )}
        {eyebrow && subtitle && <span className="text-fm-fg-subtle">·</span>}
        {subtitle && <span className="truncate">{subtitle}</span>}
      </div>

      {/* Title row — icon chip + h1 left, single primary action right */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div
              className="h-[34px] w-[34px] grid place-items-center rounded-[10px] shrink-0"
              style={{
                background: "hsl(var(--fm-accent) / 0.15)",
                color: "hsl(var(--fm-accent))",
              }}
            >
              <Icon className="h-[18px] w-[18px]" />
            </div>
          )}
          <h1 className="text-[20px] font-medium tracking-tight text-fm-fg truncate leading-tight font-display">
            {title}
          </h1>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
};
