import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Trophy, Zap, Star, Crown } from "lucide-react";
import type { JamSessionChallenge } from "@/hooks/useJamSessionChallenges";

interface JamSessionChallengeCardProps {
  challenge: JamSessionChallenge;
  isActive?: boolean;
  isCompleted?: boolean;
}

const DIFFICULTY_CONFIG = {
  easy: { color: "bg-green-500/20 text-green-600 border-green-500/30", icon: Zap, label: "Easy" },
  medium: { color: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30", icon: Star, label: "Medium" },
  hard: { color: "bg-orange-500/20 text-orange-600 border-orange-500/30", icon: Trophy, label: "Hard" },
  legendary: { color: "bg-purple-500/20 text-purple-600 border-purple-500/30", icon: Crown, label: "Legendary" },
};

export const JamSessionChallengeCard = ({ challenge, isActive, isCompleted }: JamSessionChallengeCardProps) => {
  const config = DIFFICULTY_CONFIG[challenge.difficulty] || DIFFICULTY_CONFIG.medium;
  const DiffIcon = config.icon;

  return (
    <Card className={`transition-all ${isActive ? "border-primary/50 ring-1 ring-primary/20" : ""} ${isCompleted ? "opacity-60" : ""}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold">{challenge.name}</span>
          </div>
          <Badge variant="outline" className={`text-xs ${config.color}`}>
            <DiffIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{challenge.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Min {challenge.min_participants} players
          </span>
          <Badge variant="secondary" className="text-xs">
            +{challenge.xp_bonus_pct}% XP
          </Badge>
        </div>
        {isCompleted && (
          <Badge className="w-full justify-center bg-green-500/20 text-green-600 border-green-500/30">
            ✓ Completed
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};
