export const SKILL_LABELS = {
  guitar: "Guitar",
  bass: "Bass",
  drums: "Drums",
  vocals: "Vocals",
  performance: "Performance",
  songwriting: "Songwriting",
} as const;

export type PrimarySkill = keyof typeof SKILL_LABELS;

export const LESSON_DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

export type LessonDifficulty = (typeof LESSON_DIFFICULTIES)[number];

export const LESSON_DIFFICULTY_CONFIG: Record<
  LessonDifficulty,
  { label: string; multiplier: number; description: string }
> = {
  beginner: { label: "Foundation", multiplier: 1, description: "Core fundamentals" },
  intermediate: { label: "Growth", multiplier: 1.25, description: "Challenging expansions" },
  advanced: { label: "Expert", multiplier: 1.45, description: "High-intensity mastery" },
};

export const DIFFICULTY_ORDER: Record<LessonDifficulty, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};
