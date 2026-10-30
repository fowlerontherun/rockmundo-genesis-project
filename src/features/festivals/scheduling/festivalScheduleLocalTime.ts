/**
 * Festival schedule projection uses actual UTC/offset timestamps. Render them
 * in the festival's published IANA time zone, never the viewer's device zone.
 * Legacy naive date-time strings are treated as labelled wall-clock values;
 * never reinterpret them via the visitor browser timezone.
 */
const NAIVE = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d{1,3})?)?$/;
const FULL = /(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i;

function safeTimezone(zone: string): string {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone }).format(0);
    return zone;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return "UTC";
  }
}

export function festivalScheduleTimezoneLabel(zone: string): string {
  return safeTimezone(zone) === zone ? zone : "UTC (invalid festival timezone)";
}

function festivalClockParts(value: string | null | undefined, zone: string): { hour: number; minute: number } | null {
  if (!value) return null;
  const naive = NAIVE.exec(value);
  if (naive) {
    const day = new Date(naive[1] + "T12:00:00Z");
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0,10) !== naive[1]) return null;
    return { hour: Number(naive[2]), minute: Number(naive[3]) };
  }
  if (!FULL.test(value)) return null;
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTimezone(zone),
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(time);
  const read = (key: string) => Number(parts.find(p => p.type === key)?.value);
  const hour = read("hour"), minute = read("minute");
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 &&
    Number.isInteger(minute) && minute >= 0 && minute <= 59 ? { hour, minute } : null;
}

export function festivalScheduleLocalHour(value: string | null | undefined, zone: string): number | null {
  return festivalClockParts(value, zone)?.hour ?? null;
}

export function festivalScheduleLocalClock(value: string | null | undefined, zone: string): string {
  const parts = festivalClockParts(value, zone);
  return parts ? `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}` : "unscheduled";
}
