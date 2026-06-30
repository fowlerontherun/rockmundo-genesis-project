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
  <section className={cn("bg-fm-panel border border-fm-border rounded-[12px] flex flex-col", className)}>
    {(title || actions) && (
      <header className="h-9 flex items-center justify-between px-3.5 border-b border-fm-border">
        <h2 className="text-[12px] font-medium tracking-tight text-fm-fg">
          {title}
        </h2>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </header>
    )}
    <div className={cn("p-3", bodyClassName)}>{children}</div>
  </section>
);

export default PanelCard;
