/**
 * Canonical edition runtime updates only when authoritative operations progress,
 * not on each public HTTP poll. Do not render old active-day state as current
 * after a reconnect, cache restoration or interrupted festival.
 */
const MAX_ACTIVE_AGE_MS = 30 * 60_000;
const MAX_CLOCK_SKEW_MS = 2 * 60_000;
const ACTIVE_STATES = new Set(["gates_open", "live", "paused"]);

export type FestivalLiveFreshness = "unavailable" | "stale" | "current" | "inactive";

export function festivalLiveSnapshotFreshness(
  value: unknown,
  now: number,
): FestivalLiveFreshness {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "unavailable";
  const source = value as Record<string, unknown>;
  if (typeof source.runtimeStatus !== "string" || typeof source.updatedAt !== "string") {
    return "unavailable";
  }

  const active = ACTIVE_STATES.has(source.runtimeStatus) && typeof source.currentDay === "string";
  if (!active) return "inactive";

  const timestamp = Date.parse(source.updatedAt);
  if (!Number.isFinite(timestamp) || !Number.isFinite(now) ||
    timestamp > now + MAX_CLOCK_SKEW_MS || now - timestamp > MAX_ACTIVE_AGE_MS) {
    return "stale";
  }
  return "current";
}
