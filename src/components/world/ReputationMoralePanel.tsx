import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Heart } from "lucide-react";
import { getReputationState } from "@/utils/publicImageReputation";
import { getMoraleState } from "@/utils/bandMorale";

interface ReputationMoralePanelProps {
  reputationScore: number;
  bandMorale: number;
}

export const ReputationMoralePanel = ({ reputationScore, bandMorale }: ReputationMoralePanelProps) => {
  const rep = useMemo(() => getReputationState(reputationScore), [reputationScore]);
  const morale = useMemo(() => getMoraleState(bandMorale), [bandMorale]);

  const repColor = rep.score >= 50 ? "text-green-600" : rep.score >= 0 ? "text-muted-foreground" : "text-red-600";
  const moraleColor = morale.score >= 70 ? "text-green-600" : morale.score >= 40 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Public Image
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`text-lg font-bold ${repColor}`}>{rep.label}</span>
            <Badge variant="outline" className="text-xs">{rep.score}/100</Badge>
          </div>
          <Progress value={(rep.score + 100) / 2} className="h-1.5" />
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
            <div>Sponsorship: <span className="font-medium text-foreground">{rep.sponsorshipMod}x</span></div>
            <div>Media Access: <span className="font-medium text-foreground">Lvl {rep.mediaAccessLevel}</span></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Band Morale
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`text-lg font-bold capitalize ${moraleColor}`}>{morale.level}</span>
            <Badge variant="outline" className="text-xs">{morale.score}/100</Badge>
          </div>
          <Progress value={morale.score} className="h-1.5" />
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
            <div>Performance: <span className="font-medium text-foreground">{morale.performanceModifier}x</span></div>
            <div>Creativity: <span className="font-medium text-foreground">{morale.creativityModifier}x</span></div>
          </div>
          {morale.dramaRisk > 0 && (
            <p className="text-[10px] text-destructive">⚠️ Drama risk: {Math.round(morale.dramaRisk * 100)}%</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
