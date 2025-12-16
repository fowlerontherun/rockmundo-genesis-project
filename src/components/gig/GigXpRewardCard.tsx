import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Star, Users, Trophy, TrendingUp, Zap } from "lucide-react";
import type { GigXpSummary, PlayerGigXpResult } from "@/utils/gigXpCalculator";

interface GigXpRewardCardProps {
  xpSummary: GigXpSummary | null;
  performanceGrade: string;
}

export function GigXpRewardCard({ xpSummary, performanceGrade }: GigXpRewardCardProps) {
  if (!xpSummary || xpSummary.playerResults.length === 0) {
    return null;
  }

  const { totalXpAwarded, playerResults, xpBreakdown } = xpSummary;
  const gradeColors: Record<string, string> = {
    'S+': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    'S': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    'A': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    'B': 'bg-green-500/20 text-green-400 border-green-500/50',
    'C': 'bg-muted text-muted-foreground border-border',
    'D': 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    'F': 'bg-red-500/20 text-red-400 border-red-500/50',
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          XP Rewards
          <Badge className={`ml-auto ${gradeColors[performanceGrade] || gradeColors['C']}`}>
            Grade {performanceGrade}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total XP */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-sm font-medium">Total XP Earned</span>
          <span className="text-2xl font-bold text-primary">+{totalXpAwarded.toLocaleString()}</span>
        </div>

        {/* XP Breakdown */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Breakdown</h4>
          <div className="grid grid-cols-2 gap-2">
            <XpBreakdownItem
              icon={<Star className="h-4 w-4" />}
              label="Base XP"
              value={xpBreakdown.baseXp}
            />
            <XpBreakdownItem
              icon={<TrendingUp className="h-4 w-4" />}
              label="Performance"
              value={xpBreakdown.performanceBonus}
            />
            <XpBreakdownItem
              icon={<Users className="h-4 w-4" />}
              label="Crowd Bonus"
              value={xpBreakdown.crowdBonus}
            />
            <XpBreakdownItem
              icon={<Trophy className="h-4 w-4" />}
              label="Milestones"
              value={xpBreakdown.milestoneBonus}
              highlight={xpBreakdown.milestoneBonus > 0}
            />
          </div>
        </div>

        {/* Per-Player Results */}
        {playerResults.length > 1 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Per Member</h4>
            <div className="space-y-2">
              {playerResults.map((result, idx) => (
                <PlayerXpRow key={result.userId || idx} result={result} />
              ))}
            </div>
          </div>
        )}

        {/* Milestones Unlocked */}
        {playerResults.some(r => r.milestonesUnlocked.length > 0) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Milestones Unlocked!
            </h4>
            <div className="flex flex-wrap gap-2">
              {playerResults.flatMap(r => r.milestonesUnlocked).map((milestone, idx) => (
                <Badge key={idx} variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                  {milestone}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Skill Improvements */}
        {playerResults.some(r => r.skillImprovementAmount > 0) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              Skills Improved
            </h4>
            <div className="flex flex-wrap gap-2">
              {playerResults
                .filter(r => r.skillImprovementAmount > 0)
                .map((result, idx) => (
                  <Badge key={idx} variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                    {result.skillTypeImproved} +{result.skillImprovementAmount}
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function XpBreakdownItem({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-md ${highlight ? 'bg-yellow-500/10' : 'bg-muted/50'}`}>
      <span className={highlight ? 'text-yellow-500' : 'text-muted-foreground'}>{icon}</span>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${highlight ? 'text-yellow-400' : ''}`}>+{value}</p>
      </div>
    </div>
  );
}

function PlayerXpRow({ result }: { result: PlayerGigXpResult }) {
  const multiplierColor = result.xpMultiplier >= 2 ? 'text-yellow-400' : result.xpMultiplier >= 1.5 ? 'text-purple-400' : 'text-muted-foreground';

  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Star className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Band Member</p>
          {result.xpMultiplier !== 1 && (
            <p className={`text-xs ${multiplierColor}`}>
              {result.xpMultiplier}x multiplier
            </p>
          )}
        </div>
      </div>
      <span className="text-lg font-bold text-primary">+{result.totalXp}</span>
    </div>
  );
}
