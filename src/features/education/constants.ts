export const SKILL_LABELS = {
  guitar: "Guitar",
  bass: "Bass",
  drums: "Drums",
  vocals: "Vocals",
  performance: "Performance",
  songwriting: "Songwriting",
  string_instruments: "Acoustic Strings",
  advanced_strings: "Advanced Strings",
  modern_bass: "Modern Bass Techniques",
  keyboard_piano: "Keyboard & Piano",
  synths_keys: "Synths & Electronic Keys",
  percussion_drums: "Percussion & Drums",
  electronic_percussion: "Electronic Percussion",
  wind_instruments: "Wind Instruments",
  brass_instruments: "Brass Instruments",
  world_folk: "World & Folk Instruments",
  dj_live: "DJ & Live Production",
  electronic_sampling: "Electronic Production & Sampling",
  vocal_performance: "Vocal Performance",
  vocal_fx: "Vocal Effects & Technology",
  hybrid_experimental: "Hybrid & Experimental Instruments",
  orchestral_cinematic: "Orchestral & Cinematic",
  digital_music_tools: "Digital Music Tools",
  sound_engineering: "Sound Engineering & Studio",
  songwriting_arrangement: "Songwriting & Arrangement",
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
