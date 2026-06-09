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
        "flex items-center gap-2 h-8 px-2 bg-fm-panel-2 border border-fm-border rounded-sm text-xs",
        className,
      )}
    >
      {label && (
        <span className="text-[10px] uppercase tracking-widest font-semibold text-fm-fg-muted">
          {label}
        </span>
      )}

      {hasSearch && (
        <div className="relative flex items-center">
          <Search className="absolute left-2 h-3 w-3 text-fm-fg-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange!(e.target.value)}
            placeholder={searchPlaceholder}
            className={cn(
              "h-6 w-48 pl-6 pr-6 bg-fm-panel border border-fm-border rounded-sm",
              "text-xs text-fm-fg placeholder:text-fm-fg-muted",
              "focus:outline-none focus:border-fm-accent focus:ring-1 focus:ring-fm-accent",
            )}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange!("")}
              className="absolute right-1.5 text-fm-fg-muted hover:text-fm-fg"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {pills && pills.length > 0 && (
        <div className="flex items-center gap-0.5">
          {pills.map((p) => {
            const active = p.value === activePill;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onPillChange?.(p.value)}
                className={cn(
                  "h-6 px-2 inline-flex items-center gap-1 rounded-sm border text-[11px] uppercase tracking-wide transition-colors",
                  active
                    ? "bg-fm-accent/15 border-fm-accent/50 text-fm-accent"
                    : "bg-fm-panel border-fm-border text-fm-fg-muted hover:text-fm-fg hover:border-fm-fg-muted/40",
                )}
              >
                <span>{p.label}</span>
                {typeof p.count === "number" && (
                  <span
                    className={cn(
                      "tabular-nums text-[10px] px-1 rounded-sm",
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
