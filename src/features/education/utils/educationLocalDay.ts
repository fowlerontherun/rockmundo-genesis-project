/** Match the city's calendar date used by server-side attendance processors. */
export function educationLocalDay(date: Date, timezone?: string | null): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone || "UTC",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const field = (type: string) => parts.find((part) => part.type === type)?.value || "";
    const formatted = field("year") + "-" + field("month") + "-" + field("day");
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return formatted;
  } catch {
    // An invalid timezone must not turn another character's date into "today".
  }
  return date.toISOString().slice(0, 10);
}
