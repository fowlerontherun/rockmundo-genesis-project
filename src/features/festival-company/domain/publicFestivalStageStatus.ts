import type { FestivalPublicStage } from "./festivalLaunch";
import type { FestivalPerformanceStatus, FestivalPublicLiveStatus } from "./festivalRuntime";

const labels = {
  soundcheck: "Soundcheck",
  changeover: "Changeover",
  starting: "Starting",
  live: "Live",
  delayed: "Delayed",
  cancelled: "Cancelled",
} satisfies Partial<Record<FestivalPerformanceStatus, string>>;

type PublicStageStatus = keyof typeof labels;
type Performance = FestivalPublicLiveStatus["performances"][number];

export function filterFreshPublicFestivalPerformances(
  performances: readonly Performance[], now: number,
): Performance[] {
  return performances.filter((entry) => {
    const age = now - Date.parse(entry.observedAt ?? "");
    const maxAge = entry.status === "cancelled" || entry.status === "completed" ? 120 : 10;
    return Boolean(entry.stageId) && age >= -60_000 && age <= maxAge * 60_000;
  });
}

export function publicFestivalStageStatus(
  stage: FestivalPublicStage | undefined,
  performances: readonly Performance[],
) {
  if (!stage) return null;
  const matching = performances.filter((entry) => entry.stageId === stage.id);
  const active = matching.filter((entry) =>
    entry.status === "soundcheck" || entry.status === "changeover" ||
    entry.status === "starting" || entry.status === "live");
  if (active.length > 1) return null;
  const current = active[0] ?? matching.find((entry) => entry.status === "delayed") ??
    matching.find((entry) => entry.status === "cancelled");
  if (!current) return null;

  return {
    performance: current,
    label: labels[current.status as PublicStageStatus],
    cancelled: matching.filter((entry) => entry.status === "cancelled"),
  };
}
