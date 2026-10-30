const DAY_MS = 24 * 60 * 60 * 1000;
const EARLIEST_DATE_ZONE_HOURS = 14;
const MIN_LEAD_MS = 60_000;

/**
 * FestivalArtistProgrammeResult publishes calendar dates, not venue timezones.
 * The earliest possible local midnight worldwide is 14 hours before midnight
 * UTC for the calendar day. Use this conservative deadline boundary rather
 * than accepting an invitation after the festival might already have started.
 */
export function earliestFestivalStartBoundary(festivalDates: readonly string[]): number | null {
  const validDays = festivalDates.filter((day) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const parsed = Date.parse(day + "T00:00:00Z");
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === day;
  }).sort();
  if (!validDays.length) return null;
  return Date.parse(validDays[0] + "T00:00:00Z") - EARLIEST_DATE_ZONE_HOURS * 60 * 60 * 1000;
}

/** A safe suggested response deadline is available only before event start. */
export function suggestedFestivalResponseDeadline(
  festivalDates: readonly string[],
  now = Date.now(),
): string | null {
  const starts = earliestFestivalStartBoundary(festivalDates);
  if (starts === null || !Number.isFinite(now)) return null;
  const deadline = Math.min(starts - MIN_LEAD_MS, now + 14 * DAY_MS);
  return deadline > now + MIN_LEAD_MS ? new Date(deadline).toISOString() : null;
}

/** Never silently replace malformed, expired or event-overlapping input. */
export function validateFestivalResponseDeadline(
  value: string,
  festivalDates: readonly string[],
  now = Date.now(),
): string | null {
  const starts = earliestFestivalStartBoundary(festivalDates);
  if (starts === null || !Number.isFinite(now) || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed <= now + MIN_LEAD_MS || parsed >= starts) {
    return null;
  }
  return new Date(parsed).toISOString();
}
