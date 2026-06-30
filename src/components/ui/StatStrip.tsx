import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatStripItem {
  label: string;
  value: ReactNode;
}

/**
 * Spec §2.2 — exactly 3 or 4 metric cards in a single row, equal width,
 * directly under the page header. No icons. Sentence-case labels.
 */
export const StatStrip = ({
  items,
  className,
}: {
  items: StatStripItem[];
  className?: string;
}) => {
  const count = Math.min(Math.max(items.length, 3), 4);
  if (items.length < 3) return null;
  return (
    <div
      className={cn("grid gap-3", className)}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {items.slice(0, count).map((it, idx) => (
        <div
          key={idx}
          className="rounded-[10px] border border-fm-border bg-fm-panel px-3.5 py-3"
        >
          <div className="text-[11px] text-fm-fg-muted font-normal">{it.label}</div>
          <div className="text-[20px] font-medium tabular-nums tracking-tight text-fm-fg leading-tight mt-0.5">
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatStrip;
