import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Battery, BatteryLow, BatteryWarning, Zap } from "lucide-react";
import { getFatigueState, type FatigueState } from "@/utils/tourFatigue";

interface TourFatigueWidgetProps {
  consecutiveGigs: number;
}

const LEVEL_STYLES: Record<FatigueState["fatigueLevel"], { color: string; icon: typeof Zap }> = {
  fresh:     { color: "text-green-600", icon: Zap },
  normal:    { color: "text-muted-foreground", icon: Battery },
  tired:     { color: "text-yellow-600", icon: BatteryWarning },
  exhausted: { color: "text-orange-600", icon: BatteryLow },
  burnout:   { color: "text-destructive", icon: BatteryLow },
};

export const TourFatigueWidget = ({ consecutiveGigs }: TourFatigueWidgetProps) => {
  const state = useMemo(() => getFatigueState(consecutiveGigs), [consecutiveGigs]);
  const style = LEVEL_STYLES[state.fatigueLevel];
  const Icon = style.icon;

  // Invert for "energy" bar: fresh=100%, burnout=~10%
  const energyPercent = Math.round(state.performanceModifier / 1.05 * 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className={`h-4 w-4 ${style.color}`} />
          Tour Fatigue
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-lg font-bold capitalize ${style.color}`}>{state.fatigueLevel}</span>
          <Badge variant="outline" className="text-xs">{consecutiveGigs} gigs</Badge>
        </div>
        <Progress value={energyPercent} className="h-1.5" />
        <p className="text-xs text-muted-foreground">{state.description}</p>
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground pt-1">
          <div>Performance: <span className="font-medium text-foreground">{state.performanceModifier}x</span></div>
          <div>Injury risk: <span className="font-medium text-foreground">{Math.round(state.injuryRisk * 100)}%</span></div>
          <div>Morale hit: <span className="font-medium text-foreground">-{state.moraleHit}</span></div>
        </div>
        {state.needsRest && (
          <p className="text-[10px] text-destructive font-medium">⚠️ Rest day recommended!</p>
        )}
      </CardContent>
    </Card>
  );
};

export const TourFatigueBadge = ({ consecutiveGigs }: TourFatigueWidgetProps) => {
  const state = useMemo(() => getFatigueState(consecutiveGigs), [consecutiveGigs]);
  const style = LEVEL_STYLES[state.fatigueLevel];

  if (state.fatigueLevel === "fresh" || state.fatigueLevel === "normal") return null;

  return (
    <Badge variant="outline" className={`text-[10px] ${style.color}`}>
      {state.fatigueLevel === "burnout" ? "🔥 Burnout" : state.fatigueLevel === "exhausted" ? "😓 Exhausted" : "😴 Tired"}
    </Badge>
  );
};
