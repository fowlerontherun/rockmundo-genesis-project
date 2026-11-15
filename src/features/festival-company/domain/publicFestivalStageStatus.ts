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

export function publicFestivalStageStatus(
  stage: FestivalPublicStage | undefined,
  stages: readonly FestivalPublicStage[],
  performances: readonly Performance[],
) {
  const normalise = (name: string) => name.trim().toLocaleLowerCase("en-GB");
  const name = stage && normalise(stage.name);
  if (!name || stages.filter((candidate) => normalise(candidate.name) === name).length !== 1) return null;

  // The published directory and site-plan snapshot can use different ID namespaces.
  const matching = performances.filter((entry) => normalise(entry.stageName) === name);
  if (new Set(matching.flatMap((entry) => entry.stageId ?? [])).size > 1) return null;
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
