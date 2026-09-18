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
  const presenterDuration = 4_200;
  const graphicDuration = 3_200;
  const performanceStart = presenterDuration;
  const targetCutMs = duration >= 150_000 ? 4_800 : duration >= 90_000 ? 4_500 : 4_200;
  const shotDuration = Math.max(3_600, Math.min(5_400, targetCutMs));
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
      offsetMs: performanceStart + 650,
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

  const shotCount = Math.ceil(duration / shotDuration);
  for (let index = 0; index < shotCount; index += 1) {
    const shot = input.shots[index % Math.max(1, input.shots.length)] ?? "studio_master";
    const offsetMs = performanceStart + index * shotDuration;
    if (offsetMs >= performanceStart + duration) break;
    cues.push({
      id: `performance-${index + 1}`,
      type: "performance",
      offsetMs,
      durationMs: Math.min(shotDuration, performanceStart + duration - offsetMs),
      cameraShot: shot,
      stage: input.stage,
    });
  }

  cues.push({
    id: "applause",
    type: "audience",
    offsetMs: performanceStart + duration,
    durationMs: 3_500,
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
