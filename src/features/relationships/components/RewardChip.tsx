import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import type { ActionRewardConfig } from "@/features/relationships/rewardsConfig";

export function RewardChip({ reward }: { reward: ActionRewardConfig }) {
  return (
    <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/5 text-[10px] font-medium">
      <Sparkles className="h-3 w-3" />
      +{reward.xp} XP
      {reward.skillXp > 0 && reward.skillLabel ? (
        <span className="text-muted-foreground">· +{reward.skillXp} {reward.skillLabel}</span>
      ) : null}
    </Badge>
  );
}
