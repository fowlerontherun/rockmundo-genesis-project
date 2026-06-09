import { cn } from "@/lib/utils";

/**
 * Color-coded attribute cell on a 0-20 scale (FM-style).
 * Green ≥ 15, Yellow 8-14, Red < 8.
 */
export const AttrCell = ({ value, max = 20, className }: { value: number; max?: number; className?: string }) => {
  const scaled = max === 20 ? value : Math.round((value / max) * 20);
  const tone =
    scaled >= 15 ? "text-fm-good"
    : scaled >= 8 ? "text-fm-warn"
    : "text-fm-bad";
  return (
    <span className={cn("inline-block w-7 text-right tabular-nums font-semibold", tone, className)}>
      {scaled}
    </span>
  );
};

export const StatBar = ({ value, max = 100, tone }: { value: number; max?: number; tone?: "good" | "warn" | "bad" }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const autoTone = pct >= 70 ? "bg-fm-good" : pct >= 40 ? "bg-fm-warn" : "bg-fm-bad";
  const cls = tone === "good" ? "bg-fm-good" : tone === "warn" ? "bg-fm-warn" : tone === "bad" ? "bg-fm-bad" : autoTone;
  return (
    <div className="w-full h-1.5 rounded-sm bg-fm-panel-2 overflow-hidden">
      <div className={cn("h-full", cls)} style={{ width: `${pct}%` }} />
    </div>
  );
};
