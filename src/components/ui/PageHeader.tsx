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
    <div className={cn("space-y-1", className)}>
      {backTo && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(backTo)}
          className="gap-2 -ml-2 mb-1"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel || "Back"}
        </Button>
      )}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-oswald flex items-center gap-2">
            {Icon && <Icon className="h-6 w-6 md:h-7 md:w-7 text-primary flex-shrink-0" />}
            <span className="truncate">{title}</span>
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
};
