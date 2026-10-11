export type FestivalAttendanceStatus =
  | "ticketed"
  | "ready_to_check_in"
  | "attending"
  | "left_early"
  | "completed"
  | "cancelled"
  | "refunded";

export interface FestivalPlayerAttendance {
  id: string;
  festivalLaunchId: string;
  festivalEditionId: string;
  festivalName: string;
  festivalSlug: string;
  startsOn: string | null;
  endsOn: string | null;
  cityId: string | null;
  admissionTicketId: string;
  ticketReference: string;
  ticketType: string;
  includesCamping: boolean;
  includesVipArea: boolean;
  status: FestivalAttendanceStatus;
  checkedInAt: string | null;
  leftAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface FestivalAttendanceReconciliation {
  attendance: FestivalPlayerAttendance[];
  completedCount: number;
  repairedCount: number;
  attentionCount: number;
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

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_RE.test(value);

const isNullableUuid = (value: unknown): value is string | null =>
  value === null || isUuid(value);

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isValidDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !value.trim()) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  return Number.isFinite(Date.parse(value));
};
const isNullableValidDate = (value: unknown): value is string | null => value === null || isValidDate(value);

const isAttendanceStatus = (value: unknown): value is FestivalAttendanceStatus =>
  typeof value === "string" && ATTENDANCE_STATUSES.has(value as FestivalAttendanceStatus);

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

export const parseFestivalPlayerAttendance = (value: unknown): FestivalPlayerAttendance => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("malformed_festival_attendance");
  }

  const candidate = value as Record<string, unknown>;

  if (
    !isUuid(candidate.id) ||
    !isUuid(candidate.festivalLaunchId) ||
    !isUuid(candidate.festivalEditionId) ||
    typeof candidate.festivalName !== "string" ||
    typeof candidate.festivalSlug !== "string" ||
    !isNullableValidDate(candidate.startsOn) ||
    !isNullableValidDate(candidate.endsOn) ||
    !isNullableUuid(candidate.cityId) ||
    !isUuid(candidate.admissionTicketId) ||
    typeof candidate.ticketReference !== "string" ||
    typeof candidate.ticketType !== "string" ||
    typeof candidate.includesCamping !== "boolean" ||
    typeof candidate.includesVipArea !== "boolean" ||
    !isAttendanceStatus(candidate.status) ||
    !isNullableValidDate(candidate.checkedInAt) ||
    !isNullableValidDate(candidate.leftAt) ||
    !isNullableValidDate(candidate.completedAt) ||
    !isValidDate(candidate.createdAt)
  ) {
    throw new Error("malformed_festival_attendance");
  }

  const chronological = [candidate.checkedInAt, candidate.leftAt, candidate.completedAt].filter(isValidDate).map(v => Date.parse(v));
  if (chronological.some((time, index) => index > 0 && time < chronological[index - 1]) ||
      (isValidDate(candidate.startsOn) && isValidDate(candidate.endsOn) && Date.parse(candidate.endsOn) < Date.parse(candidate.startsOn))) {
    throw new Error("malformed_festival_attendance");
  }

  return {
    id: candidate.id,
    festivalLaunchId: candidate.festivalLaunchId,
    festivalEditionId: candidate.festivalEditionId,
    festivalName: candidate.festivalName,
    festivalSlug: candidate.festivalSlug,
    startsOn: candidate.startsOn,
    endsOn: candidate.endsOn,
    cityId: candidate.cityId,
    admissionTicketId: candidate.admissionTicketId,
    ticketReference: candidate.ticketReference,
    ticketType: candidate.ticketType,
    includesCamping: candidate.includesCamping,
    includesVipArea: candidate.includesVipArea,
    status: candidate.status,
    checkedInAt: candidate.checkedInAt,
    leftAt: candidate.leftAt,
    completedAt: candidate.completedAt,
    createdAt: candidate.createdAt,
  };
};

export const parseFestivalPlayerAttendanceList = (value: unknown): FestivalPlayerAttendance[] => {
  if (!Array.isArray(value)) throw new Error("malformed_festival_attendance");
  return value.map(parseFestivalPlayerAttendance);
};

export const parseFestivalAttendanceReconciliation = (
  value: unknown,
): FestivalAttendanceReconciliation => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("malformed_festival_attendance_reconciliation");
  }

  const candidate = value as Record<string, unknown>;

  if (
    !Array.isArray(candidate.attendance) ||
    !isNonNegativeInteger(candidate.completedCount) ||
    !isNonNegativeInteger(candidate.repairedCount) ||
    !isNonNegativeInteger(candidate.attentionCount)
  ) {
    throw new Error("malformed_festival_attendance_reconciliation");
  }

  return {
    attendance: parseFestivalPlayerAttendanceList(candidate.attendance),
    completedCount: candidate.completedCount,
    repairedCount: candidate.repairedCount,
    attentionCount: candidate.attentionCount,
  };
};
