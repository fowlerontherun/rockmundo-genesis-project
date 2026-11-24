/** Must mirror the database trigger rules for the festive release XP bonus. */
export const FESTIVE_RELEASE_XP = 250;
export const FESTIVE_TITLE_PATTERN = /(christmas|xmas|snow)/i;

export function isFestiveTitle(title: string | null | undefined): boolean {
  return !!title && FESTIVE_TITLE_PATTERN.test(title);
}

/** Real-world December (UK) or in-game December (last 10 real days of each 120-day game year). */
export function isFestiveReleaseWindow(at: Date = new Date()): boolean {
  const ukMonth = new Intl.DateTimeFormat("en-GB", { month: "numeric", timeZone: "Europe/London" }).format(at);
  if (ukMonth === "12") return true;
  const days = Math.max(0, Math.floor((at.getTime() - Date.parse("2026-01-01T00:00:00Z")) / 86_400_000));
  return days % 120 >= 110;
}
