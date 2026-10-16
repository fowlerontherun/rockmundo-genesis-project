import { Sparkles, Trophy } from "lucide-react";

type HalloweenBreakdown = {
  halloween_2026?: {
    applied?: boolean;
    event_id?: string;
    performance_pct?: number;
    qualifying_members?: number;
  };
  halloween_2026_first_rewards?: {
    awarded_profiles?: string[];
    xp_each?: number;
  };
};

/** Only shows authoritative, persisted post-settlement outcomes. */
export function HalloweenGigRewardSummary({
  xpBreakdown,
  profileId,
}: {
  xpBreakdown?: unknown;
  profileId?: string | null;
}) {
  const saved = xpBreakdown && typeof xpBreakdown === 'object' && !Array.isArray(xpBreakdown)
    ? xpBreakdown as HalloweenBreakdown : null;
  const seasonal = saved?.halloween_2026;
  const effect = Number(seasonal?.performance_pct);
  if (seasonal?.event_id !== "haunted-stage-2026" || !seasonal.applied
      || !Number.isFinite(effect) || effect <= 0 || effect > 15) return null;

  const firstReward = saved?.halloween_2026_first_rewards;
  const firstTime = Boolean(profileId && firstReward?.awarded_profiles?.includes(profileId));
  return (
    <section aria-label="Halloween gig rewards" className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-3">
      <h2 className="flex items-center gap-2 font-semibold">
        <Sparkles className="h-4 w-4 text-orange-400" />
        The Haunted Stage 2026
      </h2>
      <p className="mt-1 text-sm">Your band's Pumpkin Hat costumes boosted the completed performance by <strong>+{Number(effect.toFixed(2))}%</strong>.</p>
      <p className="text-xs text-muted-foreground">{seasonal.qualifying_members ?? 0} qualifying performer(s) · Performance bonus included in the gig rating.</p>
      {firstTime && (
        <p className="mt-2 flex items-start gap-2 text-sm font-semibold">
          <Trophy className="mt-0.5 h-4 w-4 text-orange-400" />
          You earned 500 bonus XP and unlocked Pumpkin Headliner 2026!
        </p>
      )}
    </section>
  );
}
