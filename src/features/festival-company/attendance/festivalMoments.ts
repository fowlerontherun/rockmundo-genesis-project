export type FestivalMomentCategory = "band_encounter" | "social" | "inspiration" | "vendor" | "camping" | "nightlife";
export type FestivalMomentStatus = "pending" | "choice_made" | "resolved" | "expired";

export interface FestivalMomentOption {
  id: string;
  label: string;
  description: string;
  delayMinutes: number;
}

export interface FestivalMoment {
  id: string;
  category: FestivalMomentCategory;
  title: string;
  body: string;
  options: FestivalMomentOption[];
  status: FestivalMomentStatus;
  chosenOption: string | null;
  outcome: Record<string, unknown> | null;
  relatedProfileId: string | null;
  availableAt: string;
  expiresAt: string;
  outcomeDueAt: string | null;
  resolvedAt: string | null;
  context: Record<string, unknown>;
}

export interface FestivalMomentFeed {
  attendanceId: string;
  festivalEditionId: string;
  items: FestivalMoment[];
  serverNow: string;
}

export interface FestivalMomentMutationResult {
  id: string;
  status: FestivalMomentStatus;
  outcomeDueAt?: string | null;
  outcome?: Record<string, unknown> | null;
  duplicate: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories = new Set<FestivalMomentCategory>(["band_encounter", "social", "inspiration", "vendor", "camping", "nightlife"]);
const statuses = new Set<FestivalMomentStatus>(["pending", "choice_made", "resolved", "expired"]);
const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isNullableString = (v: unknown): v is string | null => v === null || typeof v === "string";
const isNullableUuid = (v: unknown): v is string | null => v === null || (typeof v === "string" && UUID_RE.test(v));

const parseOption = (value: unknown): FestivalMomentOption => {
  if (!isRecord(value) || !isString(value.id) || !isString(value.label) || !isString(value.description) || typeof value.delayMinutes !== "number" || !Number.isInteger(value.delayMinutes) || value.delayMinutes < 0 || value.delayMinutes > 240) {
    throw new Error("malformed_festival_moment");
  }
  return { id: value.id, label: value.label, description: value.description, delayMinutes: value.delayMinutes };
};

const parseMoment = (value: unknown): FestivalMoment => {
  if (!isRecord(value) || typeof value.id !== "string" || !UUID_RE.test(value.id) || typeof value.category !== "string" || !categories.has(value.category as FestivalMomentCategory) || !isString(value.title) || !isString(value.body) || !Array.isArray(value.options) || typeof value.status !== "string" || !statuses.has(value.status as FestivalMomentStatus) || !isNullableString(value.chosenOption) || !(value.outcome === null || isRecord(value.outcome)) || !isNullableUuid(value.relatedProfileId) || !isString(value.availableAt) || !isString(value.expiresAt) || !isNullableString(value.outcomeDueAt) || !isNullableString(value.resolvedAt) || !isRecord(value.context)) {
    throw new Error("malformed_festival_moment");
  }
  return {
    id: value.id,
    category: value.category as FestivalMomentCategory,
    title: value.title,
    body: value.body,
    options: value.options.map(parseOption),
    status: value.status as FestivalMomentStatus,
    chosenOption: value.chosenOption,
    outcome: value.outcome as Record<string, unknown> | null,
    relatedProfileId: value.relatedProfileId,
    availableAt: value.availableAt,
    expiresAt: value.expiresAt,
    outcomeDueAt: value.outcomeDueAt,
    resolvedAt: value.resolvedAt,
    context: value.context as Record<string, unknown>,
  };
};

export const parseFestivalMomentFeed = (value: unknown): FestivalMomentFeed => {
  if (!isRecord(value) || typeof value.attendanceId !== "string" || !UUID_RE.test(value.attendanceId) || typeof value.festivalEditionId !== "string" || !UUID_RE.test(value.festivalEditionId) || !Array.isArray(value.items) || !isString(value.serverNow)) throw new Error("malformed_festival_moment_feed");
  return { attendanceId: value.attendanceId, festivalEditionId: value.festivalEditionId, items: value.items.map(parseMoment), serverNow: value.serverNow };
};

export const parseFestivalMomentMutationResult = (value: unknown): FestivalMomentMutationResult => {
  if (!isRecord(value) || typeof value.id !== "string" || !UUID_RE.test(value.id) || typeof value.status !== "string" || !statuses.has(value.status as FestivalMomentStatus) || typeof value.duplicate !== "boolean") throw new Error("malformed_festival_moment_result");
  if (value.outcomeDueAt !== undefined && !isNullableString(value.outcomeDueAt)) throw new Error("malformed_festival_moment_result");
  if (value.outcome !== undefined && !(value.outcome === null || isRecord(value.outcome))) throw new Error("malformed_festival_moment_result");
  return { id: value.id, status: value.status as FestivalMomentStatus, duplicate: value.duplicate, ...(value.outcomeDueAt !== undefined ? { outcomeDueAt: value.outcomeDueAt as string } : {}), ...(value.outcome !== undefined ? { outcome: value.outcome as Record<string, unknown> | null } : {}) };
};
