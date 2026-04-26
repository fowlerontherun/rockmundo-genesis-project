import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Trophy, Sparkles, Users, Target, Clock, CheckCircle2, Circle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useCoopQuestDetails } from "@/hooks/useCoopQuestDetails";
import { useActiveProfile } from "@/hooks/useActiveProfile";

interface CoopQuestDetailsDrawerProps {
  questId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CoopQuestDetailsDrawer({ questId, open, onOpenChange }: CoopQuestDetailsDrawerProps) {
  const { profileId } = useActiveProfile();
  const { data: quest, isLoading } = useCoopQuestDetails(questId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Quest details
          </SheetTitle>
          <SheetDescription>
            Click-through view of this co-op quest's players, targets, rewards and live progress.
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <p className="mt-6 text-sm text-muted-foreground">Loading quest…</p>
        )}

        {!isLoading && !quest && (
          <p className="mt-6 text-sm text-muted-foreground">
            Quest not found. It may have expired or been removed.
          </p>
        )}

        {quest && (
          <div className="mt-6 space-y-5">
            {/* Title block */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {quest.cadence}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {quest.action_type}
                </Badge>
                {quest.completed_at && (
                  <Badge className="text-[10px] bg-amber-500/20 text-amber-700 border-amber-500/30">
                    Completed
                  </Badge>
                )}
              </div>
              <h3 className="text-lg font-semibold leading-tight">{quest.title}</h3>
              <p className="text-sm text-muted-foreground">{quest.description}</p>
            </div>

            <Separator />

            {/* Players */}
            <section className="space-y-3">
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> Players
              </h4>
              <PlayerProgressRow
                label={profileId === quest.profile_a_id ? `${quest.profile_a_name ?? "You"} (You)` : (quest.profile_a_name ?? "Player A")}
                progress={quest.progress_a}
                target={quest.target_count}
                claimed={quest.claimed_by_a}
                completed={!!quest.completed_at}
              />
              <PlayerProgressRow
                label={profileId === quest.profile_b_id ? `${quest.profile_b_name ?? "You"} (You)` : (quest.profile_b_name ?? "Player B")}
                progress={quest.progress_b}
                target={quest.target_count}
                claimed={quest.claimed_by_b}
                completed={!!quest.completed_at}
              />
            </section>

            <Separator />

            {/* Target */}
            <section className="space-y-2">
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" /> Quest target
              </h4>
              <p className="text-sm">
                Each player must perform <span className="font-semibold">{quest.action_type}</span>
                {" "}<span className="font-semibold">{quest.target_count}×</span> before the quest expires.
              </p>
            </section>

            <Separator />

            {/* Reward */}
            <section className="space-y-2">
              <h4 className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Reward (each player)
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">+{quest.reward_xp} XP</Badge>
                {quest.reward_skill_xp > 0 && quest.reward_skill_slug && (
                  <Badge variant="outline" className="text-xs">
                    +{quest.reward_skill_xp} {quest.reward_skill_slug} XP
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Both players claim independently once the quest is completed.
              </p>
            </section>

            <Separator />

            {/* Timing */}
            <section className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  Started {formatDistanceToNow(new Date(quest.created_at), { addSuffix: true })}
                </span>
              </div>
              {quest.completed_at && (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-amber-500" />
                  <span>
                    Completed {formatDistanceToNow(new Date(quest.completed_at), { addSuffix: true })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  {new Date(quest.expires_at).getTime() < Date.now()
                    ? `Expired ${formatDistanceToNow(new Date(quest.expires_at), { addSuffix: true })}`
                    : `Expires ${formatDistanceToNow(new Date(quest.expires_at), { addSuffix: true })}`}
                </span>
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PlayerProgressRow({
  label,
  progress,
  target,
  claimed,
  completed,
}: {
  label: string;
  progress: number;
  target: number;
  claimed: boolean;
  completed: boolean;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((progress / target) * 100)) : 0;
  const done = progress >= target;
  return (
    <div className="rounded-md border p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {claimed ? (
            <Badge className="text-[10px] bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Claimed
            </Badge>
          ) : completed && done ? (
            <Badge className="text-[10px] bg-amber-500/20 text-amber-700 border-amber-500/30">
              Ready to claim
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              <Circle className="h-3 w-3 mr-1" /> In progress
            </Badge>
          )}
        </div>
      </div>
      <Progress value={pct} className="h-1.5" />
      <p className="text-[11px] text-muted-foreground">
        {progress} / {target} ({pct}%)
      </p>
    </div>
  );
}
