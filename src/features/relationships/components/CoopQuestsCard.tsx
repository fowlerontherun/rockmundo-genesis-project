import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, Sparkles, Clock, Trophy } from "lucide-react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useCoopQuests, useCreateCoopQuest, useClaimCoopQuest, type CoopQuest } from "@/hooks/useCoopQuests";
import { formatDistanceToNow } from "date-fns";

interface CoopQuestsCardProps {
  otherProfileId: string;
  otherDisplayName: string;
}

function questStatus(q: CoopQuest, myProfileId: string) {
  const isA = q.profile_a_id === myProfileId;
  const myProgress = isA ? q.progress_a : q.progress_b;
  const theirProgress = isA ? q.progress_b : q.progress_a;
  const myClaimed = isA ? q.claimed_by_a : q.claimed_by_b;
  const completed = !!q.completed_at;
  return { myProgress, theirProgress, myClaimed, completed };
}

export function CoopQuestsCard({ otherProfileId, otherDisplayName }: CoopQuestsCardProps) {
  const { profileId } = useActiveProfile();
  const { data: quests = [], isLoading } = useCoopQuests(otherProfileId);
  const createQuest = useCreateCoopQuest();
  const claimQuest = useClaimCoopQuest();

  const { hasDaily, hasWeekly } = useMemo(() => {
    return {
      hasDaily: quests.some((q) => q.cadence === "daily"),
      hasWeekly: quests.some((q) => q.cadence === "weekly"),
    };
  }, [quests]);

  if (!profileId) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Co-op quests
            </CardTitle>
            <CardDescription className="text-xs">
              Shared goals with {otherDisplayName}. Both players must contribute. Bonus XP on completion.
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={hasDaily || createQuest.isPending}
              onClick={() => createQuest.mutate({ otherProfileId, cadence: "daily" })}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Daily
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={hasWeekly || createQuest.isPending}
              onClick={() => createQuest.mutate({ otherProfileId, cadence: "weekly" })}
            >
              <Trophy className="h-3 w-3 mr-1" />
              Weekly
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-xs text-muted-foreground">Loading quests…</p>}
        {!isLoading && quests.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No active quests. Start a daily or weekly quest above for bonus XP.
          </p>
        )}
        {quests.map((q) => {
          const { myProgress, theirProgress, myClaimed, completed } = questStatus(q, profileId);
          const myPct = Math.min(100, (myProgress / q.target_count) * 100);
          const theirPct = Math.min(100, (theirProgress / q.target_count) * 100);
          const skillNote = q.reward_skill_xp > 0 && q.reward_skill_slug
            ? ` · +${q.reward_skill_xp} ${q.reward_skill_slug} XP`
            : "";

          return (
            <div key={q.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{q.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {q.cadence}
                    </Badge>
                    {completed && (
                      <Badge className="text-[10px] bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                        Completed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{q.description}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
                  +{q.reward_xp} XP{skillNote}
                </Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>You: {myProgress}/{q.target_count}</span>
                  <span>Them: {theirProgress}/{q.target_count}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Progress value={myPct} className="h-1.5" />
                  <Progress value={theirPct} className="h-1.5" />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Expires {formatDistanceToNow(new Date(q.expires_at), { addSuffix: true })}
                </span>
                {completed && !myClaimed && (
                  <Button
                    size="sm"
                    onClick={() => claimQuest.mutate(q.id)}
                    disabled={claimQuest.isPending}
                  >
                    Claim reward
                  </Button>
                )}
                {completed && myClaimed && (
                  <Badge variant="outline" className="text-[10px]">Reward claimed</Badge>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
