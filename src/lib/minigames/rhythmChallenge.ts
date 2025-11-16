import type { MinigameAttemptResult, MinigameSimulationInput } from "./types";

interface RhythmBeat {
  beat: number;
  emphasis: "normal" | "accent";
  timingWindow: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const BASE_PATTERN_LENGTH = 6;
const MAX_PATTERN_LENGTH = 16;
const BASE_TIMING_WINDOW = 0.32;
const TIMING_WINDOW_REDUCTION = 0.015;

const createRhythmPattern = (
  difficulty: number,
  rng: () => number,
): RhythmBeat[] => {
  const length = clamp(
    Math.round(BASE_PATTERN_LENGTH + difficulty * 0.8 + rng() * 3),
    BASE_PATTERN_LENGTH,
    MAX_PATTERN_LENGTH,
  );

  return Array.from({ length }, (_, index) => ({
    beat: index + 1,
    emphasis: rng() > 0.7 ? "accent" : "normal",
    timingWindow: Math.max(
      0.12,
      BASE_TIMING_WINDOW - difficulty * TIMING_WINDOW_REDUCTION,
    ),
  }));
};

const calculateRhythmPerformance = (
  pattern: RhythmBeat[],
  {
    skillLevel,
    focus,
    difficulty,
  }: { skillLevel: number; focus: number; difficulty: number },
  rng: () => number,
) => {
  const skillFactor = clamp(skillLevel / 10, 0.15, 1.6);
  const focusFactor = clamp(focus / 10, 0.25, 1.35);
  const stability = clamp(skillFactor * 0.7 + focusFactor * 0.3, 0.15, 1.5);

  const beatAccuracy = pattern.map((beat) => {
    const humanError = (rng() - 0.5) * (0.45 - stability * 0.25);
    const emphasisBonus = beat.emphasis === "accent" ? 0.05 : 0;
    const accuracy = clamp(
      stability + emphasisBonus - Math.abs(humanError),
      0,
      1,
    );

    return {
      beat,
      accuracy,
      withinWindow: accuracy >= beat.timingWindow,
    };
  });

  const hits = beatAccuracy.filter((beat) => beat.withinWindow).length;
  const accuracy = hits / pattern.length;
  const combo = Math.round(
    beatAccuracy.reduce((comboCount, beat, index) => {
      if (!beat.withinWindow) {
        return comboCount;
      }

      return comboCount + (index % 2 === 0 ? 2 : 1);
    }, 0) * (1 + stability * 0.35),
  );

  const score = Math.round(
    accuracy * 1100 + combo * 14 + difficultyScaling(difficulty) * 85,
  );

  const xpGained = Math.round(35 + difficulty * 4.5 + combo * 0.4 + accuracy * 45);
  const cashReward = Math.round(18 + difficulty * 3 + accuracy * 22 + combo * 0.35);
  const success = accuracy >= 0.58;

  return {
    accuracy,
    combo,
    score,
    xpGained,
    cashReward,
    success,
    beatAccuracy,
  };
};

const difficultyScaling = (difficulty: number) => 1 + difficulty * 0.12;

export const simulateRhythmChallenge = (
  input: MinigameSimulationInput,
): MinigameAttemptResult => {
  const rng = input.rng ?? Math.random;
  const pattern = createRhythmPattern(input.difficulty, rng);
  const performance = calculateRhythmPerformance(
    pattern,
    {
      skillLevel: input.skillLevel ?? 4,
      focus: input.focus ?? 5,
      difficulty: input.difficulty,
    },
    rng,
  );

  return {
    minigameType: "rhythm",
    difficulty: input.difficulty,
    score: performance.score,
    accuracy: Number(performance.accuracy.toFixed(2)),
    combo: performance.combo,
    xpGained: performance.xpGained,
    cashReward: performance.cashReward,
    success: performance.success,
    durationSeconds: Math.round(42 + input.difficulty * 4.5),
    details: {
      pattern,
      beatAccuracy: performance.beatAccuracy,
      timingWindow: pattern[0]?.timingWindow ?? BASE_TIMING_WINDOW,
    },
  };
};
