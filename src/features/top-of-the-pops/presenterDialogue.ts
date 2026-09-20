import type { TotpEpisode } from "./api";
import {
  buildTotpContinuityCopyFromActs,
  totpContinuitySpeech,
  type TotpProgrammeRundownItem,
} from "./programmeContinuity";

export const TOTP_CHART_PRESENTER_LINE = "And now, let's take a look at this week's UK charts.";

export type TotpPresenterDialogueKind =
  | "opening"
  | "act_intro"
  | "between"
  | "chart"
  | "closing";

export interface TotpPresenterDialogueLine {
  id: string;
  planKey: string;
  kind: TotpPresenterDialogueKind;
  label: string;
  script: string;
  performanceId: string | null;
  bandId: string | null;
  bandName: string | null;
}

function episodeActs(episode: TotpEpisode): TotpProgrammeRundownItem[] {
  return [...episode.performances]
    .sort((a, b) => a.running_order - b.running_order || a.performance_id.localeCompare(b.performance_id))
    .map((performance) => ({
      replayId: performance.performance_id,
      runningOrder: performance.running_order,
      chartRank: performance.qualifying_rank,
      bandName: performance.band_name,
      songTitle: performance.song_title,
      stage: performance.stage_key,
    }));
}

export function buildTotpPresenterDialogue(episode: TotpEpisode): TotpPresenterDialogueLine[] {
  const acts = episodeActs(episode);
  if (acts.length === 0) return [];

  const performances = [...episode.performances]
    .sort((a, b) => a.running_order - b.running_order || a.performance_id.localeCompare(b.performance_id));
  const lines: TotpPresenterDialogueLine[] = [];

  const opening = buildTotpContinuityCopyFromActs("opening", acts, 0);
  lines.push({
    id: "opening",
    planKey: "cue:opening",
    kind: "opening",
    label: "Programme opening",
    script: totpContinuitySpeech(opening),
    performanceId: null,
    bandId: null,
    bandName: null,
  });

  performances.forEach((performance, index) => {
    if (index === performances.length - 1) {
      lines.push({
        id: "chart",
        planKey: "cue:chart",
        kind: "chart",
        label: "UK chart rundown introduction",
        script: TOTP_CHART_PRESENTER_LINE,
        performanceId: null,
        bandId: null,
        bandName: null,
      });
    }

    lines.push({
      id: `act:${performance.performance_id}`,
      // Keep the legacy performance UUID key so the Phase 0 manifest/render path
      // immediately consumes recordings made in the audio studio.
      planKey: performance.performance_id,
      kind: "act_intro",
      label: `Act ${performance.running_order} introduction — ${performance.band_name}`,
      script: performance.presenter_intro?.trim() ?? "",
      performanceId: performance.performance_id,
      bandId: performance.band_id,
      bandName: performance.band_name,
    });

    if (index < performances.length - 1) {
      const between = buildTotpContinuityCopyFromActs("between", acts, index);
      lines.push({
        id: `between:${performance.performance_id}`,
        planKey: `cue:between:${performance.performance_id}`,
        kind: "between",
        label: `Link after ${performance.band_name}`,
        script: totpContinuitySpeech(between),
        performanceId: performance.performance_id,
        bandId: performance.band_id,
        bandName: performance.band_name,
      });
    }
  });

  const closing = buildTotpContinuityCopyFromActs("closing", acts, performances.length - 1);
  lines.push({
    id: "closing",
    planKey: "cue:closing",
    kind: "closing",
    label: "Programme close",
    script: totpContinuitySpeech(closing),
    performanceId: null,
    bandId: null,
    bandName: null,
  });

  return lines;
}
