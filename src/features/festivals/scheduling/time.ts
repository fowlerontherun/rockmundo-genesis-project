import { addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { FestivalScheduleItem, FestivalStageOperatingHours } from "./model";

export interface FestivalTimelineSlot {
  key: string;
  startsAt: string;
  endsAt: string;
  label: string;
  dayOffset: number;
}

const FALLBACK_TIME_ZONE = "UTC";
const MAX_TIMELINE_HOURS = 36;

export function safeFestivalTimeZone(timeZone?: string | null): string {
  if (!timeZone) return FALLBACK_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

export function formatFestivalTime(
  value?: string | Date | null,
  timeZone?: string | null,
): string {
  if (!value) return "unscheduled";
  try {
    return formatInTimeZone(new Date(value), safeFestivalTimeZone(timeZone), "HH:mm");
  } catch {
    return "invalid time";
  }
}

export function formatFestivalDateTimeInput(
  value?: string | Date | null,
  timeZone?: string | null,
): string {
  if (!value) return "";
  try {
    return formatInTimeZone(
      new Date(value),
      safeFestivalTimeZone(timeZone),
      "yyyy-MM-dd'T'HH:mm",
    );
  } catch {
    return "";
  }
}

export function festivalDateLabel(
  festivalDate: string,
  timeZone?: string | null,
): string {
  try {
    const zone = safeFestivalTimeZone(timeZone);
    const midday = fromZonedTime(`${festivalDate}T12:00:00`, zone);
    return formatInTimeZone(midday, zone, "EEE MMM d");
  } catch {
    return festivalDate;
  }
}

export function festivalDateTimeInputToIso(
  localDateTime: string,
  timeZone?: string | null,
): string {
  if (!localDateTime) throw new Error("festival_local_datetime_required");
  const instant = fromZonedTime(localDateTime, safeFestivalTimeZone(timeZone));
  if (Number.isNaN(instant.getTime())) throw new Error("festival_local_datetime_invalid");
  return instant.toISOString();
}

export function buildFestivalSlotInstants(input: {
  festivalDate: string;
  localStartTime: string;
  durationMinutes: number;
  timeZone?: string | null;
  operatingHours?: FestivalStageOperatingHours | null;
}): { startsAt: string; endsAt: string } {
  const zone = safeFestivalTimeZone(input.timeZone);
  const durationMinutes = Math.max(1, Math.trunc(input.durationMinutes));
  let startsAt = fromZonedTime(
    `${input.festivalDate}T${input.localStartTime}:00`,
    zone,
  );

  const operatingStart = parseInstant(input.operatingHours?.opens_at);
  const operatingEnd = parseInstant(input.operatingHours?.curfew_at);
  if (
    operatingStart &&
    operatingEnd &&
    startsAt < operatingStart &&
    operatingEnd > operatingStart
  ) {
    const nextFestivalDate = addUtcCalendarDays(input.festivalDate, 1);
    const overnightCandidate = fromZonedTime(
      `${nextFestivalDate}T${input.localStartTime}:00`,
      zone,
    );
    if (overnightCandidate >= operatingStart && overnightCandidate <= operatingEnd) {
      startsAt = overnightCandidate;
    }
  }

  return {
    startsAt: startsAt.toISOString(),
    endsAt: addMinutes(startsAt, durationMinutes).toISOString(),
  };
}

export function buildFestivalTimelineSlots(input: {
  festivalDate: string;
  timeZone?: string | null;
  operatingHours: FestivalStageOperatingHours[];
  items: FestivalScheduleItem[];
}): FestivalTimelineSlot[] {
  const zone = safeFestivalTimeZone(input.timeZone);
  const hoursForDay = input.operatingHours.filter(
    (hours) => hours.festival_date === input.festivalDate,
  );
  const itemsForDay = input.items.filter(
    (item) => item.festival_date === input.festivalDate,
  );

  const starts = [
    ...hoursForDay.map((hours) => parseInstant(hours.opens_at)),
    ...itemsForDay.map((item) => parseInstant(item.starts_at)),
  ].filter((value): value is Date => Boolean(value));
  const ends = [
    ...hoursForDay.map((hours) => parseInstant(hours.curfew_at)),
    ...itemsForDay.map((item) => parseInstant(item.ends_at)),
  ].filter((value): value is Date => Boolean(value));

  const defaultStart = fromZonedTime(`${input.festivalDate}T08:00:00`, zone);
  const defaultEnd = fromZonedTime(
    `${addUtcCalendarDays(input.festivalDate, 1)}T00:00:00`,
    zone,
  );
  const earliest = starts.length
    ? new Date(Math.min(...starts.map((date) => date.getTime())))
    : defaultStart;
  const latest = ends.length
    ? new Date(Math.max(...ends.map((date) => date.getTime())))
    : defaultEnd;

  let cursor = floorToFestivalHour(earliest, zone);
  const end = latest > cursor ? latest : addMinutes(cursor, 60);
  const slots: FestivalTimelineSlot[] = [];

  while (cursor < end && slots.length < MAX_TIMELINE_HOURS) {
    const next = addMinutes(cursor, 60);
    const localDate = formatInTimeZone(cursor, zone, "yyyy-MM-dd");
    const dayOffset = calendarDayDifference(input.festivalDate, localDate);
    const timeLabel = formatInTimeZone(cursor, zone, "HH:mm");
    slots.push({
      key: cursor.toISOString(),
      startsAt: cursor.toISOString(),
      endsAt: next.toISOString(),
      label: dayOffset > 0 ? `${timeLabel} (+${dayOffset})` : timeLabel,
      dayOffset,
    });
    cursor = next;
  }

  return slots;
}

export function itemStartsInTimelineSlot(
  item: FestivalScheduleItem,
  slot: FestivalTimelineSlot,
): boolean {
  const startsAt = parseInstant(item.starts_at);
  if (!startsAt) return false;
  return startsAt >= new Date(slot.startsAt) && startsAt < new Date(slot.endsAt);
}

export function findStageOperatingHours(
  operatingHours: FestivalStageOperatingHours[],
  stageId: string,
  festivalDate: string,
): FestivalStageOperatingHours | null {
  return (
    operatingHours.find(
      (hours) =>
        hours.stage_id === stageId && hours.festival_date === festivalDate,
    ) ?? null
  );
}

function floorToFestivalHour(value: Date, timeZone: string): Date {
  const localHour = formatInTimeZone(value, timeZone, "yyyy-MM-dd'T'HH':00:00'");
  return fromZonedTime(localHour, timeZone);
}

function parseInstant(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addUtcCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function calendarDayDifference(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  return Math.round((endMs - startMs) / 86_400_000);
}
