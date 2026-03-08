import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { getCityEconomicState, type CityEconomicState } from "@/utils/cityEconomy";
import { calculateInGameDate } from "@/utils/gameCalendar";

interface CityEconomyBadgeProps {
  cityName: string;
}

export const CityEconomyBadge = ({ cityName }: CityEconomyBadgeProps) => {
  const state = useMemo(() => {
    const gameDate = calculateInGameDate();
    return getCityEconomicState(cityName, gameDate.realWorldDaysElapsed);
  }, [cityName]);

  const phaseColors: Record<string, string> = {
    boom: "bg-green-500/15 text-green-600 border-green-500/30",
    growth: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    stable: "bg-muted text-muted-foreground border-border",
    recession: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    depression: "bg-red-500/15 text-red-600 border-red-500/30",
  };

  return (
    <Badge variant="outline" className={`text-[10px] ${phaseColors[state.phase] || ""}`}>
      {state.label}
    </Badge>
  );
};

export const CityEconomyCard = ({ cityName }: CityEconomyBadgeProps) => {
  const state = useMemo(() => {
    const gameDate = calculateInGameDate();
    return getCityEconomicState(cityName, gameDate.realWorldDaysElapsed);
  }, [cityName]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          City Economy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Economic Phase</span>
          <CityEconomyBadge cityName={cityName} />
        </div>
        <p className="text-xs text-muted-foreground">{state.description}</p>
        <div className="grid grid-cols-3 gap-2 pt-2">
          <div className="text-center">
            <p className="text-lg font-bold">{state.multiplier}x</p>
            <p className="text-[10px] text-muted-foreground">Earnings</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{state.costMultiplier}x</p>
            <p className="text-[10px] text-muted-foreground">Costs</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">+{Math.round(state.tourismBonus * 100)}%</p>
            <p className="text-[10px] text-muted-foreground">Tourism</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
