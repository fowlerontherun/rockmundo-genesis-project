import type { FestivalPublicConfirmedAct } from "./festivalLaunch";

/**
 * Schedule-derived stage activity is never evidence of a performance going live.
 * Use official confirmed act times, not provisional generated timetable slots.
 */
export interface StageTimetableProgress {
  kind: "scheduled_now" | "next" | "finished" | "unpublished";
  act: FestivalPublicConfirmedAct | null;
  progressPercent: number | null;
}

const normalizedStage = (name: string) => name.trim().toLocaleLowerCase("en-GB");

export function stageTimetableProgress(
  stageName: string,
  lineup: readonly FestivalPublicConfirmedAct[],
  now: number,
): StageTimetableProgress {
  if (!Number.isFinite(now)) return { kind: "unpublished", act: null, progressPercent: null };
  const key = normalizedStage(stageName);
  const scheduled = lineup
    .filter((act) => {
      if (!act.stageName || normalizedStage(act.stageName) !== key ||
          !act.startsAt || !act.endsAt) return false;
      const start = Date.parse(act.startsAt);
      const end = Date.parse(act.endsAt);
      return Number.isFinite(start) && Number.isFinite(end) && end > start;
    })
    .slice()
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!) || a.id.localeCompare(b.id));

  if (!scheduled.length) return { kind: "unpublished", act: null, progressPercent: null };

  const current = scheduled.find((act) => Date.parse(act.startsAt!) <= now && now < Date.parse(act.endsAt!));
  if (current) {
    const start = Date.parse(current.startsAt!);
    const end = Date.parse(current.endsAt!);
    return {
      kind: "scheduled_now",
      act: current,
      progressPercent: Math.max(0, Math.min(100, Math.floor(((now - start) / (end - start)) * 100))),
    };
  }
  const next = scheduled.find((act) => Date.parse(act.startsAt!) > now);
  return next
    ? { kind: "next", act: next, progressPercent: null }
    : { kind: "finished", act: null, progressPercent: null };
}
