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
