import type { TotpPlannedSegment, TotpScheduleEpisode } from "./scheduleApi";

export interface TotpScheduleWeek {
  /** ISO date (YYYY-MM-DD) of the Monday that opens the week. */
  weekStart: string;
  /** ISO date (YYYY-MM-DD) of the Sunday that closes the week. */
  weekEnd: string;
  episodes: TotpScheduleEpisode[];
}

function toUtcDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const date = toUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** Monday-start week containing the given ISO date. */
export function mondayOfIso(iso: string): string {
  const date = toUtcDate(iso);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return toIso(date);
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function buildTotpScheduleWeeks(
  startIso: string,
  weeks: number,
  episodes: TotpScheduleEpisode[],
): TotpScheduleWeek[] {
  const first = mondayOfIso(startIso);
  const result: TotpScheduleWeek[] = [];
  for (let index = 0; index < Math.max(1, weeks); index += 1) {
    const weekStart = addDaysIso(first, index * 7);
    const weekEnd = addDaysIso(weekStart, 6);
    result.push({
      weekStart,
      weekEnd,
      episodes: episodes
        .filter((episode) => {
          const date = episode.episode_date.slice(0, 10);
          return date >= weekStart && date <= weekEnd;
        })
        .sort((a, b) => a.episode_date.localeCompare(b.episode_date)),
    });
  }
  return result;
}

export function plannedRuntimeSeconds(segments: TotpPlannedSegment[]): number {
  return segments.reduce((total, segment) => {
    const value = Number(segment.durationSeconds);
    return total + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);
}

export function formatPlannedRuntime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

export const TOTP_TARGET_RUNTIME_SECONDS = 20 * 60;
