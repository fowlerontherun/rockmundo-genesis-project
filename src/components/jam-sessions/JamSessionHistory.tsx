import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music, Star, Zap, Gift } from "lucide-react";
import type { JamSessionOutcome } from "@/hooks/useJamSessions";
import { formatDistanceToNow } from "date-fns";

interface JamSessionHistoryProps {
  outcomes: JamSessionOutcome[];
}

export const JamSessionHistory = ({ outcomes }: JamSessionHistoryProps) => {
  if (!outcomes.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Jam History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Music className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No jam sessions completed yet.</p>
            <p className="text-sm">Join a session to start earning XP!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalXp = outcomes.reduce((sum, o) => sum + o.xp_earned, 0);
  const totalChemistry = outcomes.reduce((sum, o) => sum + o.chemistry_gained, 0);
  const avgRating = Math.round(outcomes.reduce((sum, o) => sum + o.performance_rating, 0) / outcomes.length);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          Your Jam History
          <Badge variant="secondary">{outcomes.length} sessions</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <Zap className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{totalXp}</p>
            <p className="text-xs text-muted-foreground">Total XP</p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3 text-center">
            <Star className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <p className="text-lg font-bold">{avgRating}%</p>
            <p className="text-xs text-muted-foreground">Avg Rating</p>
          </div>
          <div className="bg-purple-500/10 rounded-lg p-3 text-center">
            <Gift className="h-5 w-5 mx-auto text-purple-500 mb-1" />
            <p className="text-lg font-bold">{totalChemistry}</p>
            <p className="text-xs text-muted-foreground">Chemistry</p>
          </div>
        </div>

        {/* Recent Sessions */}
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {outcomes.map((outcome) => (
              <div
                key={outcome.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{outcome.performance_rating}%</Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(outcome.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>+{outcome.xp_earned} XP</span>
                    <span>+{outcome.chemistry_gained} Chemistry</span>
                    {outcome.skill_xp_gained > 0 && (
                      <span>+{outcome.skill_xp_gained} Skill XP</span>
                    )}
                  </div>
                </div>
                {outcome.gifted_song_id && (
                  <Badge className="bg-yellow-500/20 text-yellow-600">
                    <Gift className="h-3 w-3 mr-1" />
                    Song Gift!
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
