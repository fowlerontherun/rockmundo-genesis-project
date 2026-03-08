import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Gift, Zap } from "lucide-react";
import type { NightclubQuest, DialogueNode, QuestProgress } from "@/hooks/useNightclubQuests";

interface NPCDialoguePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quest: NightclubQuest;
  progress: QuestProgress | null;
  onStartQuest: () => void;
  onAdvanceDialogue: (progressId: string, nextNodeId: string | null) => void;
  onClaimRewards: (progressId: string, rewards: Record<string, any>) => void;
  isStarting: boolean;
  isAdvancing: boolean;
  isClaiming: boolean;
}

export const NPCDialoguePanel = ({
  open,
  onOpenChange,
  quest,
  progress,
  onStartQuest,
  onAdvanceDialogue,
  onClaimRewards,
  isStarting,
  isAdvancing,
  isClaiming,
}: NPCDialoguePanelProps) => {
  const dialogueNodes = useMemo(() => {
    if (!Array.isArray(quest.dialogue)) return [];
    return quest.dialogue as DialogueNode[];
  }, [quest.dialogue]);

  const currentNode = useMemo(() => {
    if (!progress || progress.status !== "active") return null;
    const state = progress.dialogue_state as { current_node_id?: string } | null;
    const nodeId = state?.current_node_id;
    if (!nodeId) return dialogueNodes[0] ?? null;
    return dialogueNodes.find((n) => n.id === nodeId) ?? null;
  }, [progress, dialogueNodes]);

  const isCompleted = progress?.status === "completed";
  const canClaim = isCompleted && !progress?.rewards_claimed;
  const isNotStarted = !progress;
  const busy = isStarting || isAdvancing || isClaiming;

  const rewardLabels = useMemo(() => {
    const r = quest.rewards as Record<string, any>;
    const parts: string[] = [];
    if (r.cash) parts.push(`$${r.cash}`);
    if (r.fame) parts.push(`${r.fame} fame`);
    if (r.xp) parts.push(`${r.xp} XP`);
    return parts;
  }, [quest.rewards]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            {quest.title}
          </SheetTitle>
          <SheetDescription>{quest.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Quest info */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Zap className="h-3 w-3" /> {quest.energy_cost} energy
            </Badge>
            {rewardLabels.map((label) => (
              <Badge key={label} variant="secondary" className="flex items-center gap-1">
                <Gift className="h-3 w-3" /> {label}
              </Badge>
            ))}
            <Badge variant="outline">{quest.quest_type}</Badge>
          </div>

          {/* Not started state */}
          {isNotStarted && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Talk to {quest.npc_id} to begin this quest.
              </p>
              <Button onClick={onStartQuest} disabled={busy} className="w-full">
                {isStarting ? "Starting..." : "Begin Quest"}
              </Button>
            </div>
          )}

          {/* Active dialogue */}
          {progress?.status === "active" && currentNode && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="text-xs font-semibold text-primary uppercase tracking-wide">
                  {currentNode.speaker}
                </div>
                <p className="text-sm">{currentNode.text}</p>
              </div>

              {currentNode.choices && currentNode.choices.length > 0 ? (
                <div className="space-y-2">
                  {currentNode.choices.map((choice) => (
                    <Button
                      key={choice.id}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left h-auto py-3 whitespace-normal"
                      disabled={busy}
                      onClick={() =>
                        onAdvanceDialogue(progress.id, choice.next_node_id)
                      }
                    >
                      {choice.text}
                    </Button>
                  ))}
                </div>
              ) : (
                <Button
                  variant="default"
                  className="w-full"
                  disabled={busy}
                  onClick={() => onAdvanceDialogue(progress.id, null)}
                >
                  {isAdvancing ? "Continuing..." : "Continue"}
                </Button>
              )}
            </div>
          )}

          {/* Completed — claim rewards */}
          {canClaim && (
            <div className="space-y-3">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-sm font-semibold">Quest Complete!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Rewards: {rewardLabels.join(", ") || "None"}
                </p>
              </div>
              <Button
                className="w-full"
                disabled={busy}
                onClick={() =>
                  onClaimRewards(progress!.id, quest.rewards as Record<string, any>)
                }
              >
                {isClaiming ? "Claiming..." : "Claim Rewards"}
              </Button>
            </div>
          )}

          {/* Already claimed */}
          {isCompleted && progress?.rewards_claimed && (
            <div className="rounded-lg border border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              ✅ Quest completed & rewards claimed
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
