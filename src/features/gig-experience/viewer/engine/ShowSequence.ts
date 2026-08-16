import type { StoryModel } from "./StoryEngine";
import type { StageType } from "./VenueLayout";

/**
 * Presentation-only show sequence: house/stage lighting, curtains, band entries
 * and exits, encore break and the final bow. Everything is derived from the
 * stored replay story (song timings plus the recorded encore/finale events), so
 * the same replay always produces the same staging.
 */
export type ShowStagePhase =
  | "pre_show"
  | "band_entry"
  | "main_set"
  | "encore_break"
  | "encore"
  | "bows"
  | "load_out";

export interface ShowSequenceModel {
  /** True when the venue archetype has house curtains that can fly in and out. */
  curtains: boolean;
  hasEncore: boolean;
  firstSongMs: number;
  entryStartMs: number;
  mainSetEndMs: number;
  encoreBreakStartMs: number | null;
  encoreStartMs: number | null;
  showEndMs: number;
  bowsEndMs: number;
  encoreCueMs: number | null;
  bowsStartMs: number;
}

export interface ShowSequenceFrame {
  phase: ShowStagePhase;
  /** 0 = stage blackout, 1 = full show lighting. */
  stageLight: number;
  /** 0 = house lights out, 1 = full house/work lights up. */
  houseLight: number;
  /** 0 = curtain flown out, 1 = fully closed across the stage. */
  curtain: number;
  bandOnStage: boolean;
  /** 0..1 amount of the crowd holding phone lights up. */
  phoneLights: number;
  /** 0..1 rhythmic "one more song" chant/stomp intensity. */
  chant: number;
  /** 0..1 sustained applause intensity. */
  applause: number;
}

const ENTRY_LEAD_MS = 6_000;
const ENCORE_BREAK_MS = 14_000;
const BOWS_MS = 9_000;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => clamp01(value) * clamp01(value) * (3 - 2 * clamp01(value));

export function stageHasCurtains(stageType: StageType): boolean {
  return stageType === "theater" || stageType === "arena" || stageType === "arena_bowl";
}

export function buildShowSequence({
  story,
  stageType,
  durationMs,
}: {
  story: StoryModel;
  stageType: StageType;
  durationMs: number;
}): ShowSequenceModel {
  const songs = story.songs;
  const firstSongMs = songs[0]?.startMs ?? 0;
  const lastEndMs = songs.at(-1)?.endMs ?? Math.max(0, durationMs);
  const encoreCueMs = story.encoreEvent?.scheduledOffsetMs ?? null;
  const encoreSongs = encoreCueMs === null ? [] : songs.filter((song) => song.startMs >= encoreCueMs);
  const hasEncore = encoreSongs.length > 0;
  const encoreStartMs = hasEncore ? encoreSongs[0].startMs : null;
  const mainSetEndMs = hasEncore
    ? songs.filter((song) => song.startMs < (encoreStartMs ?? 0)).at(-1)?.endMs ?? encoreCueMs ?? firstSongMs
    : lastEndMs;
  const encoreBreakStartMs = hasEncore ? Math.min(mainSetEndMs, (encoreStartMs ?? 0) - ENCORE_BREAK_MS) : null;
  const showEndMs = lastEndMs;

  return {
    curtains: stageHasCurtains(stageType),
    hasEncore,
    firstSongMs,
    entryStartMs: Math.max(0, firstSongMs - ENTRY_LEAD_MS),
    mainSetEndMs,
    encoreBreakStartMs,
    encoreStartMs,
    showEndMs,
    bowsStartMs: showEndMs,
    bowsEndMs: showEndMs + BOWS_MS,
    encoreCueMs,
  };
}

export function deriveShowSequenceFrame(
  model: ShowSequenceModel,
  positionMs: number,
  reducedMotion = false,
): ShowSequenceFrame {
  const curtainsAvailable = model.curtains;
  const flatten = (value: number) => (reducedMotion ? (value > 0.5 ? 1 : 0) : value);

  // Doors and pre-show: house lights up, stage dark, curtain in.
  if (positionMs < model.entryStartMs) {
    return {
      phase: "pre_show",
      stageLight: 0.06,
      houseLight: 0.85,
      curtain: curtainsAvailable ? 1 : 0,
      bandOnStage: false,
      phoneLights: 0.12,
      chant: 0.25,
      applause: 0,
    };
  }

  // Band entry: house lights fade, curtain flies out, stage lights build.
  if (positionMs < model.firstSongMs) {
    const t = ease((positionMs - model.entryStartMs) / Math.max(1, model.firstSongMs - model.entryStartMs));
    return {
      phase: "band_entry",
      stageLight: 0.06 + t * 0.94,
      houseLight: 0.85 * (1 - t),
      curtain: curtainsAvailable ? flatten(1 - t) : 0,
      bandOnStage: t > 0.35,
      phoneLights: 0.3 * (1 - t) + 0.1,
      chant: 0.4 * (1 - t),
      applause: t > 0.3 ? 0.8 : 0.2,
    };
  }

  // Encore break: band walks off, half curtain, phone lights and chanting.
  if (
    model.hasEncore &&
    model.encoreBreakStartMs !== null &&
    model.encoreStartMs !== null &&
    positionMs >= model.encoreBreakStartMs &&
    positionMs < model.encoreStartMs
  ) {
    const span = Math.max(1, model.encoreStartMs - model.encoreBreakStartMs);
    const t = clamp01((positionMs - model.encoreBreakStartMs) / span);
    const walkOff = clamp01(t / 0.25);
    const walkBack = clamp01((t - 0.82) / 0.18);
    return {
      phase: "encore_break",
      stageLight: 0.1 + walkBack * 0.9,
      houseLight: 0.18 * (1 - walkBack),
      curtain: curtainsAvailable ? flatten(0.45 * walkOff * (1 - walkBack)) : 0,
      bandOnStage: walkOff < 1 ? true : walkBack > 0.4,
      phoneLights: 0.85 * (1 - walkBack),
      chant: 0.55 + walkOff * 0.45 - walkBack * 0.6,
      applause: 0.5 + walkBack * 0.5,
    };
  }

  // Final bow: confetti, sustained applause, curtain flies in and the band leaves.
  if (positionMs >= model.bowsStartMs && positionMs < model.bowsEndMs) {
    const t = ease((positionMs - model.bowsStartMs) / Math.max(1, model.bowsEndMs - model.bowsStartMs));
    return {
      phase: "bows",
      stageLight: 1 - t * 0.85,
      houseLight: t * 0.6,
      curtain: curtainsAvailable ? flatten(t) : 0,
      bandOnStage: t < 0.72,
      phoneLights: 0.2,
      chant: 0.25,
      applause: 1 - t * 0.35,
    };
  }

  // After the bow: stage dark, house lights up, crowd heads for the exits.
  if (positionMs >= model.bowsEndMs) {
    return {
      phase: "load_out",
      stageLight: 0.05,
      houseLight: 0.9,
      curtain: curtainsAvailable ? 1 : 0,
      bandOnStage: false,
      phoneLights: 0.08,
      chant: 0,
      applause: 0.2,
    };
  }

  const inEncore = model.encoreStartMs !== null && positionMs >= model.encoreStartMs;
  return {
    phase: inEncore ? "encore" : "main_set",
    stageLight: 1,
    houseLight: 0,
    curtain: 0,
    bandOnStage: true,
    phoneLights: 0,
    chant: 0,
    applause: inEncore ? 0.35 : 0,
  };
}
