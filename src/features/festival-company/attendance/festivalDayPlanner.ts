export type FestivalPlanActivityType =
  | "watch_act"
  | "eat"
  | "drink"
  | "explore"
  | "rest"
  | "camping"
  | "vip"
  | "vendor"
  | "free_time";
export type FestivalPlanItemStatus = "planned" | "completed" | "missed" | "cancelled";
export type FestivalPlanItemSource = "manual" | "stage_schedule";
export type FestivalManualDuration = 30 | 60 | 90;

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
  durationMinutes: number;
  activityType: FestivalPlanActivityType;
  title: string;
  status: FestivalPlanItemStatus;
  resolvedAt: string | null;
  createdAt: string;
  source: FestivalPlanItemSource;
  scheduleItemId: string | null;
  stageId: string | null;
  locationKey: string;
  locationLabel: string;
  travelBeforeMinutes: number;
  travelAfterMinutes: number;
}

export interface FestivalNextPlanItem {
  id: string;
  festivalDate: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  activityType: FestivalPlanActivityType;
  title: string;
  status: "planned";
  source: FestivalPlanItemSource;
  scheduleItemId: string | null;
  stageId: string | null;
  locationKey: string;
  locationLabel: string;
  travelBeforeMinutes: number;
  travelAfterMinutes: number;
}

export interface CreateFestivalPlanItemInput {
  attendanceId: string;
  festivalDate: string;
  localStart: string;
  durationMinutes: FestivalManualDuration;
  activityType: FestivalPlanActivityType;
  title: string;
  idempotencyKey: string;
}

