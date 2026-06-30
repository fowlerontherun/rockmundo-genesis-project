/**
 * Region- and locale-based reach gating for media outlets.
 *
 * Early-game bands should only see *local* outlets (same city / same country).
 * As fame grows the visible pool widens to national, then international.
 *
 * Reach tiers (driven by band fame, aligned with BAND_FAME_THRESHOLDS):
 *  - 'local'         (fame  <  1000)  → only outlets in the player's current city,
 *                                       or country-wide outlets with audience ≤ 50k
 *  - 'regional'      (fame 1000-3499) → all outlets in the player's current country
 *  - 'national'      (fame 3500-17999) → same country + adjacent / shared-language fallbacks
 *  - 'international' (fame ≥ 18000)   → all outlets, anywhere
 */

import { BAND_FAME_THRESHOLDS } from "@/utils/bandFame";

export type ReachTier = "local" | "regional" | "national" | "international";

export interface ReachOutlet {
  city_id?: string | null;
  country?: string | null;
  /** Any aggregate audience metric — readership, circulation, listeners, viewers, traffic_rank-inverse */
  audience?: number | null;
  min_fame_required?: number | null;
}

export interface PlayerLocale {
  cityId?: string | null;
  country?: string | null;
  fame: number;
}

export interface ReachGateResult {
  /** True if the outlet is currently within the player's reach. */
  inReach: boolean;
  /** Outlet's own scope relative to the player. */
  outletScope: "local" | "national" | "international";
  /** Why it's blocked, if blocked. */
  reason?: string;
}

const SMALL_AUDIENCE = 50_000;

export function getPlayerReachTier(fame: number): ReachTier {
  if (fame < BAND_FAME_THRESHOLDS.localFavorite) return "local"; // < 1000
  if (fame < BAND_FAME_THRESHOLDS.regionalAct) return "regional"; // < 3500
  if (fame < BAND_FAME_THRESHOLDS.nationalAct) return "national"; // < 18000
  return "international";
}

export function getReachTierLabel(tier: ReachTier): string {
  switch (tier) {
    case "local": return "Local reach";
    case "regional": return "Regional reach";
    case "national": return "National reach";
    case "international": return "International reach";
  }
}

export function getNextReachTier(tier: ReachTier): { tier: ReachTier; fame: number } | null {
  if (tier === "local") return { tier: "regional", fame: BAND_FAME_THRESHOLDS.localFavorite };
  if (tier === "regional") return { tier: "national", fame: BAND_FAME_THRESHOLDS.regionalAct };
  if (tier === "national") return { tier: "international", fame: BAND_FAME_THRESHOLDS.nationalAct };
  return null;
}

export function classifyOutletScope(outlet: ReachOutlet, player: PlayerLocale): "local" | "national" | "international" {
  if (outlet.city_id && player.cityId && outlet.city_id === player.cityId) return "local";
  if (outlet.country && player.country && outlet.country === player.country) return "national";
  return "international";
}

export function evaluateReachGate(outlet: ReachOutlet, player: PlayerLocale): ReachGateResult {
  const tier = getPlayerReachTier(player.fame);
  const scope = classifyOutletScope(outlet, player);
  const fameReq = outlet.min_fame_required ?? 0;

  if (player.fame < fameReq) {
    return { inReach: false, outletScope: scope, reason: `Needs ${fameReq.toLocaleString()} fame` };
  }

  // International tier: everything visible (subject only to min_fame_required above).
  if (tier === "international") return { inReach: true, outletScope: scope };

  // National tier: same country + international outlets only if low audience.
  if (tier === "national") {
    if (scope === "international" && (outlet.audience ?? Infinity) > SMALL_AUDIENCE * 4) {
      return { inReach: false, outletScope: scope, reason: "International outlet — build international fame first" };
    }
    return { inReach: true, outletScope: scope };
  }

  // Regional tier: same country only.
  if (tier === "regional") {
    if (scope === "international") {
      return { inReach: false, outletScope: scope, reason: "Reach this country first" };
    }
    return { inReach: true, outletScope: scope };
  }

  // Local tier: same city, or same country with small audience.
  if (scope === "local") return { inReach: true, outletScope: scope };
  if (scope === "national" && (outlet.audience ?? 0) <= SMALL_AUDIENCE) {
    return { inReach: true, outletScope: scope };
  }
  if (scope === "national") {
    return { inReach: false, outletScope: scope, reason: "Too big for a local act — grow fame above 1,000" };
  }
  return { inReach: false, outletScope: scope, reason: "International outlet — start with local press" };
}
