import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Swords } from "lucide-react";
import { getRivalryState, type Rivalry } from "@/utils/bandRivalry";

interface RivalryBadgeProps {
  intensity: number;
  rivalName: string;
  rivalId: string;
}

const LEVEL_COLORS: Record<Rivalry["level"], string> = {
  none: "",
  budding: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  heated: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  fierce: "bg-red-500/15 text-red-600 border-red-500/30",
  legendary: "bg-purple-500/15 text-purple-600 border-purple-500/30",
};

export const RivalryBadge = ({ intensity, rivalName, rivalId }: RivalryBadgeProps) => {
  const state = useMemo(() => getRivalryState(intensity, rivalId, rivalName), [intensity, rivalId, rivalName]);

  if (state.level === "none") return null;

  return (
    <Badge variant="outline" className={`text-[10px] ${LEVEL_COLORS[state.level]}`}>
      <Swords className="h-3 w-3 mr-1" />
      {state.level} rivalry
    </Badge>
  );
};

interface RivalryCardProps {
  intensity: number;
  rivalName: string;
  rivalId: string;
}

export const RivalryCard = ({ intensity, rivalName, rivalId }: RivalryCardProps) => {
  const state = useMemo(() => getRivalryState(intensity, rivalId, rivalName), [intensity, rivalId, rivalName]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Swords className="h-4 w-4" />
          Rivalry: {rivalName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold capitalize">{state.level}</span>
          <Badge variant="outline" className="text-xs">{state.intensity}/100</Badge>
        </div>
        <Progress value={state.intensity} className="h-1.5" />
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
          <div>Fan boost: <span className="font-medium text-foreground">+{Math.round(state.fanBoost * 100)}%</span></div>
          <div>Media boost: <span className="font-medium text-foreground">+{Math.round(state.mediaBoost * 100)}%</span></div>
          <div>Chart bonus: <span className="font-medium text-foreground">+{Math.round(state.chartCompetitionBonus * 100)}%</span></div>
          <div>Drama risk: <span className="font-medium text-foreground">{Math.round(state.dramaRisk * 100)}%</span></div>
        </div>
      </CardContent>
    </Card>
  );
};
