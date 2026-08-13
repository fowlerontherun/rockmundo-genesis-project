import logger from "@/lib/logger";

export type GigExperienceDiagnosticStage =
  | "gig"
  | "venue_city"
  | "outcome"
  | "song_performances"
  | "gig_setlist"
  | "legacy_setlist"
  | "performers"
  | "band_members"
  | "replay_descriptor"
  | "post_processing"
  | "consequences"
  | "mapping"
  | "presentation"
  | "replay"
  | "renderer";

export type GigExperienceFailure = {
  scope: "gig-experience";
  stage: GigExperienceDiagnosticStage;
  source: string;
  gigId: string;
  reference: string;
  httpStatus: number | null;
  code: string | null;
  message: string | null;
  details: string | null;
  hint: string | null;
  fallback?: string | null;
};

type ErrorLike = {
  status?: unknown;
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  gigExperienceFailure?: GigExperienceFailure;
};

const SCHEMA_COMPATIBILITY_CODES = new Set([
  "42P01",
  "42703",
  "PGRST200",
  "PGRST201",
  "PGRST202",
  "PGRST204",
  "PGRST205",
]);

const NON_RETRYABLE_CODES = new Set([
  ...SCHEMA_COMPATIBILITY_CODES,
  "42501",
  "PGRST116",
  "GIG_NOT_FOUND",
  "INVALID_GIG_EXPERIENCE",
]);

const cleanCode = (value: string | null) =>
  (value ?? "UNKNOWN").toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 24);

const cleanIdentifier = (value: string) =>
  value.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase() || "UNKNOWN";

export function createGigExperienceReference(
  gigId: string,
  stage: GigExperienceDiagnosticStage,
  code: string | null,
) {
  return `GIGVIEW-${stage.toUpperCase()}-${cleanCode(code)}-${cleanIdentifier(gigId)}`;
}

export function normalizeGigExperienceFailure(
  gigId: string,
  stage: GigExperienceDiagnosticStage,
  source: string,
  error: unknown,
  fallback?: string | null,
): GigExperienceFailure {
  const candidate = error && typeof error === "object" ? (error as ErrorLike) : null;
  const code = typeof candidate?.code === "string" ? candidate.code : null;
  const message = typeof candidate?.message === "string"
    ? candidate.message
    : error instanceof Error
      ? error.message
      : error == null
        ? null
        : String(error);

  return {
    scope: "gig-experience",
    stage,
    source,
    gigId,
    reference: createGigExperienceReference(gigId, stage, code),
    httpStatus: typeof candidate?.status === "number" ? candidate.status : null,
    code,
    message,
    details: typeof candidate?.details === "string" ? candidate.details : null,
    hint: typeof candidate?.hint === "string" ? candidate.hint : null,
    fallback,
  };
}

export function getGigExperienceFailure(error: unknown): GigExperienceFailure | null {
  if (!error || typeof error !== "object") return null;
  return (error as ErrorLike).gigExperienceFailure ?? null;
}

export function isGigSchemaCompatibilityError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rawCode = (error as ErrorLike).code;
  const code = typeof rawCode === "string" ? rawCode : null;
  return code ? SCHEMA_COMPATIBILITY_CODES.has(code) : false;
}

export function isMissingResultReadyAtError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as ErrorLike;
  const haystack = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return candidate.code === "42703" && haystack.includes("result_ready_at");
}

export class GigExperienceLoadError extends Error {
  readonly gigExperienceFailure: GigExperienceFailure;

  constructor(failure: GigExperienceFailure) {
    super(failure.message ?? `Gig viewer data load failed during ${failure.stage}`);
    this.name = "GigExperienceLoadError";
    this.gigExperienceFailure = failure;
  }
}

export function createGigExperienceLoadError(
  gigId: string,
  stage: GigExperienceDiagnosticStage,
  source: string,
  error: unknown,
) {
  const existing = getGigExperienceFailure(error);
  const failure = existing ?? normalizeGigExperienceFailure(gigId, stage, source, error);
  logger.error("Gig viewer data load failed", failure as unknown as Record<string, unknown>);
  return new GigExperienceLoadError(failure);
}

export function logGigExperienceFallback(
  gigId: string,
  stage: GigExperienceDiagnosticStage,
  source: string,
  error: unknown,
  fallback: string,
) {
  const failure = normalizeGigExperienceFailure(gigId, stage, source, error, fallback);
  logger.warn("Gig viewer data source unavailable; using compatibility fallback", failure as unknown as Record<string, unknown>);
  return failure;
}

export function logGigExperienceSuccess(context: Record<string, unknown>) {
  logger.info("Gig viewer data load completed", {
    scope: "gig-experience",
    ...context,
  });
}

export function shouldRetryGigExperienceLoad(failureCount: number, error: unknown) {
  const failure = getGigExperienceFailure(error);
  const code = failure?.code
    ?? (error && typeof error === "object" && typeof (error as ErrorLike).code === "string"
      ? (error as ErrorLike).code as string
      : null);
  if (code && NON_RETRYABLE_CODES.has(code)) return false;
  return failureCount < 2;
}

export function getGigExperienceErrorDisplay(error: unknown, gigId: string) {
  const failure = getGigExperienceFailure(error)
    ?? normalizeGigExperienceFailure(gigId, "mapping", "gig-experience", error);
  const schemaMismatch = failure.code ? SCHEMA_COMPATIBILITY_CODES.has(failure.code) : false;
  const permissionDenied = failure.code === "42501"
    || /permission|row-level security|not authorized/i.test(failure.message ?? "");
  const networkFailure = /network|failed to fetch|load failed|offline/i.test(failure.message ?? "");

  let body = `The saved gig data could not be loaded during ${failure.stage.replace(/_/g, " ")}.`;
  if (schemaMismatch) body = "The viewer found a database compatibility mismatch while loading this gig.";
  else if (permissionDenied) body = "Your account could not read one of the saved gig records required by the viewer.";
  else if (networkFailure) body = "The viewer could not reach the gig data service. Check the connection and retry.";
  else if (failure.stage === "mapping") body = "This historical gig contains data the current viewer could not safely interpret.";

  return { body, reference: failure.reference, failure };
}
