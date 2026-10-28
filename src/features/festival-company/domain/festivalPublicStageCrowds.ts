import type { FestivalPublicStage } from "./festivalLaunch";
import type { AttendanceBand, FestivalCrowdState } from "./festivalRuntime";

/**
 * The public live-experience RPC reports stage crowd bands, not headcounts.
 * Runtime stage IDs and public site-plan stage IDs are different identities;
 * matching by name is only safe where both lists contain a unique exact name.
 */
export interface FestivalPublicStageCrowd {
  crowdBand: AttendanceBand;
  mood: FestivalCrowdState;
}

export const FESTIVAL_STAGE_CROWD_BANDS: Record<AttendanceBand, { label: string; intensity: number }> = {
  quiet: { label: "Quiet", intensity: 1 },
  building: { label: "Building", intensity: 2 },
  busy: { label: "Busy", intensity: 3 },
  very_busy: { label: "Very busy", intensity: 4 },
  near_capacity: { label: "Near capacity", intensity: 5 },
  full: { label: "At capacity", intensity: 5 },
};

export const FESTIVAL_STAGE_CROWD_MOODS: Record<FestivalCrowdState, string> = {
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCrowdBand = (value: unknown): value is AttendanceBand =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(FESTIVAL_STAGE_CROWD_BANDS, value);

const isCrowdMood = (value: unknown): value is FestivalCrowdState =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(FESTIVAL_STAGE_CROWD_MOODS, value);

/**
 * Fail closed for edition mismatch, unavailable RPC data, unknown values,
 * duplicate names, and ambiguous stage mappings. Never infer a quiet crowd
 * just because no public runtime snapshot exists.
 */
export function getFestivalPublicStageCrowds(
  payload: unknown,
  festivalLaunchId: string,
  stages: Pick<FestivalPublicStage, "id" | "name">[],
): Record<string, FestivalPublicStageCrowd> {
  if (!isRecord(payload) || payload.festivalLaunchId !== festivalLaunchId || !Array.isArray(payload.stageCrowds)) {
    return {};
  }

  const stageNames = new Map<string, string[]>();
  for (const stage of stages) {
    if (!stage.name || !stage.id) continue;
    stageNames.set(stage.name, [...(stageNames.get(stage.name) ?? []), stage.id]);
  }

  const counts = new Map<string, number>();
  for (const value of payload.stageCrowds) {
    if (isRecord(value) && typeof value.stageName === "string") {
      counts.set(value.stageName, (counts.get(value.stageName) ?? 0) + 1);
    }
  }

  const results: Record<string, FestivalPublicStageCrowd> = {};
  for (const value of payload.stageCrowds) {
    if (!isRecord(value) || typeof value.stageName !== "string") continue;
    const matches = stageNames.get(value.stageName);
    if (!matches || matches.length !== 1 || counts.get(value.stageName) !== 1) continue;
    if (!isCrowdBand(value.crowdBand) || !isCrowdMood(value.mood)) continue;

    results[matches[0]] = {
      crowdBand: value.crowdBand,
      mood: value.mood,
    };
  }
  return results;
}
