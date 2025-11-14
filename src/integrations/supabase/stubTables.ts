// Temporary stub for missing table types until Supabase types are regenerated

import type { LanguageProficiencyLevel } from "@/types/education";

export interface University {
  id: string;
  name: string;
  description?: string;
  course_cost: number;
  reputation: number;
  location?: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileActivityStatus {
  id: string;
  profile_id: string;
  activity_type: string;
  status: string;
  started_at: string;
  completed_at?: string;
  metadata?: Record<string, any>;
}

export interface EducationYoutubeLesson {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  skill_focus: string;
  difficulty: number;
  duration_minutes?: number;
  created_at: string;
  updated_at: string;
}

export interface PlayerLanguageProficiency {
  id: string;
  profile_id: string;
  language: string;
  proficiency_level: LanguageProficiencyLevel;
  proficiency_score: number;
  immersion_hours: number;
  study_streak_days: number;
  certifications?: string[];
  last_assessed_at?: string | null;
  created_at: string;
  updated_at: string;
}

// Export stub functions for missing tables
export const getUniversities = async () => {
  console.warn('Universities table not yet implemented');
  return { data: [], error: null };
};

export const getProfileActivityStatuses = async () => {
  console.warn('Profile activity statuses table not yet implemented');
  return { data: [], error: null };
};

export const getEducationYoutubeLessons = async () => {
  console.warn('Education YouTube lessons table not yet implemented');
  return { data: [], error: null };
};

export const getPlayerLanguageProficiencies = async () => {
  console.warn('Player language proficiencies table not yet implemented');
  return { data: [], error: null };
};

