import type { CrowdTuningOptions } from "@/features/gig-experience/viewer/engine/CrowdTuning";

export type TotpAudienceChoreography =
  | "tv_nervous"
  | "tv_settled"
  | "tv_warm"
  | "tv_loud"
  | "tv_roaring";

export function totpAudienceReactionLabel(score: number): "Nervous" | "Settled" | "Warm" | "Loud" | "Roaring" {
  if (score <= -2) return "Nervous";
  if (score <= 1) return "Settled";
  if (score <= 3) return "Warm";
  if (score <= 5) return "Loud";
  return "Roaring";
}

/**
 * A TV-specific movement language derived from the same immutable audience score
 * used by the broadcast replay. It is presentation-only and cannot change the
 * archived result, rewards or charts.
 */
export function totpAudienceChoreography(score: number): TotpAudienceChoreography {
  switch (totpAudienceReactionLabel(score)) {
    case "Nervous": return "tv_nervous";
    case "Settled": return "tv_settled";
    case "Warm": return "tv_warm";
    case "Loud": return "tv_loud";
    case "Roaring": return "tv_roaring";
  }
}

/**
 * Convert the locked studio-audience reaction into the shared Gig Viewer crowd controls.
 * This changes only presentation density/proximity/organic movement; it never affects
 * gameplay rewards, charts or the archived outcome.
 */
export function totpAudienceCrowdTuning(score: number): Partial<CrowdTuningOptions> {
  const clamped = Math.max(-10, Math.min(10, Number.isFinite(score) ? score : 0));
  const energy = (clamped + 10) / 20;

  return {
    densityMultiplier: 1.55 + energy * 1.55,
    depthSpread: 0.96 - energy * 0.22,
    lateralSpread: 0.96 - energy * 0.14,
    stagePull: 0.12 + energy * 0.58,
    randomness: 0.08 + energy * 0.18,
    fanScale: 0.94 + energy * 0.12,
    arrivalSpeed: 0.88 + energy * 0.42,
  };
}
