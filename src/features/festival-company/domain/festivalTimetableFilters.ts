import type { FestivalPublicConfirmedAct } from "./festivalLaunch";

export interface FestivalTimetableFilters {
  stageName: string;
  festivalDate: string;
  upcomingOnly: boolean;
}

const normalizeStage = (stage: string) => stage.trim().toLocaleLowerCase("en-GB");
const validInterval = (act: FestivalPublicConfirmedAct) => {
  const start = Date.parse(act.startsAt ?? "");
  const end = Date.parse(act.endsAt ?? "");
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
};

export function festivalTimetableOptions(acts: readonly FestivalPublicConfirmedAct[]) {
  return {
    stages: [...new Set(acts.map((act) => act.stageName?.trim()).filter((name): name is string => Boolean(name)))].sort(),
    days: [...new Set(acts.map((act) => act.festivalDate).filter((day): day is string => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)))].sort(),
  };
}

/** Published schedule only; never proof of live attendance or performance. */
export function filterPublishedFestivalTimetable(
  acts: readonly FestivalPublicConfirmedAct[],
  filters: FestivalTimetableFilters,
  now: number,
): FestivalPublicConfirmedAct[] {
  return acts.filter((act) =>
    validInterval(act) &&
    (!filters.stageName || normalizeStage(act.stageName ?? "") === normalizeStage(filters.stageName)) &&
    (!filters.festivalDate || act.festivalDate === filters.festivalDate) &&
    (!filters.upcomingOnly || (Number.isFinite(now) && Date.parse(act.endsAt!) > now)),
  ).sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!) || a.id.localeCompare(b.id));
}

/**
 * Mark genuine published slot overlaps for the SAME named stage. Different
 * stages can perform simultaneously; equal boundary times are not a clash.
 */
export function publishedStageOverlapIds(acts: readonly FestivalPublicConfirmedAct[]): Set<string> {
  const byStage = new Map<string, FestivalPublicConfirmedAct[]>();
  for (const act of acts) {
    if (!validInterval(act) || !act.stageName?.trim()) continue;
    const key = normalizeStage(act.stageName);
    byStage.set(key, [...(byStage.get(key) ?? []), act]);
  }

  const ids = new Set<string>();
  for (const stageActs of byStage.values()) {
    stageActs.sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));
    for (let i = 0; i < stageActs.length; i += 1) {
      const a = stageActs[i];
      const end = Date.parse(a.endsAt!);
      for (let j = i + 1; j < stageActs.length; j += 1) {
        const b = stageActs[j];
        if (Date.parse(b.startsAt!) >= end) break;
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
}
