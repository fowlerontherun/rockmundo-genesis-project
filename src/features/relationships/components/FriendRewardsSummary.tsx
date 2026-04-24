import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Sparkles, GraduationCap } from "lucide-react";
import { useFriendRewardSummary } from "@/hooks/useRelationshipRewards";
import { FRIENDSHIP_TIERS } from "../config";

const TIER_LABEL: Record<string, string> = {
  "acquaintance": "Acquaintance",
  "bandmate": "Bandmate",
  "inner-circle": "Inner Circle",
  "legendary-duo": "Legendary Duo",
};

const TIER_BONUS: Record<string, string> = {
  "acquaintance": "No co-op bonus yet",
  "bandmate": "+5% XP on shared gigs/jams/sessions",
  "inner-circle": "+10% XP & +5% cash on shared activities",
  "legendary-duo": "+15% XP, +10% cash, +5% fame on shared activities",
};

interface FriendRewardsSummaryProps {
  otherProfileId: string;
  otherDisplayName: string;
  onTeach?: () => void;
}

export function FriendRewardsSummary({ otherProfileId, otherDisplayName, onTeach }: FriendRewardsSummaryProps) {
  const { data } = useFriendRewardSummary(otherProfileId);
  const lifetime = data?.lifetime_xp ?? 0;
  const tier = data?.tier ?? "acquaintance";
  const tierIndex = FRIENDSHIP_TIERS.findIndex((t) => t.id === tier);
  const nextTier = tierIndex >= 0 ? FRIENDSHIP_TIERS[tierIndex + 1] ?? null : null;
  const progressToNext = nextTier
    ? Math.min(1, Math.max(0, (lifetime - (FRIENDSHIP_TIERS[tierIndex]?.minAffinity ?? 0)) /
        (nextTier.minAffinity - (FRIENDSHIP_TIERS[tierIndex]?.minAffinity ?? 0))))
    : 1;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-primary" />
          Rewards earned with {otherDisplayName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-semibold">{lifetime.toLocaleString()} XP</p>
            <p className="text-xs text-muted-foreground">Lifetime XP from this friendship</p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" /> {TIER_LABEL[tier]}
          </Badge>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">{TIER_BONUS[tier]}</span>
            {nextTier && (
              <span className="font-medium">
                {lifetime}/{nextTier.minAffinity} → {TIER_LABEL[nextTier.id]}
              </span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all"
              style={{ width: `${Math.round(progressToNext * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-dashed p-2 text-xs">
          <span className="text-muted-foreground">{data?.recent_actions ?? 0} actions in the last 7 days</span>
          {onTeach && (
            <button
              onClick={onTeach}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <GraduationCap className="h-3.5 w-3.5" /> Teach a skill
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
