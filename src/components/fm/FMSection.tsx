import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export const FMSection = ({
  title,
  actions,
  children,
  defaultOpen = true,
  collapsible = false,
  className,
}: {
  title: ReactNode;
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
      <header className="h-8 flex items-center justify-between px-3 bg-fm-panel-2 border-b border-fm-border">
        <button
          type="button"
          onClick={() => collapsible && setOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-semibold text-fm-fg-muted",
            collapsible && "hover:text-fm-fg",
          )}
        >
          {collapsible && (
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", !open && "-rotate-90")}
            />
          )}
          {title}
        </button>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </header>
      {open && <div className="p-3">{children}</div>}
    </section>
  );
};

export default FMSection;
