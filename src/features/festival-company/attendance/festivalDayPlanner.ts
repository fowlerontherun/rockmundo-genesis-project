export type FestivalPlanActivityType = "watch_act" | "eat" | "drink" | "explore" | "rest";
export type FestivalPlanItemStatus = "planned" | "missed" | "cancelled";

export interface FestivalPlanDay {
  date: string;
  dayNumber: number;
}

export interface FestivalPlanItem {
  id: string;
  attendanceId: string;
  festivalEditionId: string;
  festivalDate: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: 30 | 60 | 90;
  activityType: FestivalPlanActivityType;
  title: string;
  status: FestivalPlanItemStatus;
  resolvedAt: string | null;
  createdAt: string;
}

export interface FestivalNextPlanItem {
  id: string;
  festivalDate: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: 30 | 60 | 90;
  activityType: FestivalPlanActivityType;
  title: string;
  status: "planned";
}

export interface FestivalDayPlan {
  attendanceId: string;
  festivalEditionId: string;
  festivalName: string;
  startsOn: string;
  endsOn: string;
  timezone: string;
  cityName: string;
  festivalLocalDate: string;
  festivalLocalTime: string;
  festivalLocalDateTime: string;
  festivalDayNumber: number;
  totalFestivalDays: number;
  days: FestivalPlanDay[];
  items: FestivalPlanItem[];
  nextActivity: FestivalNextPlanItem | null;
  serverNow: string;
}

export interface CreateFestivalPlanItemInput {
  attendanceId: string;
  festivalDate: string;
  localStart: string;
  durationMinutes: 30 | 60 | 90;
  activityType: FestivalPlanActivityType;
  title: string;
  idempotencyKey: string;
}

export interface FestivalPlanMutationResult {
  id: string;
  status: FestivalPlanItemStatus;
  startsAt?: string;
  endsAt?: string;
  duplicate?: boolean;
  alreadyCancelled?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}:\d{2}$/;
const ACTIVITY_TYPES = new Set<FestivalPlanActivityType>(["watch_act", "eat", "drink", "explore", "rest"]);
const ITEM_STATUSES = new Set<FestivalPlanItemStatus>(["planned", "missed", "cancelled"]);
const DURATIONS = new Set([30, 60, 90]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);
const isDate = (value: unknown): value is string => typeof value === "string" && DATE_RE.test(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";
const isPositiveInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const isDuration = (value: unknown): value is 30 | 60 | 90 => typeof value === "number" && DURATIONS.has(value);
const isActivityType = (value: unknown): value is FestivalPlanActivityType =>
  typeof value === "string" && ACTIVITY_TYPES.has(value as FestivalPlanActivityType);
const isItemStatus = (value: unknown): value is FestivalPlanItemStatus =>
  typeof value === "string" && ITEM_STATUSES.has(value as FestivalPlanItemStatus);

const parseDay = (value: unknown): FestivalPlanDay => {
  if (!isRecord(value) || !isDate(value.date) || !isPositiveInteger(value.dayNumber)) {
    throw new Error("malformed_festival_day_plan");
  }
  return { date: value.date, dayNumber: value.dayNumber };
};

const parsePlanItem = (value: unknown): FestivalPlanItem => {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    !isUuid(value.attendanceId) ||
    !isUuid(value.festivalEditionId) ||
    !isDate(value.festivalDate) ||
    !isString(value.startsAt) ||
    !isString(value.endsAt) ||
    !isDuration(value.durationMinutes) ||
    !isActivityType(value.activityType) ||
    !isString(value.title) ||
    !isItemStatus(value.status) ||
    !isNullableString(value.resolvedAt) ||
    !isString(value.createdAt)
  ) {
    throw new Error("malformed_festival_day_plan");
  }

  return {
    id: value.id,
    attendanceId: value.attendanceId,
    festivalEditionId: value.festivalEditionId,
    festivalDate: value.festivalDate,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    durationMinutes: value.durationMinutes,
    activityType: value.activityType,
    title: value.title,
    status: value.status,
    resolvedAt: value.resolvedAt,
    createdAt: value.createdAt,
  };
};

const parseNextItem = (value: unknown): FestivalNextPlanItem | null => {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    !isDate(value.festivalDate) ||
    !isString(value.startsAt) ||
    !isString(value.endsAt) ||
    !isDuration(value.durationMinutes) ||
    !isActivityType(value.activityType) ||
    !isString(value.title) ||
    value.status !== "planned"
  ) {
    throw new Error("malformed_festival_day_plan");
  }

  return {
    id: value.id,
    festivalDate: value.festivalDate,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    durationMinutes: value.durationMinutes,
    activityType: value.activityType,
    title: value.title,
    status: "planned",
  };
};

export const parseFestivalDayPlan = (value: unknown): FestivalDayPlan => {
  if (!isRecord(value)) throw new Error("malformed_festival_day_plan");

  if (
    !isUuid(value.attendanceId) ||
    !isUuid(value.festivalEditionId) ||
    !isString(value.festivalName) ||
    !isDate(value.startsOn) ||
    !isDate(value.endsOn) ||
    !isString(value.timezone) ||
    !isString(value.cityName) ||
    !isDate(value.festivalLocalDate) ||
    !isString(value.festivalLocalTime) ||
    !TIME_RE.test(value.festivalLocalTime) ||
    !isString(value.festivalLocalDateTime) ||
    !isPositiveInteger(value.festivalDayNumber) ||
    !isPositiveInteger(value.totalFestivalDays) ||
    !Array.isArray(value.days) ||
    !Array.isArray(value.items) ||
    !isString(value.serverNow)
  ) {
    throw new Error("malformed_festival_day_plan");
  }

  const days = value.days.map(parseDay);
  const items = value.items.map(parsePlanItem);

  if (value.festivalDayNumber > value.totalFestivalDays || days.length !== value.totalFestivalDays) {
    throw new Error("malformed_festival_day_plan");
  }

  return {
    attendanceId: value.attendanceId,
    festivalEditionId: value.festivalEditionId,
    festivalName: value.festivalName,
    startsOn: value.startsOn,
    endsOn: value.endsOn,
    timezone: value.timezone,
    cityName: value.cityName,
    festivalLocalDate: value.festivalLocalDate,
    festivalLocalTime: value.festivalLocalTime,
    festivalLocalDateTime: value.festivalLocalDateTime,
    festivalDayNumber: value.festivalDayNumber,
    totalFestivalDays: value.totalFestivalDays,
    days,
    items,
    nextActivity: parseNextItem(value.nextActivity),
    serverNow: value.serverNow,
  };
};

export const normalizeFestivalLocalStart = (value: string): string => {
  const normalized = value.length === 5 ? `${value}:00` : value;
  if (!TIME_RE.test(normalized)) throw new Error("festival_plan_start_invalid");
  return normalized;
};
