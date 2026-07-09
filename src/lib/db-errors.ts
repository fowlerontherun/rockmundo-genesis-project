export interface DbErrorContext {
  operation: string;
  table: string;
  filters?: Record<string, unknown>;
  rlsHint?: string;
}

export const isMissingSingleRowError = (error: unknown): boolean => {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "PGRST116"
  );
};

export const assertNonEmptyString = (value: string, fieldName: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }
  return trimmed;
};

export const formatDbError = (error: unknown, context: DbErrorContext): Error => {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "unknown";
  const message = error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message) : String(error);
  const detail = error && typeof error === "object" && "details" in error ? (error as { details?: unknown }).details : undefined;
  const hint = error && typeof error === "object" && "hint" in error ? (error as { hint?: unknown }).hint : undefined;

  const filterSummary = context.filters
    ? ` filters=${JSON.stringify(context.filters)}`
    : "";
  const rlsSummary = context.rlsHint ? ` ${context.rlsHint}` : "";
  const detailSummary = detail ? ` details=${JSON.stringify(detail)}` : "";
  const hintSummary = hint ? ` hint=${JSON.stringify(hint)}` : "";

  const wrapped = new Error(
    `Database ${context.operation} failed on ${context.table} (code=${code}): ${message}${filterSummary}${detailSummary}${hintSummary}${rlsSummary}`
  );
  wrapped.cause = error;
  return wrapped;
};

export const throwDbError = (error: unknown, context: DbErrorContext): never => {
  throw formatDbError(error, context);
};
