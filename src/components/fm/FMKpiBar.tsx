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
      "flex items-stretch gap-[1px] bg-fm-border border border-fm-border rounded-sm overflow-x-auto",
      className,
    )}
  >
    {items.map((it, i) => {
      const Icon = it.icon;
      return (
        <div
          key={i}
          className="flex-1 min-w-[120px] bg-fm-panel px-3 py-2 flex flex-col justify-center"
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-fm-fg-muted">
            {Icon && <Icon className="h-3 w-3" />}
            <span className="truncate">{it.label}</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span
              className={cn(
                "text-base font-semibold tabular-nums leading-none",
                toneClass[it.tone ?? "neutral"],
              )}
            >
              {it.value}
            </span>
            {it.delta !== undefined && it.delta !== "" && (
              <span
                className={cn(
                  "text-[10px] tabular-nums",
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
