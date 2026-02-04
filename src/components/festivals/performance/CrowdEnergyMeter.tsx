import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Flame, Sparkles, Users, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CrowdEnergyMeterProps {
  energy: number;
  history: number[];
  className?: string;
}

export function CrowdEnergyMeter({ energy, history, className }: CrowdEnergyMeterProps) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
    const timeout = setTimeout(() => setAnimate(false), 500);
    return () => clearTimeout(timeout);
  }, [energy]);

  const trend = history.length > 1 ? energy - history[history.length - 2] : 0;

  const getEnergyLevel = () => {
    if (energy >= 80) return { label: "ELECTRIC!", color: "text-yellow-500", bgColor: "bg-yellow-500" };
    if (energy >= 60) return { label: "Hyped", color: "text-orange-500", bgColor: "bg-orange-500" };
    if (energy >= 40) return { label: "Engaged", color: "text-blue-500", bgColor: "bg-blue-500" };
    if (energy >= 20) return { label: "Warming Up", color: "text-purple-500", bgColor: "bg-purple-500" };
    return { label: "Cold", color: "text-slate-500", bgColor: "bg-slate-500" };
  };

  const level = getEnergyLevel();

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className={cn("h-5 w-5", level.color)} />
            <span className="font-semibold">Crowd Energy</span>
          </div>
          <div className="flex items-center gap-2">
            {trend !== 0 && (
              <span className={cn("flex items-center text-sm", trend > 0 ? "text-green-500" : "text-red-500")}>
                {trend > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {Math.abs(trend).toFixed(0)}
              </span>
            )}
            <span className={cn("font-bold text-lg", level.color, animate && "animate-pulse")}>
              {Math.round(energy)}%
            </span>
          </div>
        </div>

        <div className="relative">
          <Progress 
            value={energy} 
            className={cn("h-6 transition-all duration-300", animate && "scale-[1.02]")}
          />
          <div 
            className={cn(
              "absolute top-0 h-6 rounded-full transition-all duration-300 flex items-center justify-center",
              level.bgColor
            )}
            style={{ width: `${energy}%` }}
          >
            {energy >= 80 && <Flame className="h-4 w-4 text-white animate-pulse" />}
            {energy >= 60 && energy < 80 && <Sparkles className="h-4 w-4 text-white" />}
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className={cn("text-sm font-medium", level.color)}>{level.label}</span>
          <span className="text-xs text-muted-foreground">
            Peak: {Math.round(Math.max(...history))}%
          </span>
        </div>

        {/* Mini energy graph */}
        <div className="mt-3 h-12 flex items-end gap-0.5">
          {history.slice(-20).map((val, idx) => (
            <div
              key={idx}
              className={cn("flex-1 rounded-t transition-all", level.bgColor, "opacity-70")}
              style={{ height: `${val}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
