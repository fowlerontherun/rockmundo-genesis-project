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
  <section className={cn("rm-game-panel bg-fm-panel border border-fm-border rounded-lg flex flex-col", className)}>
    {(title || actions) && (
      <header className="min-h-9 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-t-[inherit] bg-fm-panel-2 border-b border-fm-border">
        <h2 className="text-[12px] font-semibold tracking-normal text-fm-fg">
          {title}
        </h2>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </header>
    )}
    <div className={cn("p-3", bodyClassName)}>{children}</div>
  </section>
);

export default PanelCard;
