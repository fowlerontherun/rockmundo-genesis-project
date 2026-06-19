import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export const FMSection = ({
  title,
  count,
  actions,
  children,
  defaultOpen = true,
  collapsible = false,
  className,
}: {
  title: ReactNode;
  count?: number | string;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  className?: string;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={cn("bg-fm-panel border border-fm-border rounded-sm flex flex-col", className)}
    >
      <header className="relative h-8 flex items-center justify-between pl-3 pr-2 bg-fm-panel-2 border-b border-fm-border">
        {/* Slim accent tick to signal section authority — FM2024 style */}
        <span
          aria-hidden
          className="absolute left-0 top-1 bottom-1 w-[2px] bg-fm-accent/70"
        />
        <button
          type="button"
          onClick={() => collapsible && setOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] font-bold text-fm-fg",
            collapsible && "hover:text-fm-accent",
          )}
        >
          {collapsible && (
            <ChevronDown
              className={cn("h-3 w-3 transition-transform text-fm-fg-muted", !open && "-rotate-90")}
            />
          )}
          <span>{title}</span>
          {count !== undefined && count !== "" && (
            <span className="ml-1 px-1.5 h-[15px] inline-flex items-center justify-center rounded-[2px] bg-fm-accent/15 text-fm-accent text-[10px] tabular-nums font-semibold tracking-normal">
              {count}
            </span>
          )}
        </button>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </header>
      {open && <div className="p-3">{children}</div>}
    </section>
  );
};

export default FMSection;
