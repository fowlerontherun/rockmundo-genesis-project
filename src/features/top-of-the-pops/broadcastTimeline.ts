import type { TotpCameraShot, TotpStageKey } from "./broadcastProfile";

export type TotpBroadcastCueType = "presenter" | "graphic" | "performance" | "audience";

export interface TotpBroadcastCue {
  id: string;
  type: TotpBroadcastCueType;
  offsetMs: number;
  durationMs: number;
  cameraShot: TotpCameraShot;
  stage: TotpStageKey;
  presenterText?: string;
  graphic?: TotpLowerThird;
}

export interface TotpLowerThird {
  artistName: string;
  songTitle: string;
  chartRank: number;
  trendChange?: number | null;
  debut?: boolean;
}

export interface TotpPerformanceTimelineInput {
  artistName: string;
  songTitle: string;
  chartRank: number;
  presenterIntro: string;
  stage: TotpStageKey;
  performanceDurationMs: number;
  shots: TotpCameraShot[];
  trendChange?: number | null;
  debut?: boolean;
}

/** Builds a deterministic TV segment around one performance. */
export function buildTotpPerformanceTimeline(input: TotpPerformanceTimelineInput): TotpBroadcastCue[] {
  const duration = Math.max(30_000, input.performanceDurationMs);
  const presenterDuration = 7_000;
  const graphicDuration = 4_000;
  const performanceStart = presenterDuration;
  const shotDuration = Math.max(3_500, Math.floor(duration / Math.max(1, input.shots.length)));
  const cues: TotpBroadcastCue[] = [
    {
      id: "presenter-intro",
      type: "presenter",
      offsetMs: 0,
      durationMs: presenterDuration,
      cameraShot: "presenter_wide",
      stage: input.stage,
      presenterText: input.presenterIntro,
    },
    {
      id: "lower-third",
      type: "graphic",
      offsetMs: performanceStart + 800,
      durationMs: graphicDuration,
      cameraShot: input.shots[0] ?? "crane_sweep",
      stage: input.stage,
      graphic: {
        artistName: input.artistName,
        songTitle: input.songTitle,
        chartRank: input.chartRank,
        trendChange: input.trendChange,
        debut: input.debut,
      },
    },
  ];

  input.shots.forEach((shot, index) => {
    const offsetMs = performanceStart + index * shotDuration;
    if (offsetMs >= performanceStart + duration) return;
    cues.push({
      id: `performance-${index + 1}`,
      type: "performance",
      offsetMs,
      durationMs: Math.min(shotDuration, performanceStart + duration - offsetMs),
      cameraShot: shot,
      stage: input.stage,
    });
  });

  cues.push({
    id: "applause",
    type: "audience",
    offsetMs: performanceStart + duration,
    durationMs: 4_000,
    cameraShot: "finale_wide",
    stage: input.stage,
  });

  return cues.sort((a, b) => a.offsetMs - b.offsetMs || a.id.localeCompare(b.id));
}

export function formatTotpChartGraphic(graphic: TotpLowerThird): string {
  const movement = graphic.debut
    ? "NEW"
    : graphic.trendChange && graphic.trendChange > 0
      ? `▲ ${graphic.trendChange}`
      : graphic.trendChange && graphic.trendChange < 0
        ? `▼ ${Math.abs(graphic.trendChange)}`
        : "—";
  return `#${graphic.chartRank} ${movement}`;
}
