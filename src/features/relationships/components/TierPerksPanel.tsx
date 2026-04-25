import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Lock, CheckCircle2 } from "lucide-react";
import { FRIENDSHIP_TIERS } from "@/features/relationships/config";
import { useFriendRewardSummary } from "@/hooks/useRelationshipRewards";

interface TierPerksPanelProps {
  otherProfileId: string;
}

function tierForXp(xp: number) {
  return [...FRIENDSHIP_TIERS].reverse().find((t) => xp >= t.minAffinity) ?? FRIENDSHIP_TIERS[0];
}

export function TierPerksPanel({ otherProfileId }: TierPerksPanelProps) {
  const { data: summary, isLoading } = useFriendRewardSummary(otherProfileId);
  const xp = summary?.lifetime_xp ?? 0;
  const currentTier = tierForXp(xp);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Crown className="h-4 w-4 text-warning" /> Friendship Perks
        </CardTitle>
        <CardDescription className="text-xs">
          Unlocked benefits at each affinity tier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {FRIENDSHIP_TIERS.map((tier) => {
          const isUnlocked = !isLoading && xp >= tier.minAffinity;
          const isCurrent = tier.id === currentTier.id;
          return (
            <div
              key={tier.id}
              className={`rounded-lg border p-2.5 transition-colors ${
                isCurrent
                  ? "border-primary/50 bg-primary/5"
                  : isUnlocked
                  ? "border-border bg-card"
                  : "border-border/50 bg-muted/30 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  {isUnlocked ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold">{tier.label}</span>
                  {isCurrent && (
                    <Badge variant="secondary" className="text-[9px] py-0 h-4">CURRENT</Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {tier.maxAffinity ? `${tier.minAffinity}–${tier.maxAffinity} XP` : `${tier.minAffinity}+ XP`}
                </span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-5">
                {tier.perks.slice(0, 2).map((perk, i) => (
                  <li key={i}>• {perk}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
