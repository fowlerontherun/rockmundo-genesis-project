import { isSameDay } from "date-fns";

export const PRACTICE_HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** Local-time slot preview only; the booking RPC repeats this check against server time. */
export function availablePracticeHours(date: Date, now = new Date()): number[] {
  if (!isSameDay(date, now)) return PRACTICE_HOURS;
  return PRACTICE_HOURS.filter((hour) => {
    const slot = new Date(date);
    slot.setHours(hour, 0, 0, 0);
    return slot > now;
  });
}

export function nextPracticeHour(date = new Date(), now = new Date()): number | null {
  return availablePracticeHours(date, now)[0] ?? null;
}
