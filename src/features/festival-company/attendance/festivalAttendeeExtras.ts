import type { FestivalAttendanceStatus } from "./festivalAttendance";

export type FestivalCheckInBlockReason =
  | "already_attending"
  | "attendance_closed"
  | "attendance_not_ready"
  | "ticket_invalid"
  | "festival_cancelled"
  | "festival_dates_unavailable"
  | "festival_city_unavailable"
  | "festival_not_started"
  | "festival_finished"
  | "character_traveling"
  | "wrong_city"
  | "schedule_conflict";

export interface FestivalCheckInEligibility {
  attendanceId: string;
  festivalLaunchId: string;
  festivalEditionId: string;
  attendanceStatus: FestivalAttendanceStatus;
  canCheckIn: boolean;
  blockReason: FestivalCheckInBlockReason | null;
  startsOn: string | null;
  endsOn: string | null;
  cityId: string | null;
  cityName: string | null;
  timezone: string;
  festivalLocalDate: string;
  currentCityId: string | null;
  characterIsTraveling: boolean;
  ticketStatus: string;
  launchStatus: string;
  editionStatus: string;
  wristbandIssued: boolean;
}

export interface FestivalCheckInResult {
  attendanceId: string;
  festivalLaunchId: string;
  festivalEditionId: string;
  status: "attending";
  checkedInAt: string;
  ticketStatus: "used";
  wristbandIssued: boolean;
  alreadyCheckedIn: boolean;
}

export interface FestivalLeaveEarlyResult {
  attendanceId: string;
  festivalLaunchId: string;
  festivalEditionId: string;
  status: "left_early";
  checkedInAt: string;
  leftAt: string;
  alreadyLeft: boolean;
}

