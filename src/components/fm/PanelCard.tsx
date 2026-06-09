import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const PanelCard = ({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) => (
  <section className={cn("bg-fm-panel border border-fm-border rounded-sm flex flex-col", className)}>
    {(title || actions) && (
      <header className="h-8 flex items-center justify-between px-3 bg-fm-panel-2 border-b border-fm-border">
        <h2 className="text-[11px] uppercase tracking-widest font-semibold text-fm-fg-muted">
          {title}
        </h2>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </header>
    )}
    <div className={cn("p-3", bodyClassName)}>{children}</div>
  </section>
);

export default PanelCard;
