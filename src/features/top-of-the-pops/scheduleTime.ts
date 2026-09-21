const LONDON_TIME_ZONE = "Europe/London";

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function londonOffsetMs(date: Date): number {
  const parts = zonedParts(date);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

export function londonWallClockToIso(dateIso: string, time: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time || "");
  if (!match || !timeMatch) throw new Error("Choose a valid London date and time.");

  const wallUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
  );

  let instantMs = wallUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    instantMs = wallUtc - londonOffsetMs(new Date(instantMs));
  }

  return new Date(instantMs).toISOString();
}

export function londonTimeOfDay(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}
