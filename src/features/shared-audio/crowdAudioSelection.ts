/**
 * Deterministic crowd clip selection shared by the gig and studio viewers.
 *
 * Hash strategies preserve the legacy choices for previously archived replays
 * until selected asset IDs can be written to the canonical replay manifest.
 * Input order must not affect a selection.
 */
export type CrowdHashStrategy = "gig-fnv1a" | "studio-rolling31";

export interface CrowdClipCandidate {
  id: string;
  sound_type: string;
  intensity_level: number;
}

function hashSeed(seed: string, strategy: CrowdHashStrategy): number {
  if (strategy === "studio-rolling31") {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (Math.imul(hash, 31) + seed.charCodeAt(i)) >>> 0;
    }
    return hash;
  }
  let hash = 2166136261;
  for (const ch of seed) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function selectCrowdClip<T extends CrowdClipCandidate>(
  sounds: readonly T[],
  types: readonly string[],
  intensity: number,
  seed: string,
  strategy: CrowdHashStrategy,
  excludedIds: ReadonlySet<string> = new Set(),
): T | null {
  if (!Number.isFinite(intensity) || !types.length) return null;
  const acceptableTypes = new Set(types);
  const ordered = sounds
    .filter((sound) =>
      acceptableTypes.has(sound.sound_type) &&
      Number.isFinite(sound.intensity_level) &&
      !excludedIds.has(sound.id),
    )
    .sort((a, b) =>
      Math.abs(a.intensity_level - intensity) - Math.abs(b.intensity_level - intensity)
      || a.id.localeCompare(b.id),
    );
  if (!ordered.length) return null;
  const bestDistance = Math.abs(ordered[0].intensity_level - intensity);
  const nearest = ordered.filter(
    (sound) => Math.abs(sound.intensity_level - intensity) === bestDistance,
  );
  return nearest[hashSeed(seed, strategy) % nearest.length] ?? null;
}

/**
 * Cue-time cooldown tracker, not wall-clock time: pausing, replaying and
 * rendering the same episode produce the same eligibility decisions.
 */
export class CrowdReactionCooldown {
  private lastPlayed = new Map<string, number>();
  private lastTime = -1;

  canPlay(assetId: string, cueTimeMs: number, cooldownMs = 15_000): boolean {
    if (!assetId || !Number.isFinite(cueTimeMs) || cueTimeMs < 0) return false;
    if (cueTimeMs < this.lastTime) this.reset(); // seeking backwards is a new replay
    this.lastTime = cueTimeMs;
    const previous = this.lastPlayed.get(assetId);
    return previous === undefined || cueTimeMs - previous >= Math.max(0, cooldownMs);
  }

  record(assetId: string, cueTimeMs: number): void {
    if (!assetId || !Number.isFinite(cueTimeMs) || cueTimeMs < 0) return;
    if (cueTimeMs < this.lastTime) this.reset();
    this.lastTime = cueTimeMs;
    this.lastPlayed.set(assetId, cueTimeMs);
  }

  reset(): void {
    this.lastPlayed.clear();
    this.lastTime = -1;
  }
}
