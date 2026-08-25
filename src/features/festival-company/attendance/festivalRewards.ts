export interface FestivalRewardSummary {
  attendanceId: string;
  festivalEditionId: string;
  attendanceStatus: string;
  settled: boolean;
  skillXp: number;
  attributePoints: number;
  completedActivities: number;
  watchedActs: number;
  resolvedMoments: number;
  distinctActivityTypes: number;
  inspiration: number;
  settledAt: string | null;
  breakdown: Record<string, unknown>;
  serverNow: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isBoundedInteger = (value: unknown, max: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;

export const parseFestivalRewardSummary = (value: unknown): FestivalRewardSummary => {
  if (!isRecord(value)
    || typeof value.attendanceId !== "string" || !UUID_RE.test(value.attendanceId)
    || typeof value.festivalEditionId !== "string" || !UUID_RE.test(value.festivalEditionId)
    || typeof value.attendanceStatus !== "string"
    || typeof value.settled !== "boolean"
    || !isBoundedInteger(value.skillXp, 600)
    || !isBoundedInteger(value.attributePoints, 3)
    || !isBoundedInteger(value.completedActivities, 100)
    || !isBoundedInteger(value.watchedActs, 50)
    || !isBoundedInteger(value.resolvedMoments, 50)
    || !isBoundedInteger(value.distinctActivityTypes, 12)
    || !isBoundedInteger(value.inspiration, 100)
    || !(value.settledAt === null || typeof value.settledAt === "string")
    || !isRecord(value.breakdown)
    || typeof value.serverNow !== "string") {
    throw new Error("malformed_festival_reward_summary");
  }
  return value as unknown as FestivalRewardSummary;
};
