import { differenceInMinutes } from "date-fns";

const MIN_DURATION_MINUTES = 1;

export function buildScheduledDateTime(date: Date, hour: number, minute = 0): Date {
  const scheduled = new Date(date);
  scheduled.setHours(hour, minute, 0, 0);
  return scheduled;
}

export function addDurationHours(start: Date, durationHours: number): Date {
  return new Date(start.getTime() + durationHours * 60 * 60 * 1000);
}

export function getDurationMinutes(start: Date | string, end: Date | string): number {
  const minutes = differenceInMinutes(new Date(end), new Date(start));
  return Number.isFinite(minutes) ? minutes : 0;
}

export function getDisplayDurationMinutes(activity: {
  scheduled_start: string;
  scheduled_end?: string | null;
  duration_minutes?: number | null;
}): number | null {
  const calculated = activity.scheduled_end
    ? getDurationMinutes(activity.scheduled_start, activity.scheduled_end)
    : 0;

  if (calculated >= MIN_DURATION_MINUTES) return calculated;
  if (typeof activity.duration_minutes === "number" && activity.duration_minutes >= MIN_DURATION_MINUTES) {
    return activity.duration_minutes;
  }
  return null;
}

export function formatDurationMinutes(minutes: number | null): string | null {
  if (!minutes || minutes < MIN_DURATION_MINUTES) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function validateFutureBooking(start: Date, now = new Date()): string | null {
  if (Number.isNaN(start.getTime())) return "Please choose a valid date and time.";
  if (start <= now) return "Please choose a future time. Activities cannot be booked in the past.";
  return null;
}

export function validateBookingWindow(start: Date, end: Date, now = new Date()): string | null {
  const futureError = validateFutureBooking(start, now);
  if (futureError) return futureError;
  if (Number.isNaN(end.getTime()) || end <= start) {
    return "Please choose a valid duration for this activity.";
  }
  return null;
}
