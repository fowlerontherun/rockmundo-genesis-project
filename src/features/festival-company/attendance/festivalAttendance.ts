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

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isAttendanceStatus = (value: unknown): value is FestivalAttendanceStatus =>
  typeof value === "string" && ATTENDANCE_STATUSES.has(value as FestivalAttendanceStatus);

export const parseFestivalPlayerAttendance = (value: unknown): FestivalPlayerAttendance => {
  if (!value || typeof value !== "object") throw new Error("malformed_festival_attendance");

  const candidate = value as Record<string, unknown>;

  if (
    !isUuid(candidate.id) ||
    !isUuid(candidate.festivalLaunchId) ||
    !isUuid(candidate.festivalEditionId) ||
    typeof candidate.festivalName !== "string" ||
    typeof candidate.festivalSlug !== "string" ||
    !isNullableString(candidate.startsOn) ||
    !isNullableString(candidate.endsOn) ||
    !(candidate.cityId === null || isUuid(candidate.cityId)) ||
    !isUuid(candidate.admissionTicketId) ||
    typeof candidate.ticketReference !== "string" ||
    typeof candidate.ticketType !== "string" ||
    typeof candidate.includesCamping !== "boolean" ||
    typeof candidate.includesVipArea !== "boolean" ||
    !isAttendanceStatus(candidate.status) ||
    !isNullableString(candidate.checkedInAt) ||
    !isNullableString(candidate.leftAt) ||
    !isNullableString(candidate.completedAt) ||
    typeof candidate.createdAt !== "string"
  ) {
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
