/** Shared, deterministic crowd-cue selection for gig and broadcast timelines.
 * Pure logic: callers persist the chosen asset ID alongside the cue time.
 * Only rights-cleared enabled assets can be selected.
 */
export type CrowdCategory = "ambient" | "applause" | "cheer" | "encore" | "finale" | "reaction";
export type CrowdSize = "small" | "medium" | "large" | "any";
export type CrowdEnvironment = "pub" | "club" | "indoor" | "arena" | "festival" | "outdoor" | "studio" | "any";

export interface CrowdAudioAsset {
  id: string;
  category: CrowdCategory;
  crowd_size: CrowdSize;
  environments: CrowdEnvironment[];
  intensity: number;
  enabled: boolean;
  rights_confirmed: boolean;
}

export interface CrowdCueRequest {
  category: CrowdCategory;
  crowdSize: Exclude<CrowdSize, "any">;
  environment: Exclude<CrowdEnvironment, "any">;
  intensity: number;
  seed: string;
  /** Previously selected cues from the same playback session. */
  history?: ReadonlyArray<{ assetId: string; atSeconds: number }>;
  atSeconds: number;
  cooldownSeconds?: number;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Returns null rather than playing a wrong-sized, unlicensed or repeated cue. */
export function selectCrowdCue(
  assets: ReadonlyArray<CrowdAudioAsset>,
  request: CrowdCueRequest,
): CrowdAudioAsset | null {
  const cooldown = Math.max(0, request.cooldownSeconds ?? 30);
  const recentlyPlayed = new Set(
    (request.history ?? [])
      .filter(({ atSeconds }) => atSeconds <= request.atSeconds && request.atSeconds - atSeconds < cooldown)
      .map(({ assetId }) => assetId),
  );
  const candidates = assets.filter((asset) =>
    asset.enabled &&
    asset.rights_confirmed &&
    asset.category === request.category &&
    (asset.crowd_size === "any" || asset.crowd_size === request.crowdSize) &&
    (asset.environments.includes("any") || asset.environments.includes(request.environment)) &&
    !recentlyPlayed.has(asset.id),
  );
  if (!candidates.length) return null;
  const target = Math.max(1, Math.min(5, request.intensity));
  // Prefer matching intensity; stable ID ordering prevents DB row order changing replays.
  const ranked = [...candidates].sort((a, b) =>
    Math.abs(a.intensity - target) - Math.abs(b.intensity - target) || a.id.localeCompare(b.id),
  );
  const bestDistance = Math.abs(ranked[0].intensity - target);
  const best = ranked.filter((asset) => Math.abs(asset.intensity - target) === bestDistance);
  return best[hashSeed(request.seed) % best.length];
}
