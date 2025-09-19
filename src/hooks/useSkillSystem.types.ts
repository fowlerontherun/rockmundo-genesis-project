export interface SkillDefinitionRecord {
  id: string;
  slug: string;
  display_name?: string | null;
  description?: string | null;
  icon_slug?: string | null;
  base_xp_gain?: number | null;
  training_duration_minutes?: number | null;
  metadata?: Record<string, unknown> | null;
  is_trainable?: boolean | null;
}

export interface SkillRelationshipRecord {
  id: string;
  skill_slug: string;
  required_skill_slug: string;
  required_value: number;
  metadata?: Record<string, unknown> | null;
}

export interface SkillProgressRecord {
  id: string;
  profile_id: string;
  skill_slug: string;
  current_level?: number | null;
  current_xp?: number | null;
  required_xp?: number | null;
  last_practiced_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateSkillProgressInput {
  skillSlug: string;
  newSkillValue: number;
  xpGain: number;
  timestamp?: string;
  markUnlocked?: boolean;
}

export interface SkillSystemContextValue {
  definitions: SkillDefinitionRecord[];
  relationships: SkillRelationshipRecord[];
  progress: SkillProgressRecord[];
  loading: boolean;
  error: string | null;
  refreshProgress: () => Promise<void>;
  updateSkillProgress: (input: UpdateSkillProgressInput) => Promise<SkillProgressRecord | null>;
}
