import type { MinigameAttemptResult, MinigameSimulationInput } from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

interface LyricPrompt {
  phrase: string;
  scrambled: string;
  hint: string;
  difficulty: number;
}

const LYRIC_PHRASES: LyricPrompt[] = [
  {
    phrase: "Dancing under city lights",
    scrambled: "sancngid rendeu city sthgil",
    hint: "Neon skyline imagery",
    difficulty: 2,
  },
  {
    phrase: "Echoes of a midnight choir",
    scrambled: "choese fo a imgdithn ircho",
    hint: "Haunting vocal textures",
    difficulty: 3,
  },
  {
    phrase: "Hearts beat in sync tonight",
    scrambled: "strhea baet ni yncs ghttoni",
    hint: "Upbeat duet energy",
    difficulty: 1,
  },
  {
    phrase: "Waves collide with gentle fire",
    scrambled: "sveaw olclied htiw gntlee ifre",
    hint: "Contrasting imagery",
    difficulty: 4,
  },
  {
    phrase: "Dreams stitched from silver lines",
    scrambled: "sreadm ttecdshi form rslevi sneil",
    hint: "Metaphorical craftsmanship",
    difficulty: 5,
  },
];

const selectPromptsForDifficulty = (
  difficulty: number,
  rng: () => number,
): LyricPrompt[] => {
  const pool = LYRIC_PHRASES.filter((prompt) =>
    Math.abs(prompt.difficulty - difficulty) <= 2,
  );

  const target = clamp(2 + Math.round(difficulty / 2), 2, 5);
  if (pool.length <= target) {
    return pool;
  }

  const result: LyricPrompt[] = [];
  const used = new Set<number>();
  while (result.length < target) {
    const index = Math.floor(rng() * pool.length);
    if (!used.has(index)) {
      used.add(index);
      result.push(pool[index]);
    }
  }

  return result;
};

const evaluatePrompt = (
  prompt: LyricPrompt,
  skillLevel: number,
  focus: number,
  difficulty: number,
  rng: () => number,
) => {
  const baseChance = clamp(skillLevel / 10 + focus / 20, 0.15, 0.95);
  const difficultyPenalty = clamp(prompt.difficulty / (difficulty + 2), 0.6, 1.4);
  const solved = rng() < baseChance / difficultyPenalty;
  const timeSpent = clamp(
    8 + prompt.difficulty * 2 - skillLevel * 0.5 - focus * 0.2 + rng() * 4,
    4,
    35,
  );

  return {
    prompt,
    solved,
    timeSpent,
    accuracy: solved
      ? clamp(baseChance + rng() * 0.2, 0.6, 1)
      : clamp(baseChance - rng() * 0.35, 0.1, 0.75),
  };
};

export const simulateLyricScramble = (
  input: MinigameSimulationInput,
): MinigameAttemptResult => {
  const rng = input.rng ?? Math.random;
  const prompts = selectPromptsForDifficulty(input.difficulty, rng);
  const skillLevel = input.skillLevel ?? 3;
  const focus = input.focus ?? 4;

  const evaluations = prompts.map((prompt) =>
    evaluatePrompt(prompt, skillLevel, focus, input.difficulty, rng),
  );

  const solvedCount = evaluations.filter((evaluation) => evaluation.solved).length;
  const totalAccuracy = evaluations.reduce(
    (sum, evaluation) => sum + evaluation.accuracy,
    0,
  );
  const accuracy = totalAccuracy / evaluations.length;
  const score = Math.round(
    solvedCount * 260 + accuracy * 150 + input.difficulty * 75,
  );
  const combo = Math.round(
    solvedCount * (1 + (skillLevel + focus) / 15) * (accuracy + 0.4),
  );

  const xpGained = Math.round(
    28 + input.difficulty * 5 + solvedCount * 12 + accuracy * 30,
  );
  const cashReward = Math.round(14 + solvedCount * 8 + accuracy * 16);
  const success = solvedCount / prompts.length >= 0.5;

  return {
    minigameType: "lyric",
    difficulty: input.difficulty,
    score,
    accuracy: Number(accuracy.toFixed(2)),
    combo,
    xpGained,
    cashReward,
    success,
    durationSeconds: Math.round(
      evaluations.reduce((total, evaluation) => total + evaluation.timeSpent, 0),
    ),
    details: {
      prompts: evaluations,
      solvedCount,
    },
  };
};
