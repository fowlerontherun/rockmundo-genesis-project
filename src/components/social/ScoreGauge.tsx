// Reusable radial/linear gauge for social scores
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ScoreGaugeProps {
  value: number;       // 0-100 (or -100 to 100 for affection)
  max?: number;
  min?: number;
  label: string;
  sublabel?: string;
  color?: string;      // Tailwind color class like "social-love"
  size?: "sm" | "md" | "lg";
  variant?: "bar" | "ring";
  showValue?: boolean;
  glowOnHigh?: boolean;
  className?: string;
}

const COLOR_MAP: Record<string, string> = {
  "social-love": "bg-social-love",
  "social-tension": "bg-social-tension",
  "social-chemistry": "bg-social-chemistry",
  "social-trust": "bg-social-trust",
  "social-loyalty": "bg-social-loyalty",
  "social-jealousy": "bg-social-jealousy",
  "social-attraction": "bg-social-attraction",
  "social-drama": "bg-social-drama",
  "social-warm": "bg-social-warm",
  "social-cold": "bg-social-cold",
  "primary": "bg-primary",
  "success": "bg-success",
  "warning": "bg-warning",
  "destructive": "bg-destructive",
};

const GLOW_MAP: Record<string, string> = {
  "social-love": "shadow-love",
  "social-tension": "shadow-tension-glow",
  "social-chemistry": "shadow-chemistry-glow",
  "social-trust": "shadow-electric",
  "primary": "shadow-electric",
};

const SIZE_MAP = {
  sm: { bar: "h-1.5", ring: 48, text: "text-xs" },
  md: { bar: "h-2.5", ring: 64, text: "text-sm" },
  lg: { bar: "h-3.5", ring: 80, text: "text-base" },
};

export function ScoreGauge({
  value,
  max = 100,
  min = 0,
  label,
  sublabel,
  color = "primary",
  size = "md",
  variant = "bar",
  showValue = true,
  glowOnHigh = true,
  className,
}: ScoreGaugeProps) {
  const range = max - min;
  const normalizedValue = Math.max(0, Math.min(100, ((value - min) / range) * 100));
  const isHigh = normalizedValue >= 75;
  const colorClass = COLOR_MAP[color] ?? "bg-primary";
  const glowClass = glowOnHigh && isHigh ? (GLOW_MAP[color] ?? "") : "";
  const sizeConfig = SIZE_MAP[size];

  if (variant === "ring") {
    const ringSize = sizeConfig.ring;
    const strokeWidth = size === "sm" ? 4 : size === "md" ? 5 : 6;
    const radius = (ringSize - strokeWidth * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (normalizedValue / 100) * circumference;

    return (
      <div className={cn("flex flex-col items-center gap-1", className)}>
        <div className={cn("relative", glowClass && "rounded-full")} style={{ width: ringSize, height: ringSize }}>
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              strokeWidth={strokeWidth}
              fill="none"
              className="stroke-muted"
            />
            <motion.circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              className={cn(
                colorClass.replace("bg-", "stroke-"),
              )}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              strokeDasharray={circumference}
            />
          </svg>
          {showValue && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn("font-bold font-oswald", sizeConfig.text)}>
                {Math.round(value)}
              </span>
            </div>
          )}
        </div>
        <span className={cn("text-muted-foreground text-center leading-tight", size === "sm" ? "text-[10px]" : "text-xs")}>
          {label}
        </span>
        {sublabel && (
          <span className="text-[10px] text-muted-foreground/70">{sublabel}</span>
        )}
      </div>
    );
  }

  // Bar variant
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        <span className={cn("font-medium", sizeConfig.text)}>{label}</span>
        {showValue && (
          <span className={cn("text-muted-foreground font-oswald", sizeConfig.text)}>
            {Math.round(value)}{max !== 100 ? `/${max}` : ""}
          </span>
        )}
      </div>
      {sublabel && (
        <span className="text-[10px] text-muted-foreground">{sublabel}</span>
      )}
      <div className={cn("w-full rounded-full bg-muted overflow-hidden", sizeConfig.bar, glowClass)}>
        <motion.div
          className={cn("h-full rounded-full transition-colors", colorClass)}
          initial={{ width: 0 }}
          animate={{ width: `${normalizedValue}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
