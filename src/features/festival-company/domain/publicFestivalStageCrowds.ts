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
  mood: FestivalCrowdState;
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
 * Duplicate stage names still fail closed to avoid ambiguous snapshots.
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
        !FESTIVAL_CROWD_STATES.includes(item.mood as FestivalCrowdState)) {
      continue;
    }
    candidates.push({
      stageName: item.stageName.trim(),
      stageId: item.stageId,
      festivalDate: item.festivalDate,
      lastCalculatedAt: item.lastCalculatedAt,
      crowdBand: item.crowdBand as AttendanceBand,
      mood: item.mood as FestivalCrowdState,
    });
  }

  const counts = new Map<string, number>();
  for (const item of candidates) {
    const key = item.stageName.toLocaleLowerCase("en-GB");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return candidates.filter(
    (item) => counts.get(item.stageName.toLocaleLowerCase("en-GB")) === 1,
  );
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
 * Public stage IDs and runtime stage IDs belong to different namespaces.
 * Match by name only when it uniquely identifies a runtime stage.
 */
export function filterPublicFestivalStageCrowdsForUniqueStages(
  crowds: readonly PublicFestivalStageCrowd[],
  stages: readonly { name: string }[],
): PublicFestivalStageCrowd[] {
  const nameCounts = new Map<string, number>();
  for (const stage of stages) {
    const name = stage.name.trim().toLocaleLowerCase("en-GB");
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  return crowds.filter((crowd) =>
    nameCounts.get(crowd.stageName.trim().toLocaleLowerCase("en-GB")) === 1,
  );
}