export interface FestivalMemorabiliaItem {
  id: string;
  festivalLaunchId: string;
  festivalEditionId: string;
  attendanceId: string;
  itemType: "wristband";
  itemKey: string;
  displayName: string;
  description: string | null;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  metadata: Record<string, unknown>;
  issuedAt: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ATTENDANCE_STATUSES = new Set<FestivalAttendanceStatus>([
  "ticketed",
  "ready_to_check_in",
  "attending",
  "left_early",
  "completed",
  "cancelled",
  "refunded",
]);
const BLOCK_REASONS = new Set<FestivalCheckInBlockReason>([
  "already_attending",
  "attendance_closed",
  "attendance_not_ready",
  "ticket_invalid",
  "festival_cancelled",
  "festival_dates_unavailable",
  "festival_city_unavailable",
  "festival_not_started",
  "festival_finished",
  "character_traveling",
  "wrong_city",
  "schedule_conflict",
]);
const RARITIES = new Set<FestivalMemorabiliaItem["rarity"]>([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
]);

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_RE.test(value);

const isNullableUuid = (value: unknown): value is string | null =>
  value === null || isUuid(value);

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const parseFestivalCheckInEligibility = (value: unknown): FestivalCheckInEligibility => {
  if (!isRecord(value)) throw new Error("malformed_festival_check_in_eligibility");

  const blockReason = value.blockReason;
  if (
    !isUuid(value.attendanceId) ||
    !isUuid(value.festivalLaunchId) ||
    !isUuid(value.festivalEditionId) ||
    typeof value.attendanceStatus !== "string" ||
    !ATTENDANCE_STATUSES.has(value.attendanceStatus as FestivalAttendanceStatus) ||
    typeof value.canCheckIn !== "boolean" ||
    !(
      blockReason === null ||
      (typeof blockReason === "string" && BLOCK_REASONS.has(blockReason as FestivalCheckInBlockReason))
    ) ||
    value.canCheckIn !== (blockReason === null) ||
    !isNullableString(value.startsOn) ||
    !isNullableString(value.endsOn) ||
    !isNullableUuid(value.cityId) ||
    !isNullableString(value.cityName) ||
    typeof value.timezone !== "string" ||
    typeof value.festivalLocalDate !== "string" ||
    !isNullableUuid(value.currentCityId) ||
    typeof value.characterIsTraveling !== "boolean" ||
    typeof value.ticketStatus !== "string" ||
    typeof value.launchStatus !== "string" ||
    typeof value.editionStatus !== "string" ||
    typeof value.wristbandIssued !== "boolean"
  ) {
    throw new Error("malformed_festival_check_in_eligibility");
  }

  return {
    attendanceId: value.attendanceId,
    festivalLaunchId: value.festivalLaunchId,
    festivalEditionId: value.festivalEditionId,
    attendanceStatus: value.attendanceStatus as FestivalAttendanceStatus,
    canCheckIn: value.canCheckIn,
    blockReason: blockReason as FestivalCheckInBlockReason | null,
    startsOn: value.startsOn,
    endsOn: value.endsOn,
    cityId: value.cityId,
    cityName: value.cityName,
    timezone: value.timezone,
    festivalLocalDate: value.festivalLocalDate,
    currentCityId: value.currentCityId,
    characterIsTraveling: value.characterIsTraveling,
    ticketStatus: value.ticketStatus,
    launchStatus: value.launchStatus,
    editionStatus: value.editionStatus,
    wristbandIssued: value.wristbandIssued,
  };
};

export const parseFestivalCheckInEligibilityList = (value: unknown): FestivalCheckInEligibility[] => {
  if (!Array.isArray(value)) throw new Error("malformed_festival_check_in_eligibility");
  return value.map(parseFestivalCheckInEligibility);
};

export const parseFestivalCheckInResult = (value: unknown): FestivalCheckInResult => {
  if (
    !isRecord(value) ||
    !isUuid(value.attendanceId) ||
    !isUuid(value.festivalLaunchId) ||
    !isUuid(value.festivalEditionId) ||
    value.status !== "attending" ||
    typeof value.checkedInAt !== "string" ||
    value.ticketStatus !== "used" ||
    typeof value.wristbandIssued !== "boolean" ||
    typeof value.alreadyCheckedIn !== "boolean"
  ) {
    throw new Error("malformed_festival_check_in_result");
  }

  return {
    attendanceId: value.attendanceId,
    festivalLaunchId: value.festivalLaunchId,
    festivalEditionId: value.festivalEditionId,
    status: "attending",
    checkedInAt: value.checkedInAt,
    ticketStatus: "used",
    wristbandIssued: value.wristbandIssued,
    alreadyCheckedIn: value.alreadyCheckedIn,
  };
};

export const parseFestivalLeaveEarlyResult = (value: unknown): FestivalLeaveEarlyResult => {
  if (
    !isRecord(value) ||
    !isUuid(value.attendanceId) ||
    !isUuid(value.festivalLaunchId) ||
    !isUuid(value.festivalEditionId) ||
    value.status !== "left_early" ||
    typeof value.checkedInAt !== "string" ||
    typeof value.leftAt !== "string" ||
    typeof value.alreadyLeft !== "boolean"
  ) {
    throw new Error("malformed_festival_leave_result");
  }

  return {
    attendanceId: value.attendanceId,
    festivalLaunchId: value.festivalLaunchId,
    festivalEditionId: value.festivalEditionId,
    status: "left_early",
    checkedInAt: value.checkedInAt,
    leftAt: value.leftAt,
    alreadyLeft: value.alreadyLeft,
  };
};

export const parseFestivalMemorabiliaItem = (value: unknown): FestivalMemorabiliaItem => {
  if (!isRecord(value)) throw new Error("malformed_festival_memorabilia");

  if (
    !isUuid(value.id) ||
    !isUuid(value.festivalLaunchId) ||
    !isUuid(value.festivalEditionId) ||
    !isUuid(value.attendanceId) ||
    value.itemType !== "wristband" ||
    typeof value.itemKey !== "string" ||
    typeof value.displayName !== "string" ||
    !isNullableString(value.description) ||
    typeof value.rarity !== "string" ||
    !RARITIES.has(value.rarity as FestivalMemorabiliaItem["rarity"]) ||
    !isRecord(value.metadata) ||
    typeof value.issuedAt !== "string"
  ) {
    throw new Error("malformed_festival_memorabilia");
  }

  return {
    id: value.id,
    festivalLaunchId: value.festivalLaunchId,
    festivalEditionId: value.festivalEditionId,
    attendanceId: value.attendanceId,
    itemType: "wristband",
    itemKey: value.itemKey,
    displayName: value.displayName,
    description: value.description,
    rarity: value.rarity as FestivalMemorabiliaItem["rarity"],
    metadata: value.metadata,
    issuedAt: value.issuedAt,
  };
};

export const parseFestivalMemorabiliaList = (value: unknown): FestivalMemorabiliaItem[] => {
  if (!Array.isArray(value)) throw new Error("malformed_festival_memorabilia");
  return value.map(parseFestivalMemorabiliaItem);
};
