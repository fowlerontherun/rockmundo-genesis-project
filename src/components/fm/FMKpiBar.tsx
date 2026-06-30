import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type KpiItem = {
  label: string;
  value: ReactNode;
  delta?: string | number;
  tone?: "good" | "warn" | "bad" | "neutral";
  icon?: React.ElementType;
};

const toneClass = {
  good: "text-fm-good",
  warn: "text-fm-warn",
  bad: "text-fm-bad",
  neutral: "text-fm-fg",
};

export const FMKpiBar = ({ items, className }: { items: KpiItem[]; className?: string }) => (
  <div
    className={cn(
      "grid gap-3",
      className,
    )}
    style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(items.length, 1), 4)}, minmax(0, 1fr))` }}
  >
    {items.map((it, i) => {
      const Icon = it.icon;
      return (
        <div
          key={i}
          className="rounded-[10px] border border-fm-border bg-fm-panel px-3.5 py-3 flex flex-col justify-center"
        >
          <div className="flex items-center gap-1.5 text-[11px] text-fm-fg-muted">
            {Icon && <Icon className="h-3 w-3" />}
            <span className="truncate">{it.label}</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span
              className={cn(
                "text-[20px] font-medium tabular-nums leading-none tracking-tight",
                toneClass[it.tone ?? "neutral"],
              )}
            >
              {it.value}
            </span>
            {it.delta !== undefined && it.delta !== "" && (
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  String(it.delta).startsWith("-") ? "text-fm-bad" : "text-fm-good",
                )}
              >
                {it.delta}
              </span>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

export default FMKpiBar;
