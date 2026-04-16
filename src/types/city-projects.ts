// City Projects & Mayor Governance Types

export type CityProjectCategory = 'infrastructure' | 'culture' | 'economy' | 'quality_of_life';
export type CityProjectStatus = 'proposed' | 'in_progress' | 'completed' | 'cancelled' | 'failed';

export interface CityProjectEffects {
  venues?: number;
  music_scene?: number;
  local_bonus?: number;
  population?: number;
  max_concert_capacity?: number;
  weekly_budget_bonus?: number;
}

export interface CityProjectType {
  id: string;
  slug: string;
  category: CityProjectCategory;
  name: string;
  description: string | null;
  base_cost: number;
  duration_days: number;
  effects: CityProjectEffects;
  approval_change: number;
  required_skill_slug: string | null;
  required_skill_level: number;
  icon: string | null;
  created_at: string;
}

export interface CityProject {
  id: string;
  city_id: string;
  mayor_id: string | null;
  project_type_id: string | null;
  name: string;
  description: string | null;
  cost: number;
  duration_days: number;
  status: CityProjectStatus;
  started_at: string;
  completes_at: string;
  completed_at: string | null;
  effects: CityProjectEffects;
  approval_change: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  project_type?: CityProjectType;
}

export interface MayorActionLog {
  id: string;
  city_id: string;
  mayor_id: string | null;
  action_type: string;
  amount: number | null;
  target_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const PROJECT_CATEGORY_LABELS: Record<CityProjectCategory, string> = {
  infrastructure: 'Infrastructure',
  culture: 'Culture',
  economy: 'Economy',
  quality_of_life: 'Quality of Life',
};

export const PROJECT_STATUS_LABELS: Record<CityProjectStatus, string> = {
  proposed: 'Proposed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

// Politics skill thresholds
export const POLITICS_THRESHOLDS = {
  BASIC: 200,
  PROFESSIONAL: 500,
  MASTER: 800,
} as const;

export const POLITICS_SKILLS = [
  'basic_public_speaking',
  'basic_negotiation',
  'basic_governance',
  'professional_diplomacy',
  'professional_campaign_strategy',
  'master_statecraft',
] as const;

export type PoliticsSkillSlug = typeof POLITICS_SKILLS[number];
