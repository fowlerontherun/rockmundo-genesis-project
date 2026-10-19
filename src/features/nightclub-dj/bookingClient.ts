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

/** A live set can outlast its booking window; never restore a missed or settled one. */
export function findUnrestoredLiveDjBooking<T extends { id: string; status: string }>(
  bookings: readonly T[],
  restoredIds: ReadonlySet<string>,
): T | null {
  return bookings.find((booking) => booking.status === "live" && !restoredIds.has(booking.id)) ?? null;
}

/**
 * A verified server acknowledgement must not be turned into a false failure by a
 * stale React Query cache, a failed follow-up request or a UI callback.
 * A failed/ambiguous server action still rejects and must never show success.
 */
export async function runConfirmedDjAction<T>(
  perform: () => Promise<T>,
  afterConfirmation: (result: T) => Promise<unknown> | unknown,
): Promise<T> {
  const result = await perform();
  try {
    await afterConfirmation(result);
  } catch {
    // Only follow-up presentation work is best-effort; the DB action succeeded.
  }
  return result;
}
