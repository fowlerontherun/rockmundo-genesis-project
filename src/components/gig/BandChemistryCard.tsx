import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Heart, TrendingUp, TrendingDown, Minus, Sparkles, Zap, Users } from "lucide-react";
import { 
  getChemistryTier, 
  calculateChemistryEffects, 
  type ChemistryMoment 
} from "@/utils/bandChemistryEffects";

interface BandChemistryCardProps {
  chemistryLevel: number;
  chemistryChange: number;
  chemistryMoments?: ChemistryMoment[];
}

export function BandChemistryCard({ 
  chemistryLevel, 
  chemistryChange,
  chemistryMoments = []
}: BandChemistryCardProps) {
  const tier = getChemistryTier(chemistryLevel);
  const effects = calculateChemistryEffects(chemistryLevel);

  const getTrendIcon = () => {
    if (chemistryChange > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (chemistryChange < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="h-5 w-5 text-pink-500" />
          Band Chemistry
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chemistry Level */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${tier.color}`}>{tier.label}</span>
              <Badge variant="outline" className="text-xs">
                {getTrendIcon()}
                <span className="ml-1">
                  {chemistryChange > 0 ? '+' : ''}{chemistryChange}
                </span>
              </Badge>
            </div>
            <span className="text-2xl font-bold">{chemistryLevel}</span>
          </div>
          <Progress value={chemistryLevel} className="h-2" />
        </div>

        {/* Chemistry Effects */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4 text-yellow-500" />
            Active Effects
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between p-2 rounded bg-muted/50">
              <span className="text-muted-foreground">Performance</span>
              <span className={effects.performanceBonus >= 0 ? 'text-green-500' : 'text-red-500'}>
                {effects.performanceBonus >= 0 ? '+' : ''}{effects.performanceBonus}%
              </span>
            </div>
            <div className="flex justify-between p-2 rounded bg-muted/50">
              <span className="text-muted-foreground">Crowd Connect</span>
              <span className={effects.crowdConnectionBonus >= 0 ? 'text-green-500' : 'text-red-500'}>
                {effects.crowdConnectionBonus >= 0 ? '+' : ''}{effects.crowdConnectionBonus}%
              </span>
            </div>
            <div className="flex justify-between p-2 rounded bg-muted/50">
              <span className="text-muted-foreground">Rehearsal Eff.</span>
              <span className="text-green-500">+{effects.rehearsalEfficiency}%</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-muted/50">
              <span className="text-muted-foreground">Encore Chance</span>
              <span className="text-purple-500">{effects.encoreChance}%</span>
            </div>
          </div>
        </div>

        {/* Chemistry Moments */}
        {chemistryMoments.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Chemistry Moments
            </div>
            <div className="space-y-2">
              {chemistryMoments.map((moment, index) => (
                <div 
                  key={index}
                  className={`p-2 rounded-lg text-sm ${
                    moment.type === 'positive' ? 'bg-green-500/10 border border-green-500/20' :
                    moment.type === 'negative' ? 'bg-red-500/10 border border-red-500/20' :
                    'bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{moment.title}</span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        moment.chemistryImpact > 0 ? 'text-green-500 border-green-500/30' :
                        moment.chemistryImpact < 0 ? 'text-red-500 border-red-500/30' :
                        ''
                      }`}
                    >
                      {moment.chemistryImpact > 0 ? '+' : ''}{moment.chemistryImpact}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{moment.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chemistry Tips */}
        {chemistryLevel < 50 && (
          <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-start gap-2">
              <Users className="h-4 w-4 text-yellow-500 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-yellow-500">Improve Chemistry</p>
                <p className="text-muted-foreground">
                  Rehearse together, play successful gigs, and avoid cancellations to boost band chemistry.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
