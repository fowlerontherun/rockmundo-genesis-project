export type MinigameType = "rhythm" | "lyric" | "soundcheck";

export interface MinigameSimulationInput {
  difficulty: number;
  skillLevel?: number;
  focus?: number;
  rng?: () => number;
}

export interface MinigameAttemptResult {
  minigameType: MinigameType;
  difficulty: number;
  score: number;
  accuracy: number;
  combo: number;
  xpGained: number;
  cashReward: number;
  success: boolean;
  durationSeconds: number;
  details: Record<string, unknown>;
}

export interface MinigameSummary {
  result: MinigameAttemptResult;
  levelsGained: number;
}
