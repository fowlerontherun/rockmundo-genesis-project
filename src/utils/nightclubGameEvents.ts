/**
 * Nightclub theme nights follow RockMundo's accelerated 30-day-month calendar.
 * The epoch is game Y1 / January 1 (Thursday 1 January 2026), so a
 * recurring weekly club night advances once per *game* day, not once per
 * real-world day. Keep this free of Date/locale/device timezone dependencies.
 *
 * Legacy nightclub_events.scheduled_date is a PostgreSQL DATE. New dates are
 * represented with epoch year + game year - 1, MM and DD. This remains a
 * limitation for non-Gregorian dates (e.g. game February 30); moving one-off
 * events to explicit game-date columns is tracked in #4264.
 */
export interface NightclubGameDate {
  gameYear: number;
  gameMonth: number;
  gameDay: number;
}

export interface MatchableNightclubEvent {
  is_recurring: boolean;
  is_active: boolean;
  scheduled_date: string | null;
  day_of_week: number | null;
}

const GAME_DAYS_PER_MONTH = 30;
const GAME_DAYS_PER_YEAR = 360;
const EPOCH_REAL_YEAR = 2026;
const EPOCH_WEEKDAY = 4; // Thursday, JavaScript Sunday=0 indexing.

function isValidGameDate(date: NightclubGameDate | null | undefined): date is NightclubGameDate {
  return Boolean(date
    && Number.isInteger(date.gameYear) && date.gameYear > 0
    && Number.isInteger(date.gameMonth) && date.gameMonth >= 1 && date.gameMonth <= 12
    && Number.isInteger(date.gameDay) && date.gameDay >= 1 && date.gameDay <= GAME_DAYS_PER_MONTH);
}

export function gameWeekday(date: NightclubGameDate | null | undefined): number | null {
  if (!isValidGameDate(date)) return null;
  const elapsed = (date.gameYear - 1) * GAME_DAYS_PER_YEAR
    + (date.gameMonth - 1) * GAME_DAYS_PER_MONTH + date.gameDay - 1;
  return (EPOCH_WEEKDAY + elapsed) % 7;
}

export function gameDateIso(date: NightclubGameDate | null | undefined): string | null {
  if (!isValidGameDate(date)) return null;
  const year = String(EPOCH_REAL_YEAR + date.gameYear - 1).padStart(4, "0");
  return `${year}-${String(date.gameMonth).padStart(2, "0")}-${String(date.gameDay).padStart(2, "0")}`;
}

/** One-off events override a recurring theme night on the same game date. */
export function currentNightclubEvent<T extends MatchableNightclubEvent>(
  events: readonly T[],
  gameDate: NightclubGameDate | null | undefined,
): T | null {
  const dateKey = gameDateIso(gameDate);
  const weekday = gameWeekday(gameDate);
  if (dateKey === null || weekday === null) return null;

  const oneOff = events.find(event => event.is_active && !event.is_recurring
    && event.scheduled_date === dateKey);
  if (oneOff) return oneOff;

  return events.find(event => event.is_active && event.is_recurring
    && event.day_of_week === weekday) ?? null;
}
