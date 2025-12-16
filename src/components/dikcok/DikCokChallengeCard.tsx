import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Clock, Users, Gift, Sparkles, ChevronRight } from "lucide-react";
import { formatDistanceToNow, isPast, parseISO } from "date-fns";
import { DikCokChallenge } from "@/types/dikcok";

interface DikCokChallengeCardProps {
  challenge: DikCokChallenge;
  onEnter?: () => void;
  hasEntered?: boolean;
}

export const DikCokChallengeCard = ({ challenge, onEnter, hasEntered }: DikCokChallengeCardProps) => {
  const isExpired = isPast(parseISO(challenge.endsAt));
  const startsAt = parseISO(challenge.startsAt);
  const endsAt = parseISO(challenge.endsAt);
  const now = new Date();
  
  const totalDuration = endsAt.getTime() - startsAt.getTime();
  const elapsed = now.getTime() - startsAt.getTime();
  const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

  return (
    <Card className={`overflow-hidden ${isExpired ? "opacity-60" : ""}`}>
      <div className="h-2 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500" />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              {challenge.name}
            </CardTitle>
            <Badge variant="secondary">{challenge.theme}</Badge>
          </div>
          {challenge.sponsor && (
            <Badge variant="outline" className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
              <Sparkles className="h-3 w-3 mr-1" />
              Sponsored
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time Progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isExpired ? "Ended" : `Ends ${formatDistanceToNow(endsAt, { addSuffix: true })}`}
            </span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Requirements */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Requirements</span>
          <ul className="space-y-1">
            {challenge.requirements.map((req, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                <ChevronRight className="h-3 w-3" />
                {req}
              </li>
            ))}
          </ul>
        </div>

        {/* Rewards */}
        <div className="space-y-2">
          <span className="text-sm font-medium flex items-center gap-1">
            <Gift className="h-4 w-4 text-green-500" />
            Rewards
          </span>
          <div className="flex flex-wrap gap-1">
            {challenge.rewards.map((reward, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {reward}
              </Badge>
            ))}
          </div>
        </div>

        {/* Cross-game hook */}
        {challenge.crossGameHook && (
          <p className="text-xs text-purple-400 italic">
            ✨ {challenge.crossGameHook}
          </p>
        )}

        {/* Action Button */}
        {!isExpired && (
          <Button
            onClick={onEnter}
            disabled={hasEntered}
            className="w-full"
            variant={hasEntered ? "secondary" : "default"}
          >
            {hasEntered ? (
              <>
                <Users className="h-4 w-4 mr-2" />
                Entered
              </>
            ) : (
              <>
                <Trophy className="h-4 w-4 mr-2" />
                Enter Challenge
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
