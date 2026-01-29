// Reputation Axis Bar - Visual representation of a single reputation axis
import { cn } from "@/lib/utils";
import type { ReputationAxis } from "@/types/roleplaying";
import { Heart, Smile, Clock, Lightbulb } from "lucide-react";

interface ReputationAxisBarProps {
  axis: ReputationAxis;
  score: number; // -100 to 100
  lowLabel: string;
  highLabel: string;
  showLabels?: boolean;
  size?: "sm" | "md" | "lg";
}

const AXIS_ICONS: Record<ReputationAxis, typeof Heart> = {
  authenticity: Heart,
  attitude: Smile,
  reliability: Clock,
  creativity: Lightbulb,
};

const AXIS_COLORS: Record<ReputationAxis, { low: string; high: string }> = {
  authenticity: { low: "bg-orange-500", high: "bg-emerald-500" },
  attitude: { low: "bg-rose-500", high: "bg-sky-500" },
  reliability: { low: "bg-amber-500", high: "bg-indigo-500" },
  creativity: { low: "bg-slate-400", high: "bg-violet-500" },
};

export const ReputationAxisBar = ({
  axis,
  score,
  lowLabel,
  highLabel,
  showLabels = true,
  size = "md",
}: ReputationAxisBarProps) => {
  const Icon = AXIS_ICONS[axis];
  const colors = AXIS_COLORS[axis];
  
  // Convert -100 to 100 range to 0 to 100 percentage
  const percentage = (score + 100) / 2;
  
  // Determine which side is dominant
  const isPositive = score >= 0;
  const intensity = Math.abs(score);
  
  const sizeClasses = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };

  return (
    <div className="space-y-1.5">
      {showLabels && (
        <div className="flex items-center justify-between text-xs">
          <span className={cn(
            "font-medium transition-colors",
            !isPositive && intensity > 25 ? "text-foreground" : "text-muted-foreground"
          )}>
            {lowLabel}
          </span>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Icon className="h-3 w-3" />
            <span className="font-semibold text-foreground">
              {score > 0 ? `+${score}` : score}
            </span>
          </div>
          <span className={cn(
            "font-medium transition-colors",
            isPositive && intensity > 25 ? "text-foreground" : "text-muted-foreground"
          )}>
            {highLabel}
          </span>
        </div>
      )}
      
      <div className={cn(
        "relative w-full rounded-full bg-muted overflow-hidden",
        sizeClasses[size]
      )}>
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-border z-10 -translate-x-1/2" />
        
        {/* Fill bar - from center based on score */}
        <div
          className={cn(
            "absolute top-0 bottom-0 transition-all duration-300 rounded-full",
            isPositive ? colors.high : colors.low
          )}
          style={{
            left: isPositive ? "50%" : `${percentage}%`,
            width: `${intensity / 2}%`,
          }}
        />
      </div>
    </div>
  );
};
