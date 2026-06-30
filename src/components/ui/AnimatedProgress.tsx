import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedProgressProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  showValue?: boolean;
  label?: string;
}

/**
 * Progress bar that animates from previous to new value whenever `value` changes.
 * Use for goals, level progress, XP bars — anything that should *feel* like it moved.
 */
export const AnimatedProgress = ({
  value,
  max = 100,
  className,
  barClassName,
  showValue,
  label,
}: AnimatedProgressProps) => {
  const prev = useRef(value);
  const [from, setFrom] = useState(value);

  useEffect(() => {
    setFrom(prev.current);
    prev.current = value;
  }, [value]);

  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const fromPct = Math.max(0, Math.min(100, (from / Math.max(1, max)) * 100));

  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          {label && <span>{label}</span>}
          {showValue && (
            <span className="tabular-nums">
              {value} / {max}
            </span>
          )}
        </div>
      )}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          key={value}
          className={cn(
            "rmd-progress-fill h-full rounded-full bg-gradient-to-r from-primary to-accent",
            barClassName,
          )}
          style={{
            ["--rmd-progress-from" as any]: `${fromPct}%`,
            ["--rmd-progress-to" as any]: `${pct}%`,
            width: `${pct}%`,
          }}
        />
      </div>
    </div>
  );
};
