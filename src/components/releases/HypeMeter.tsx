import { Progress } from "@/components/ui/progress";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface HypeMeterProps {
  hypeScore: number;
  maxHype?: number;
  showLabel?: boolean;
  className?: string;
}

export function HypeMeter({ hypeScore, maxHype = 1000, showLabel = true, className }: HypeMeterProps) {
  const percentage = Math.min((hypeScore / maxHype) * 100, 100);
  
  const getHypeLevel = () => {
    if (hypeScore >= 800) return { label: "🔥 VIRAL", color: "text-red-500" };
    if (hypeScore >= 500) return { label: "Hot", color: "text-orange-500" };
    if (hypeScore >= 250) return { label: "Building", color: "text-yellow-500" };
    if (hypeScore >= 50) return { label: "Warming Up", color: "text-blue-400" };
    return { label: "Cold", color: "text-muted-foreground" };
  };

  const level = getHypeLevel();

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Flame className="h-3 w-3" />
            Hype
          </span>
          <span className={cn("font-medium", level.color)}>
            {hypeScore} — {level.label}
          </span>
        </div>
      )}
      <Progress 
        value={percentage} 
        className={cn(
          "h-2",
          hypeScore >= 800 ? "[&>div]:bg-red-500" :
          hypeScore >= 500 ? "[&>div]:bg-orange-500" :
          hypeScore >= 250 ? "[&>div]:bg-yellow-500" :
          "[&>div]:bg-blue-400"
        )} 
      />
    </div>
  );
}
