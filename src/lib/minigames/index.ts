import { simulateLyricScramble } from "./lyricScramble";
import {
  calculateProgressUpgrade,
  fetchSideHustleProgress,
  getNextLevelThreshold,
  recordMinigameAttempt,
  upsertSideHustleProgress,
} from "./progress";
import { simulateRhythmChallenge } from "./rhythmChallenge";
import { simulateSoundcheckMix } from "./soundcheckMix";
import type {
  MinigameAttemptResult,
  MinigameSimulationInput,
  MinigameSummary,
  MinigameType,
} from "./types";

const getDifficultyDescriptor = (difficulty: number): string => {
  if (difficulty <= 2) return "Beginner friendly";
  if (difficulty <= 4) return "Intermediate";
  if (difficulty <= 6) return "Seasoned";
  if (difficulty <= 8) return "Expert";
  return "Legendary";
};

export const simulateMinigameAttempt = (
  type: MinigameType,
  input: MinigameSimulationInput,
): MinigameAttemptResult => {
  switch (type) {
    case "rhythm":
      return simulateRhythmChallenge(input);
    case "lyric":
      return simulateLyricScramble(input);
    case "soundcheck":
      return simulateSoundcheckMix(input);
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unsupported minigame type: ${exhaustiveCheck}`);
    }
  }
};

export const summarizeMinigame = (
  result: MinigameAttemptResult,
  currentLevel: number,
  currentExperience: number,
): MinigameSummary => {
  const progression = calculateProgressUpgrade(
    currentLevel,
    currentExperience,
    result.xpGained,
  );

  return {
    result,
    levelsGained: progression.level - currentLevel,
  };
};

export {
  calculateProgressUpgrade,
  fetchSideHustleProgress,
  getDifficultyDescriptor,
  getNextLevelThreshold,
  recordMinigameAttempt,
  upsertSideHustleProgress,
};

export type {
  MinigameAttemptResult,
  MinigameSimulationInput,
  MinigameSummary,
  MinigameType,
};
