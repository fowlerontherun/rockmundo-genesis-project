import { cn } from "@/lib/utils";

/**
 * VinylRing — a circular progress meter rendered as a vinyl record.
 * Centre label colour follows the active --fm-accent so it adopts the
 * current module hue. Use for XP, mastery %, release readiness, etc.
 */
export const VinylRing = ({
  value,
  size = 56,
  label,
  spinning = false,
  className,
}: {
  value: number; // 0-100
  size?: number;
  label?: string;
  spinning?: boolean;
  className?: string;
}) => {
  const pct = Math.max(0, Math.min(100, value));
  const stroke = Math.max(3, Math.round(size * 0.08));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <div
        className={cn("absolute inset-0 rm-vinyl", spinning && "rm-vinyl-spin")}
        aria-hidden
      />
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--fm-accent))"
          strokeWidth={stroke}
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          strokeLinecap="round"
          opacity={0.9}
        />
      </svg>
      <span
        className="relative z-[1] text-[10px] font-bold tabular-nums text-fm-fg"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
      >
        {label ?? `${Math.round(pct)}%`}
      </span>
    </div>
  );
};

export default VinylRing;