export interface PreviewFestivalPlanItemInput {
  attendanceId: string;
  festivalDate: string;
  localStart: string;
  durationMinutes: FestivalManualDuration;
  activityType: FestivalPlanActivityType;
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

export interface FestivalPlanMutationResult {
  id: string;
  status: FestivalPlanItemStatus;
  startsAt?: string;
  endsAt?: string;
  duplicate?: boolean;
  alreadyCancelled?: boolean;
}

export interface FestivalPlanMessage {
  code: string;
  message: string;
  minutes?: number;
  conflictingItemId?: string;
  requiredTravelMinutes?: number;
}

export interface FestivalPlanPreview {
  feasible: boolean;
  startsAt: string;
  endsAt: string;
  locationKey: string;
  locationLabel: string;
  travelBeforeMinutes: number;
  travelAfterMinutes: number;
  blockers: FestivalPlanMessage[];
  warnings: FestivalPlanMessage[];
}

export interface FestivalStageScheduleItem {
  id: string;
  festivalDate: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  stageId: string;
  stageName: string;
  artistName: string;
  title: string;
  locationKey: string;
  isPlanned: boolean;
  plannedItemId: string | null;
}

export interface FestivalStageSchedule {
  attendanceId: string;
  festivalEditionId: string;
  revisionId: string | null;
  scheduleState: "published" | "locked" | null;
  scheduleAvailable: boolean;
  timezone: string;
  days: FestivalPlanDay[];
  items: FestivalStageScheduleItem[];
  serverNow: string;
}

export interface FestivalStagePlanPreview extends FestivalPlanPreview {
  scheduleItemId: string;
  stageId: string;
  stageName: string;
  artistName: string;
  title: string;
  festivalDate: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}:\d{2}$/;
const ACTIVITY_TYPES = new Set<FestivalPlanActivityType>([
  "watch_act",
  "eat",
  "drink",
  "explore",
  "rest",
  "camping",
  "vip",
  "vendor",
  "free_time",
]);
const ITEM_STATUSES = new Set<FestivalPlanItemStatus>(["planned", "completed", "missed", "cancelled"]);
const SOURCES = new Set<FestivalPlanItemSource>(["manual", "stage_schedule"]);
const MANUAL_DURATIONS = new Set([30, 60, 90]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);
const isNullableUuid = (value: unknown): value is string | null => value === null || isUuid(value);
const isDate = (value: unknown): value is string => typeof value === "string" && DATE_RE.test(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";
const isPositiveInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const isDuration = (value: unknown): value is number => isPositiveInteger(value) && value <= 360;
const isTravelMinutes = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 120;
const isManualDuration = (value: unknown): value is FestivalManualDuration =>
  typeof value === "number" && MANUAL_DURATIONS.has(value);
const isActivityType = (value: unknown): value is FestivalPlanActivityType =>
  typeof value === "string" && ACTIVITY_TYPES.has(value as FestivalPlanActivityType);
const isItemStatus = (value: unknown): value is FestivalPlanItemStatus =>
  typeof value === "string" && ITEM_STATUSES.has(value as FestivalPlanItemStatus);
const isSource = (value: unknown): value is FestivalPlanItemSource =>
  typeof value === "string" && SOURCES.has(value as FestivalPlanItemSource);

const parseDay = (value: unknown): FestivalPlanDay => {
  if (!isRecord(value) || !isDate(value.date) || !isPositiveInteger(value.dayNumber)) {
    throw new Error("malformed_festival_day_plan");
  }
  return { date: value.date, dayNumber: value.dayNumber };
};

const parsePlanMessage = (value: unknown): FestivalPlanMessage => {
  if (!isRecord(value) || !isString(value.code) || !isString(value.message)) {
    throw new Error("malformed_festival_plan_preview");
  }
  if (value.minutes !== undefined && !isTravelMinutes(value.minutes)) {
    throw new Error("malformed_festival_plan_preview");
  }
  if (value.requiredTravelMinutes !== undefined && !isTravelMinutes(value.requiredTravelMinutes)) {
    throw new Error("malformed_festival_plan_preview");
  }
  if (value.conflictingItemId !== undefined && !isUuid(value.conflictingItemId)) {
    throw new Error("malformed_festival_plan_preview");
  }
  return {
    code: value.code,
    message: value.message,
    ...(value.minutes !== undefined ? { minutes: value.minutes as number } : {}),
    ...(value.requiredTravelMinutes !== undefined
      ? { requiredTravelMinutes: value.requiredTravelMinutes as number }
      : {}),
    ...(value.conflictingItemId !== undefined ? { conflictingItemId: value.conflictingItemId as string } : {}),
  };
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
    !isString(value.createdAt) ||
    !isSource(value.source) ||
    !isNullableUuid(value.scheduleItemId) ||
    !isNullableUuid(value.stageId) ||
    !isString(value.locationKey) ||
    !isString(value.locationLabel) ||
    !isTravelMinutes(value.travelBeforeMinutes) ||
    !isTravelMinutes(value.travelAfterMinutes)
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
    source: value.source,
    scheduleItemId: value.scheduleItemId,
    stageId: value.stageId,
    locationKey: value.locationKey,
    locationLabel: value.locationLabel,
    travelBeforeMinutes: value.travelBeforeMinutes,
    travelAfterMinutes: value.travelAfterMinutes,
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
    value.status !== "planned" ||
    !isSource(value.source) ||
    !isNullableUuid(value.scheduleItemId) ||
    !isNullableUuid(value.stageId) ||
    !isString(value.locationKey) ||
    !isString(value.locationLabel) ||
    !isTravelMinutes(value.travelBeforeMinutes) ||
    !isTravelMinutes(value.travelAfterMinutes)
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
    source: value.source,
    scheduleItemId: value.scheduleItemId,
    stageId: value.stageId,
    locationKey: value.locationKey,
    locationLabel: value.locationLabel,
    travelBeforeMinutes: value.travelBeforeMinutes,
    travelAfterMinutes: value.travelAfterMinutes,
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

export const parseFestivalPlanPreview = (value: unknown): FestivalPlanPreview => {
  if (
    !isRecord(value) ||
    typeof value.feasible !== "boolean" ||
    !isString(value.startsAt) ||
    !isString(value.endsAt) ||
    !isString(value.locationKey) ||
    !isString(value.locationLabel) ||
    !isTravelMinutes(value.travelBeforeMinutes) ||
    !isTravelMinutes(value.travelAfterMinutes) ||
    !Array.isArray(value.blockers) ||
    !Array.isArray(value.warnings)
  ) {
    throw new Error("malformed_festival_plan_preview");
  }

  return {
    feasible: value.feasible,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    locationKey: value.locationKey,
    locationLabel: value.locationLabel,
    travelBeforeMinutes: value.travelBeforeMinutes,
    travelAfterMinutes: value.travelAfterMinutes,
    blockers: value.blockers.map(parsePlanMessage),
    warnings: value.warnings.map(parsePlanMessage),
  };
};

const parseStageScheduleItem = (value: unknown): FestivalStageScheduleItem => {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    !isDate(value.festivalDate) ||
    !isString(value.startsAt) ||
    !isString(value.endsAt) ||
    !isDuration(value.durationMinutes) ||
    !isUuid(value.stageId) ||
    !isString(value.stageName) ||
    !isString(value.artistName) ||
    !isString(value.title) ||
    !isString(value.locationKey) ||
    typeof value.isPlanned !== "boolean" ||
    !isNullableUuid(value.plannedItemId)
  ) {
    throw new Error("malformed_festival_stage_schedule");
  }

  return {
    id: value.id,
    festivalDate: value.festivalDate,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
    durationMinutes: value.durationMinutes,
    stageId: value.stageId,
    stageName: value.stageName,
    artistName: value.artistName,
    title: value.title,
    locationKey: value.locationKey,
    isPlanned: value.isPlanned,
    plannedItemId: value.plannedItemId,
  };
};

export const parseFestivalStageSchedule = (value: unknown): FestivalStageSchedule => {
  if (
    !isRecord(value) ||
    !isUuid(value.attendanceId) ||
    !isUuid(value.festivalEditionId) ||
    !isNullableUuid(value.revisionId) ||
    !(value.scheduleState === null || value.scheduleState === "published" || value.scheduleState === "locked") ||
    typeof value.scheduleAvailable !== "boolean" ||
    !isString(value.timezone) ||
    !Array.isArray(value.days) ||
    !Array.isArray(value.items) ||
    !isString(value.serverNow)
  ) {
    throw new Error("malformed_festival_stage_schedule");
  }

  return {
    attendanceId: value.attendanceId,
    festivalEditionId: value.festivalEditionId,
    revisionId: value.revisionId,
    scheduleState: value.scheduleState as "locked" | "published",
    scheduleAvailable: value.scheduleAvailable,
    timezone: value.timezone,
    days: value.days.map(parseDay),
    items: value.items.map(parseStageScheduleItem),
    serverNow: value.serverNow,
  };
};

export const parseFestivalStagePlanPreview = (value: unknown): FestivalStagePlanPreview => {
  const preview = parseFestivalPlanPreview(value);
  if (
    !isRecord(value) ||
    !isUuid(value.scheduleItemId) ||
    !isUuid(value.stageId) ||
    !isString(value.stageName) ||
    !isString(value.artistName) ||
    !isString(value.title) ||
    !isDate(value.festivalDate)
  ) {
    throw new Error("malformed_festival_plan_preview");
  }

  return {
    ...preview,
    scheduleItemId: value.scheduleItemId,
    stageId: value.stageId,
    stageName: value.stageName,
    artistName: value.artistName,
    title: value.title,
    festivalDate: value.festivalDate,
  };
};

export const normalizeFestivalLocalStart = (value: string): string => {
  const normalized = value.length === 5 ? `${value}:00` : value;
  if (!TIME_RE.test(normalized)) throw new Error("festival_plan_start_invalid");
  return normalized;
};

export const isFestivalManualDuration = (value: number): value is FestivalManualDuration =>
  isManualDuration(value);
