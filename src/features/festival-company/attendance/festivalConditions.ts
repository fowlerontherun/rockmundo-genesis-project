import type { FestivalPlanActivityType } from "./festivalDayPlanner";

export type FestivalExecutableActivityType = Exclude<FestivalPlanActivityType, "watch_act">;

export interface FestivalConditionValues {
  energy: number;
  hunger: number;
  hydration: number;
  mood: number;
  intoxication: number;
  social: number;
}

export interface FestivalConditions extends FestivalConditionValues {
  attendanceId: string;
  festivalEditionId: string;
  lastEvolvedAt: string;
  lastActivityAt: string | null;
  serverNow: string;
}

export interface FestivalCompletedActivityResolution {
  planItemId: string;
  attendanceId: string;
  activityType: FestivalExecutableActivityType;
  durationMinutes: 30 | 60 | 90;
  status: "completed";
  before: FestivalConditionValues;
  effect: FestivalConditionValues;
  after: FestivalConditionValues;
  resolvedAt: string;
  duplicate: boolean;
}

export interface FestivalMissedActivityResolution {
  planItemId: string;
  attendanceId: string;
  activityType: FestivalExecutableActivityType;
  durationMinutes: 30 | 60 | 90;
  status: "missed";
  reason: "activity_window_missed";
  resolvedAt: string | null;
  duplicate: boolean;
}

export type FestivalActivityResolution =
  | FestivalCompletedActivityResolution
  | FestivalMissedActivityResolution;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXECUTABLE_TYPES = new Set<FestivalExecutableActivityType>(["eat", "drink", "explore", "rest"]);
const DURATIONS = new Set([30, 60, 90]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";
const isDuration = (value: unknown): value is 30 | 60 | 90 => typeof value === "number" && DURATIONS.has(value);
const isExecutableType = (value: unknown): value is FestivalExecutableActivityType =>
  typeof value === "string" && EXECUTABLE_TYPES.has(value as FestivalExecutableActivityType);
const isConditionValue = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
const isEffectValue = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= -100 && value <= 100;

const parseValues = (value: unknown, effect = false): FestivalConditionValues => {
  if (!isRecord(value)) throw new Error("malformed_festival_conditions");
  const valid = effect ? isEffectValue : isConditionValue;
  if (
    !valid(value.energy) ||
    !valid(value.hunger) ||
    !valid(value.hydration) ||
    !valid(value.mood) ||
    !valid(value.intoxication) ||
    !valid(value.social)
  ) {
    throw new Error("malformed_festival_conditions");
  }
  return {
    energy: value.energy,
    hunger: value.hunger,
    hydration: value.hydration,
    mood: value.mood,
    intoxication: value.intoxication,
    social: value.social,
  };
};

export const parseFestivalConditions = (value: unknown): FestivalConditions => {
  if (
    !isRecord(value) ||
    !isUuid(value.attendanceId) ||
    !isUuid(value.festivalEditionId) ||
    !isString(value.lastEvolvedAt) ||
    !isNullableString(value.lastActivityAt) ||
    !isString(value.serverNow)
  ) {
    throw new Error("malformed_festival_conditions");
  }
  return {
    attendanceId: value.attendanceId,
    festivalEditionId: value.festivalEditionId,
    ...parseValues(value),
    lastEvolvedAt: value.lastEvolvedAt,
    lastActivityAt: value.lastActivityAt,
    serverNow: value.serverNow,
  };
};

export const parseFestivalActivityResolution = (value: unknown): FestivalActivityResolution => {
  if (
    !isRecord(value) ||
    !isUuid(value.planItemId) ||
    !isUuid(value.attendanceId) ||
    !isExecutableType(value.activityType) ||
    !isDuration(value.durationMinutes) ||
    !isNullableString(value.resolvedAt) ||
    typeof value.duplicate !== "boolean"
  ) {
    throw new Error("malformed_festival_activity_resolution");
  }

  if (value.status === "missed") {
    if (value.reason !== "activity_window_missed") {
      throw new Error("malformed_festival_activity_resolution");
    }
    return {
      planItemId: value.planItemId,
      attendanceId: value.attendanceId,
      activityType: value.activityType,
      durationMinutes: value.durationMinutes,
      status: "missed",
      reason: "activity_window_missed",
      resolvedAt: value.resolvedAt,
      duplicate: value.duplicate,
    };
  }

  if (value.status !== "completed" || !isString(value.resolvedAt)) {
    throw new Error("malformed_festival_activity_resolution");
  }

  return {
    planItemId: value.planItemId,
    attendanceId: value.attendanceId,
    activityType: value.activityType,
    durationMinutes: value.durationMinutes,
    status: "completed",
    before: parseValues(value.before),
    effect: parseValues(value.effect, true),
    after: parseValues(value.after),
    resolvedAt: value.resolvedAt,
    duplicate: value.duplicate,
  };
};
