import { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * FM24-style filter bar — a compact 32px strip with optional search input,
 * pill-style filter buttons, and a right-aligned slot for extra controls.
 *
 * Designed to sit immediately above a `Table` / `DataTable`.
 */

export type FilterPill<V extends string = string> = {
  value: V;
  label: ReactNode;
  /** Optional count badge, shown after the label. */
  count?: number;
};

interface FMFilterBarProps<V extends string> {
  /** Search input value (controlled). Omit to hide the search box. */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  /** Pill-style filter selector (single-value). */
  pills?: FilterPill<V>[];
  activePill?: V;
  onPillChange?: (value: V) => void;

  /** Optional right-aligned slot (e.g. sort dropdown, export button). */
  right?: ReactNode;

  /** Optional left-aligned label slot. */
  label?: ReactNode;

  className?: string;
}

export function FMFilterBar<V extends string = string>({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  pills,
  activePill,
  onPillChange,
  right,
  label,
  className,
}: FMFilterBarProps<V>) {
  const hasSearch = typeof search === "string" && !!onSearchChange;

  return (
    <div
      className={cn(
        "flex items-center gap-2 min-h-10 p-1.5 bg-fm-panel border border-fm-border rounded-[10px] text-[12px] flex-wrap",
        className,
      )}
    >
      {label && (
        <span className="px-1.5 text-[11px] text-fm-fg-muted">
          {label}
        </span>
      )}

      {hasSearch && (
        <div className="relative flex items-center flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-fm-fg-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange!(e.target.value)}
            placeholder={searchPlaceholder}
            className={cn(
              "h-8 w-full pl-8 pr-7 bg-fm-panel-2 border border-fm-border rounded-[7px]",
              "text-[12px] text-fm-fg placeholder:text-fm-fg-muted",
              "focus:outline-none focus:border-fm-accent",
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange!("")}
              className="absolute right-2 text-fm-fg-muted hover:text-fm-fg"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {pills && pills.length > 0 && (
        <div className="flex items-center gap-1">
          {pills.map((p) => {
            const active = p.value === activePill;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onPillChange?.(p.value)}
                className={cn(
                  "h-8 px-3 inline-flex items-center gap-1.5 rounded-[7px] text-[12px] font-medium tracking-tight transition-colors",
                  active
                    ? "bg-fm-accent/15 text-fm-accent"
                    : "text-fm-fg-muted hover:text-fm-fg hover:bg-fm-panel-2",
                )}
              >
                <span>{p.label}</span>
                {typeof p.count === "number" && (
                  <span
                    className={cn(
                      "tabular-nums text-[11px] px-1.5 rounded-[5px]",
                      active ? "bg-fm-accent/25 text-fm-accent" : "bg-fm-panel-2 text-fm-fg-muted",
                    )}
                  >
                    {p.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {right && <div className="ml-auto flex items-center gap-1.5">{right}</div>}
    </div>
  );
}

export default FMFilterBar;
