// Role-Playing System Types

/**
 * Character origin archetype - determines starting bonuses and flavor
 */
export interface CharacterOrigin {
  id: string;
  key: string;
  name: string;
  tagline: string;
  description: string;
  icon: string | null;
  starting_cash: number;
  starting_fame: number;
  skill_bonuses: Record<string, number>;
  reputation_modifiers: ReputationModifiers;
  unlock_requirements: Record<string, unknown> | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Personality trait that affects gameplay
 */
export type TraitCategory = 'creative' | 'social' | 'work_ethic' | 'emotional';

export interface PersonalityTrait {
  id: string;
  key: string;
  name: string;
  description: string;
  category: TraitCategory;
  icon: string | null;
  gameplay_effects: GameplayEffects;
  reputation_tendencies: ReputationModifiers;
  incompatible_with: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
}

/**
 * Gameplay effect modifiers from traits
 */
export interface GameplayEffects {
  song_quality_bonus?: number;
  creation_time_multiplier?: number;
  quality_variance?: number;
  genre_fusion_bonus?: number;
  mainstream_appeal_penalty?: number;
  genre_mastery_bonus?: number;
  older_demographic_bonus?: number;
  negotiation_bonus?: number;
  conflict_resolution_bonus?: number;
  media_attention_bonus?: number;
  controversy_chance?: number;
  connection_bonus?: number;
  opportunity_discovery?: number;
  small_venue_bonus?: number;
  large_venue_penalty?: number;
  songwriting_bonus?: number;
  activity_speed_bonus?: number;
  burnout_risk?: number;
  inspiration_bonus?: number;
  energy_drain_penalty?: number;
  resource_efficiency?: number;
  opportunity_timing?: number;
  random_opportunity_bonus?: number;
  reputation_risk?: number;
  negative_review_resistance?: number;
  learning_from_feedback_penalty?: number;
  inspiration_from_events?: number;
  negative_event_impact?: number;
  chart_competition_bonus?: number;
  rivalry_intensity?: number;
  stress_resistance?: number;
  urgency_penalty?: number;
}

/**
 * Reputation axis modifiers
 */
export interface ReputationModifiers {
  authenticity?: number;
  attitude?: number;
  reliability?: number;
  creativity?: number;
}

/**
 * Player's character identity - their RP profile
 */
export interface PlayerCharacterIdentity {
  id: string;
  profile_id: string;
  origin_id: string | null;
  trait_ids: string[];
  backstory_text: string | null;
  backstory_generated_at: string | null;
  musical_style: string | null;
  career_goal: string | null;
  starting_city_id: string | null;
  onboarding_completed_at: string | null;
  onboarding_step: number;
  custom_answers: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Player's reputation scores across 4 axes
 */
export interface PlayerReputation {
  id: string;
  profile_id: string;
  authenticity_score: number;
  attitude_score: number;
  reliability_score: number;
  creativity_score: number;
  last_updated_at: string;
  created_at: string;
}

/**
 * Reputation axis names
 */
export type ReputationAxis = 'authenticity' | 'attitude' | 'reliability' | 'creativity';

/**
 * Reputation event log entry
 */
export interface ReputationEvent {
  id: string;
  profile_id: string;
  event_type: string;
  event_source: string;
  source_id: string | null;
  axis: ReputationAxis;
  change_amount: number;
  previous_value: number;
  new_value: number;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * NPC relationship stages
 */
export type RelationshipStage = 
  | 'stranger' 
  | 'acquaintance' 
  | 'contact' 
  | 'ally' 
  | 'friend' 
  | 'rival' 
  | 'enemy';

/**
 * NPC relationship tracking
 */
export interface NPCRelationship {
  id: string;
  profile_id: string;
  npc_type: string;
  npc_id: string;
  npc_name: string;
  affinity_score: number;
  trust_score: number;
  respect_score: number;
  interaction_count: number;
  last_interaction_at: string | null;
  relationship_stage: RelationshipStage;
  notes: Array<{ date: string; note: string }>;
  created_at: string;
  updated_at: string;
}

/**
 * Reputation axis display info
 */
export interface ReputationAxisInfo {
  key: ReputationAxis;
  name: string;
  lowLabel: string;
  highLabel: string;
  lowDescription: string;
  highDescription: string;
  icon: string;
}

export const REPUTATION_AXES: ReputationAxisInfo[] = [
  {
    key: 'authenticity',
    name: 'Authenticity',
    lowLabel: 'Sell-out',
    highLabel: 'Authentic',
    lowDescription: 'Commercial deals, mainstream appeal',
    highDescription: 'Indie cred, underground respect',
    icon: 'heart',
  },
  {
    key: 'attitude',
    name: 'Attitude',
    lowLabel: 'Diva',
    highLabel: 'Humble',
    lowDescription: 'Demanding rider, premium treatment',
    highDescription: 'Easy to work with, grassroots love',
    icon: 'smile',
  },
  {
    key: 'reliability',
    name: 'Reliability',
    lowLabel: 'Flaky',
    highLabel: 'Dependable',
    lowDescription: 'Cancel gigs, miss deadlines',
    highDescription: 'Trusted partner, repeat bookings',
    icon: 'clock',
  },
  {
    key: 'creativity',
    name: 'Creativity',
    lowLabel: 'Formulaic',
    highLabel: 'Innovative',
    lowDescription: 'Safe choices, predictable sales',
    highDescription: 'Risk-taking, cult following',
    icon: 'lightbulb',
  },
];

/**
 * Trait category display info
 */
export interface TraitCategoryInfo {
  key: TraitCategory;
  name: string;
  description: string;
  icon: string;
}

export const TRAIT_CATEGORIES: TraitCategoryInfo[] = [
  {
    key: 'creative',
    name: 'Creative',
    description: 'How you approach the creative process',
    icon: 'palette',
  },
  {
    key: 'social',
    name: 'Social',
    description: 'How you interact with others in the industry',
    icon: 'users',
  },
  {
    key: 'work_ethic',
    name: 'Work Ethic',
    description: 'Your approach to work and lifestyle',
    icon: 'briefcase',
  },
  {
    key: 'emotional',
    name: 'Emotional',
    description: 'How you handle success and criticism',
    icon: 'heart',
  },
];
