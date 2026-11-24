import {
  FESTIVAL_CROWD_STATES,
  type AttendanceBand,
  type FestivalCrowdState,
} from "./festivalRuntime";

export interface PublicFestivalStageCrowd {
  stageName: string;
  stageId: string;
  festivalDate: string;
  lastCalculatedAt: string;
  crowdBand: AttendanceBand;
  mood: FestivalCrowdState | null;
}

const crowdBands: readonly AttendanceBand[] = [
  "quiet", "building", "busy", "very_busy", "near_capacity", "full",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Interpret the anonymous public experience only for the expected edition.
 *
 * Only accept snapshots dated to the festival day reported by the same
 * public endpoint. Older revisions of the RPC omitted festivalDate and
 * must fail closed instead of displaying stale data as current.
 * Match observations to the published stage UUID, independently of its name.
 * These values remain reported snapshots, not live headcounts.
 */
export function readPublicFestivalStageCrowds(
  value: unknown,
  expectedLaunchId: string,
): PublicFestivalStageCrowd[] {
  if (!isRecord(value) || value.festivalLaunchId !== expectedLaunchId ||
      typeof value.currentDay !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.currentDay) ||
      !Array.isArray(value.stageCrowds)) {
    return [];
  }

  const candidates: PublicFestivalStageCrowd[] = [];
  for (const item of value.stageCrowds) {
    if (!isRecord(item) || typeof item.stageName !== "string" ||
        !item.stageName.trim() || typeof item.stageId !== "string" ||
        !item.stageId.trim() ||
        typeof item.festivalDate !== "string" ||
        item.festivalDate !== value.currentDay ||
        typeof item.lastCalculatedAt !== "string" ||
        !Number.isFinite(Date.parse(item.lastCalculatedAt)) ||
        !crowdBands.includes(item.crowdBand as AttendanceBand) ||
        (item.mood !== null && !FESTIVAL_CROWD_STATES.includes(item.mood as FestivalCrowdState))) {
      continue;
    }
    candidates.push({
      stageName: item.stageName.trim(),
      stageId: item.stageId,
      festivalDate: item.festivalDate,
      lastCalculatedAt: item.lastCalculatedAt,
      crowdBand: item.crowdBand as AttendanceBand,
      mood: item.mood as FestivalCrowdState | null,
    });
  }

  return candidates;
}

export const festivalCrowdBandLabels: Record<AttendanceBand, string> = {
  quiet: "Quiet",
  building: "Building",
  busy: "Busy",
  very_busy: "Very busy",
  near_capacity: "Near capacity",
  full: "At capacity",
};

export const festivalCrowdMoodLabels: Record<FestivalCrowdState, string> = {
  bored: "Bored",
  restless: "Restless",
  calm: "Calm",
  interested: "Interested",
  engaged: "Engaged",
  excited: "Excited",
  jumping: "Jumping",
  ecstatic: "Ecstatic",
  tired: "Tired",
  frustrated: "Frustrated",
  leaving: "Leaving",
};

/**
 * A verified festival-wide runtime update does not certify that *each* stage
 * observation is recent. Expired rows must never animate a currently busy
 * stage merely because a different part of the festival ticked recently.
 */
export function filterFreshPublicFestivalStageCrowds(
  crowds: readonly PublicFestivalStageCrowd[],
  now: number,
  maxAgeMs = 10 * 60_000,
): PublicFestivalStageCrowd[] {
  if (!Number.isFinite(now) || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return [];
  const stageIds = new Map<string, number>();
  for (const crowd of crowds) {
    stageIds.set(crowd.stageId, (stageIds.get(crowd.stageId) ?? 0) + 1);
  }
  return crowds.filter((crowd) => {
    if (stageIds.get(crowd.stageId) !== 1) return false;
    const observed = Date.parse(crowd.lastCalculatedAt);
    const age = now - observed;
    return Number.isFinite(observed) && age >= -60_000 && age <= maxAgeMs;
  });
}
