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
      className={cn("bg-fm-panel border border-fm-border rounded-[12px] flex flex-col", className)}
    >
      <header className="h-9 flex items-center justify-between px-3.5 border-b border-fm-border">
        <button
          type="button"
          onClick={() => collapsible && setOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 text-[12px] font-medium tracking-tight text-fm-fg",
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
            <span className="ml-1 px-1.5 h-[18px] inline-flex items-center justify-center rounded-[6px] bg-fm-accent/15 text-fm-accent text-[11px] tabular-nums font-medium">
              {count}
            </span>
          )}
        </button>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </header>
      {open && <div className="p-3.5">{children}</div>}
    </section>
  );
};

export default FMSection;
