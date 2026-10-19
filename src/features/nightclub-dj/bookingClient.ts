/**
 * Client-side DJ reservation retry identity.
 *
 * The server owns authorization, scheduling, and uniqueness. This only makes
 * retries of an ambiguous response send the exact same unique request ID.
 */
export type DjReservationAttempt = {
  fingerprint: string;
  requestId: string;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function djReservationFingerprint(
  profileId: string, clubId: string, setlistId: string, startsAtIso: string,
): string {
  return JSON.stringify([profileId, clubId, setlistId, startsAtIso]);
}

export function parseDjReservationAttempt(raw: string | null): DjReservationAttempt | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const attempt = value as Record<string, unknown>;
    if (typeof attempt.fingerprint !== "string" ||
        typeof attempt.requestId !== "string" || !uuid.test(attempt.requestId)) return null;
    return { fingerprint: attempt.fingerprint, requestId: attempt.requestId };
  } catch {
    return null;
  }
}

export function resolveDjReservationAttempt(
  previous: DjReservationAttempt | null,
  fingerprint: string,
  createId: () => string,
): DjReservationAttempt {
  return previous?.fingerprint === fingerprint
    ? previous
    : { fingerprint, requestId: createId() };
}

export function canStartDjBooking(status: string, startsAt: string, nowMs: number): boolean {
  const startMs = Date.parse(startsAt);
  return (status === "booked" || status === "ready") &&
    Number.isFinite(startMs) && Number.isFinite(nowMs) &&
    nowMs >= startMs - 5 * 60_000 && nowMs < startMs + 10 * 60_000;
}

export function canCancelDjBooking(status: string, startsAt: string, nowMs: number): boolean {
  const startMs = Date.parse(startsAt);
  return (status === "booked" || status === "ready") &&
    Number.isFinite(startMs) && Number.isFinite(nowMs) && startMs > nowMs;
}
