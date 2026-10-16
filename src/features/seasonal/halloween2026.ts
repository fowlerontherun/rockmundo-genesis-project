import type { HalloweenEventConfig } from "@/hooks/useSiteConfig";

export const HALLOWEEN_2026_ID = "haunted-stage-2026";
export const HALLOWEEN_2026_NAME = "The Haunted Stage 2026";

export type HalloweenEventPhase = "disabled" | "upcoming" | "active" | "ended";

/** Server-controlled and clock-bounded: no in-game calendar dependency. */
export function halloweenEventPhase(config: HalloweenEventConfig | null | undefined, at: Date = new Date()): HalloweenEventPhase {
  if (!config?.enabled || !config.rewards_live) return "disabled";
  const start = Date.parse(config.starts_at);
  const end = Date.parse(config.ends_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isFinite(at.getTime())) return "disabled";
  if (at.getTime() < start) return "upcoming";
  if (at.getTime() >= end) return "ended";
  return "active";
}

/** The end boundary is exclusive (midnight 2 November, UK time). */
export function halloweenEndLabel(config: HalloweenEventConfig): string {
  const end = Date.parse(config.ends_at);
  if (!Number.isFinite(end)) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(end - 60_000));
}

export function halloweenRemainingLabel(config: HalloweenEventConfig, now: Date = new Date()): string {
  const millis = Date.parse(config.ends_at) - now.getTime();
  if (!Number.isFinite(millis) || millis <= 0) return "Event ended";
  const hours = Math.ceil(millis / 3_600_000);
  if (hours <= 24) return `Ends in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.ceil(millis / 86_400_000);
  return `Ends in ${days} days`;
}

/** Storage key is per account, playable character and event edition. */
export function halloweenDismissalKey(userId: string, profileId: string): string {
  return `rockmundo:event-welcome:${HALLOWEEN_2026_ID}:${userId}:${profileId}`;
}
