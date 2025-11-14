export const EDUCATION_MENTOR_FOCUS_SKILLS = [
  "guitar",
  "bass",
  "drums",
  "vocals",
  "performance",
  "songwriting",
] as const;

export type EducationMentorFocusSkill = (typeof EDUCATION_MENTOR_FOCUS_SKILLS)[number];

export const EDUCATION_MENTOR_SKILL_LABELS: Record<EducationMentorFocusSkill, string> = {
  guitar: "Guitar",
  bass: "Bass",
  drums: "Drums",
  vocals: "Vocals",
  performance: "Performance",
  songwriting: "Songwriting",
};

export const EDUCATION_MENTOR_DIFFICULTIES = [
  "beginner",
  "intermediate",
  "advanced",
] as const;

export type EducationMentorDifficulty = (typeof EDUCATION_MENTOR_DIFFICULTIES)[number];

export const LANGUAGE_PROFICIENCY_LEVELS = [
  "foundation",
  "elementary",
  "intermediate",
  "upper_intermediate",
  "advanced",
  "native",
] as const;

export type LanguageProficiencyLevel = (typeof LANGUAGE_PROFICIENCY_LEVELS)[number];

export const LANGUAGE_PROFICIENCY_LABELS: Record<LanguageProficiencyLevel, string> = {
  foundation: "Foundation (A1)",
  elementary: "Elementary (A2)",
  intermediate: "Intermediate (B1)",
  upper_intermediate: "Upper Intermediate (B2)",
  advanced: "Advanced (C1)",
  native: "Native Fluency (C2)",
};

export const LANGUAGE_PROFICIENCY_DESCRIPTORS: Record<LanguageProficiencyLevel, string> = {
  foundation: "Can understand and use familiar everyday expressions and very basic phrases.",
  elementary: "Handles routine tasks requiring simple and direct information exchange.",
  intermediate: "Deals with most situations likely to arise while traveling in the language region.",
  upper_intermediate: "Interacts with a degree of fluency and spontaneity with native speakers.",
  advanced: "Expresses ideas fluently and spontaneously without much obvious searching for expressions.",
  native: "Understands virtually everything heard or read and can express with nuanced precision.",
};

export interface LanguageProficiencyRecord {
  language: string;
  proficiencyLevel: LanguageProficiencyLevel;
  proficiencyScore: number;
  immersionHours: number;
  certifications?: string[];
  studyStreakDays?: number;
  lastAssessedAt?: string | null;
}
