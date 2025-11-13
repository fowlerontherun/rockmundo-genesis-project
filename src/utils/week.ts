export type WeekAnchor = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Computes the start of the anchored week in UTC for the provided date.
 *
 * @param reference - The reference date (defaults to now).
 * @param anchorDay - The day the week should anchor on, using the JS day index (0 = Sunday ... 6 = Saturday).
 * @returns A Date object representing 00:00:00 UTC of the anchor day for the week containing the reference.
 */
export function getUtcWeekStart(reference: Date = new Date(), anchorDay: WeekAnchor = 1): Date {
  const utcReference = new Date(Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate(),
    reference.getUTCHours(),
    reference.getUTCMinutes(),
    reference.getUTCSeconds(),
    reference.getUTCMilliseconds()
  ));

  const referenceDay = utcReference.getUTCDay();
  let diff = referenceDay - anchorDay;
  if (diff < 0) {
    diff += 7;
  }

  const weekStart = new Date(Date.UTC(
    utcReference.getUTCFullYear(),
    utcReference.getUTCMonth(),
    utcReference.getUTCDate()
  ));
  weekStart.setUTCDate(weekStart.getUTCDate() - diff);
  weekStart.setUTCHours(0, 0, 0, 0);

  return weekStart;
}

/**
 * Returns the UTC week range [start, end) for the provided date and anchor.
 */
export function getUtcWeekRange(reference: Date = new Date(), anchorDay: WeekAnchor = 1): { start: Date; end: Date } {
  const start = getUtcWeekStart(reference, anchorDay);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

/**
 * Formats a Date object (assumed to be UTC) into an ISO date string (YYYY-MM-DD).
 */
export function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
