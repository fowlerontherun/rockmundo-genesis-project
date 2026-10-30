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

/**
 * Resolve a local festival wall time to exactly one real instant.
 * A browser timezone is never consulted. During DST fall-back, the same wall
 * time occurs twice; during spring-forward, some times do not exist. Both are
 * rejected until the organiser chooses an unambiguous time.
 */
const EDITABLE_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;

function localParts(formatter: Intl.DateTimeFormat, instant: number) {
  const parts = formatter.formatToParts(new Date(instant));
  const read = (name: string) => Number(parts.find(part => part.type === name)?.value);
  return [read("year"), read("month"), read("day"), read("hour"), read("minute")];
}

function festivalZoneFormatter(zone: string) {
  // Unlike display formatting, writes must fail closed for unknown IANA zones.
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function festivalScheduleLocalInput(value: string | null | undefined, zone: string): string {
  if (!value) return "";
  if (EDITABLE_LOCAL.test(value.slice(0, 16)) && !FULL.test(value)) return value.slice(0, 16);
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) throw new Error("Invalid existing festival slot time.");
  const [year, month, day, hour, minute] = localParts(festivalZoneFormatter(zone), instant);
  return [year, String(month).padStart(2,"0"), String(day).padStart(2,"0")].join("-") +
    "T" + String(hour).padStart(2,"0") + ":" + String(minute).padStart(2,"0");
}

export function festivalScheduleLocalToInstant(local: string, zone: string): string {
  const match = EDITABLE_LOCAL.exec(local);
  if (!match) throw new Error("Enter a valid festival date and time.");
  const values = match.slice(1).map(Number);
  const [year, month, day, hour, minute] = values;
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const verified = new Date(localAsUtc);
  if (verified.getUTCFullYear() !== year || verified.getUTCMonth() + 1 !== month ||
      verified.getUTCDate() !== day || verified.getUTCHours() !== hour ||
      verified.getUTCMinutes() !== minute) throw new Error("Invalid festival calendar date.");

  let formatter: Intl.DateTimeFormat;
  try { formatter = festivalZoneFormatter(zone); }
  catch { throw new Error("The festival has no valid IANA timezone. Correct its configuration before saving."); }

  // The offsets immediately before and after the target local day cover both
  // sides of an ordinary DST transition, including half-hour transitions.
  const offsets = new Set<number>();
  for (const hours of [-36, -12, 12, 36]) {
    const sample = localAsUtc + hours * 60 * 60 * 1000;
    const [y, mo, d, h, mi] = localParts(formatter, sample);
    offsets.add(Date.UTC(y, mo - 1, d, h, mi) - sample);
  }
  const matches = [...offsets]
    .map(offset => localAsUtc - offset)
    .filter(instant => localParts(formatter, instant).every((value, index) => value === values[index]));
  const unique = [...new Set(matches)];
  if (!unique.length) throw new Error("This time does not exist in the festival timezone due to a daylight-saving change.");
  if (unique.length > 1) throw new Error("This time occurs twice in the festival timezone due to a daylight-saving change. Choose an unambiguous time.");
  return new Date(unique[0]).toISOString();
}

export function festivalScheduleSlotWindow(date: string, clock: string, durationMinutes: number, zone: string) {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 10 || durationMinutes > 240) {
    throw new Error("Festival set length must be 10–240 minutes.");
  }
  const startsAt = festivalScheduleLocalToInstant(date + "T" + clock, zone);
  // A performance lasts elapsed minutes; the end can cross midnight/DST.
  const endsAt = new Date(Date.parse(startsAt) + durationMinutes * 60_000).toISOString();
  return { startsAt, endsAt };
}
