/** All city-hosted battles start at 19:00 LOCAL city time. */
export function formatBotbCityDate(
  scheduledDate: string,
  cityTimezone?: string | null,
  weekday: "short" | "long" = "short",
): string {
  const date = new Date(scheduledDate);
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: cityTimezone || "UTC",
      weekday,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    // Invalid timezone metadata must never break battle listings.
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC", weekday, day: "numeric", month: "short", year: "numeric",
    }).format(date);
  }
}
