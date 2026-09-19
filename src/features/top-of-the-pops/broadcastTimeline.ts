import type { TotpCameraShot, TotpStageKey } from "./broadcastProfile";

export type TotpBroadcastCueType = "presenter" | "graphic" | "performance" | "audience";
export type TotpMusicalSection =
  | "intro"
  | "verse_1"
  | "chorus_1"
  | "verse_2"
  | "chorus_2"
  | "bridge"
  | "finale";

export interface TotpBroadcastCue {
  id: string;
  type: TotpBroadcastCueType;
  offsetMs: number;
  durationMs: number;
  cameraShot: TotpCameraShot;
  stage: TotpStageKey;
  section?: TotpMusicalSection;
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

interface SectionWindow {
  section: TotpMusicalSection;
  startMs: number;
  durationMs: number;
}

const CLOSE_SHOTS = new Set<TotpCameraShot>([
  "presenter_close",
  "lead_close",
  "instrument_close",
  "drummer_close",
]);

const SECTION_PREFERENCES: Record<TotpMusicalSection, TotpCameraShot[]> = {
  intro: ["crane_sweep", "studio_master", "push_in", "lead_medium"],
  verse_1: ["lead_medium", "instrument_close", "side_tracking", "lead_close", "studio_master"],
  chorus_1: ["studio_master", "lead_close", "audience_reverse", "crane_sweep", "instrument_close"],
  verse_2: ["side_tracking", "instrument_close", "lead_medium", "drummer_close", "pull_back"],
  chorus_2: ["crane_sweep", "lead_close", "audience_dance", "instrument_close", "studio_master"],
  bridge: ["overhead", "drummer_close", "low_angle", "lead_medium", "pull_back"],
  finale: ["push_in", "lead_close", "audience_reverse", "pull_back", "finale_wide"],
};

const CUT_RHYTHM_MS = [5_200, 4_400, 6_100, 4_800, 5_700, 4_600] as const;

function sectionWeights(durationMs: number): Array<[TotpMusicalSection, number]> {
  if (durationMs < 75_000) {
    return [
      ["intro", 0.10],
      ["verse_1", 0.25],
      ["chorus_1", 0.30],
      ["finale", 0.35],
    ];
  }
  if (durationMs < 120_000) {
    return [
      ["intro", 0.08],
      ["verse_1", 0.22],
      ["chorus_1", 0.24],
      ["bridge", 0.18],
      ["finale", 0.28],
    ];
  }
  return [
    ["intro", 0.07],
    ["verse_1", 0.19],
    ["chorus_1", 0.18],
    ["verse_2", 0.19],
    ["chorus_2", 0.18],
    ["bridge", 0.09],
    ["finale", 0.10],
  ];
}

/**
 * Deterministic section map used when no authored song structure is available.
 * It gives the director stable musical landmarks instead of cutting on one
 * repeating browser timer.
 */
export function buildTotpMusicalSections(durationMs: number): SectionWindow[] {
  const duration = Math.max(30_000, Math.round(durationMs));
  const weights = sectionWeights(duration);
  let cursor = 0;

  return weights.map(([section, weight], index) => {
    const remaining = duration - cursor;
    const sectionDuration = index === weights.length - 1
      ? remaining
      : Math.max(1_000, Math.round(duration * weight));
    const window = { section, startMs: cursor, durationMs: Math.min(remaining, sectionDuration) };
    cursor += window.durationMs;
    return window;
  });
}

function candidateLibrary(input: TotpPerformanceTimelineInput, section: TotpMusicalSection): TotpCameraShot[] {
  const requested = input.shots.length ? input.shots : ["studio_master"];
  const preferred = SECTION_PREFERENCES[section];
  return [...new Set([...preferred.filter((shot) => requested.includes(shot)), ...requested, ...preferred])];
}

function pickDirectedShot(params: {
  input: TotpPerformanceTimelineInput;
  section: TotpMusicalSection;
  cutIndex: number;
  previous: TotpCameraShot | null;
  closeStreak: number;
  finalCut: boolean;
}): TotpCameraShot {
  if (params.finalCut) return "finale_wide";

  const library = candidateLibrary(params.input, params.section);
  const nonFinaleLibrary = library.filter((shot) => shot !== "finale_wide");
  const usable = nonFinaleLibrary.length ? nonFinaleLibrary : ["studio_master", "lead_medium"];
  const rotated = usable.map((_, index) => usable[(index + params.cutIndex) % usable.length]);
  const candidate = rotated.find((shot) =>
    shot !== params.previous
    && !(params.closeStreak >= 2 && CLOSE_SHOTS.has(shot)),
  );
  if (candidate) return candidate;

  return params.previous === "studio_master" ? "lead_medium" : "studio_master";
}

function cutDuration(sectionIndex: number, cutIndex: number, remainingMs: number): number {
  const rhythm = CUT_RHYTHM_MS[(sectionIndex * 2 + cutIndex) % CUT_RHYTHM_MS.length];
  return Math.max(1, Math.min(remainingMs, rhythm));
}

/** Builds a deterministic, section-aware TV segment around one performance. */
export function buildTotpPerformanceTimeline(input: TotpPerformanceTimelineInput): TotpBroadcastCue[] {
  const duration = Math.max(30_000, input.performanceDurationMs);
  const presenterDuration = 4_200;
  const graphicDuration = 3_200;
  const performanceStart = presenterDuration;
  const sections = buildTotpMusicalSections(duration);
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

  let previousShot: TotpCameraShot | null = null;
  let closeStreak = 0;
  let globalCut = 0;

  sections.forEach((window, sectionIndex) => {
    let localCursor = 0;
    let sectionCut = 0;

    while (localCursor < window.durationMs) {
      const remaining = window.durationMs - localCursor;
      const length = cutDuration(sectionIndex, sectionCut, remaining);
      const finalCut = window.section === "finale" && localCursor + length >= window.durationMs;
      const shot = pickDirectedShot({
        input,
        section: window.section,
        cutIndex: globalCut,
        previous: previousShot,
        closeStreak,
        finalCut,
      });

      cues.push({
        id: `performance-${globalCut + 1}-${window.section}`,
        type: "performance",
        offsetMs: performanceStart + window.startMs + localCursor,
        durationMs: length,
        cameraShot: shot,
        stage: input.stage,
        section: window.section,
      });

      closeStreak = CLOSE_SHOTS.has(shot) ? closeStreak + 1 : 0;
      previousShot = shot;
      localCursor += length;
      sectionCut += 1;
      globalCut += 1;
    }
  });

  cues.push({
    id: "applause",
    type: "audience",
    offsetMs: performanceStart + duration,
    durationMs: 3_500,
    cameraShot: "finale_wide",
    stage: input.stage,
    section: "finale",
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
