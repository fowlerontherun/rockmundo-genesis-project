// Unified Character Relationship System Types

/**
 * Entity types that can participate in relationships
 */
export type RelationshipEntityType = 'player' | 'npc' | 'band';

/**
 * Supported relationship type tags (multiple can coexist)
 */
export type RelationshipTypeTag =
  | 'acquaintance'
  | 'friend'
  | 'close_friend'
  | 'best_friend'
  | 'rival'
  | 'nemesis'
  | 'partner'
  | 'ex_partner'
  | 'bandmate'
  | 'mentor'
  | 'protege'
  | 'business_contact'
  | 'fan'
  | 'collaborator';

/**
 * Visibility states for a relationship
 */
export type RelationshipVisibility = 'private' | 'friends_only' | 'public' | 'leaked';

/**
 * Core relationship object between two entities
 */
export interface CharacterRelationship {
  id: string;
  entity_a_id: string;
  entity_a_type: 'player';
  entity_b_id: string;
  entity_b_type: RelationshipEntityType;
  entity_b_name: string;
  relationship_types: RelationshipTypeTag[];
  affection_score: number;   // -100 to +100
  trust_score: number;       // 0–100
  attraction_score: number;  // 0–100
  loyalty_score: number;     // 0–100
  jealousy_score: number;    // 0–100
  visibility: RelationshipVisibility;
  last_interaction_at: string | null;
  last_decay_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

/**
 * Input for creating a new relationship
 */
export interface CreateRelationshipInput {
  entity_a_id: string;
  entity_b_id: string;
  entity_b_type: RelationshipEntityType;
  entity_b_name: string;
  relationship_types?: RelationshipTypeTag[];
  affection_score?: number;
  trust_score?: number;
  attraction_score?: number;
  loyalty_score?: number;
  jealousy_score?: number;
  visibility?: RelationshipVisibility;
}

/**
 * Input for updating scores
 */
export interface UpdateRelationshipScoresInput {
  affection_score?: number;
  trust_score?: number;
  attraction_score?: number;
  loyalty_score?: number;
  jealousy_score?: number;
  relationship_types?: RelationshipTypeTag[];
  visibility?: RelationshipVisibility;
}

/**
 * An interaction log entry
 */
export interface RelationshipInteraction {
  id: string;
  relationship_id: string;
  interaction_type: string;
  description: string | null;
  affection_change: number;
  trust_change: number;
  attraction_change: number;
  loyalty_change: number;
  jealousy_change: number;
  initiated_by: string | null;
  context_type: string | null;
  context_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Input for logging an interaction
 */
export interface LogInteractionInput {
  relationship_id: string;
  interaction_type: string;
  description?: string;
  affection_change?: number;
  trust_change?: number;
  attraction_change?: number;
  loyalty_change?: number;
  jealousy_change?: number;
  initiated_by?: string;
  context_type?: string;
  context_id?: string;
}

/**
 * A relationship event (threshold crossing)
 */
export interface RelationshipThresholdEvent {
  id: string;
  relationship_id: string;
  event_type: string;
  event_key: string;
  score_name: string | null;
  old_value: number | null;
  new_value: number | null;
  threshold: number | null;
  message: string | null;
  processed: boolean;
  created_at: string;
}

/**
 * Score thresholds that trigger events
 */
export const RELATIONSHIP_THRESHOLDS = {
  trust_high: { score: 'trust_score', threshold: 80, direction: 'up', event_key: 'trust_high' },
  trust_low: { score: 'trust_score', threshold: 20, direction: 'down', event_key: 'trust_low' },
  trust_broken: { score: 'trust_score', threshold: 5, direction: 'down', event_key: 'trust_broken' },
  affection_love: { score: 'affection_score', threshold: 80, direction: 'up', event_key: 'affection_love' },
  affection_hate: { score: 'affection_score', threshold: -80, direction: 'down', event_key: 'affection_hate' },
  affection_neutral: { score: 'affection_score', threshold: 0, direction: 'cross', event_key: 'affection_neutral' },
  loyalty_max: { score: 'loyalty_score', threshold: 90, direction: 'up', event_key: 'loyalty_max' },
  loyalty_betrayal: { score: 'loyalty_score', threshold: 10, direction: 'down', event_key: 'loyalty_betrayal' },
  jealousy_high: { score: 'jealousy_score', threshold: 75, direction: 'up', event_key: 'jealousy_high' },
  jealousy_dangerous: { score: 'jealousy_score', threshold: 90, direction: 'up', event_key: 'jealousy_dangerous' },
  attraction_strong: { score: 'attraction_score', threshold: 80, direction: 'up', event_key: 'attraction_strong' },
} as const;

/**
 * Decay rates per day of inactivity
 */
export const RELATIONSHIP_DECAY_RATES = {
  affection_score: -1,    // Drifts toward 0
  trust_score: -0.5,      // Slow trust erosion
  attraction_score: -0.3, // Very slow attraction fade
  loyalty_score: -0.5,    // Loyalty fades without contact
  jealousy_score: -1,     // Jealousy cools down fastest
} as const;

/**
 * Interaction type presets with default score changes
 */
export const INTERACTION_PRESETS: Record<string, Partial<LogInteractionInput>> = {
  casual_chat: { affection_change: 2, trust_change: 1, loyalty_change: 1 },
  deep_conversation: { affection_change: 5, trust_change: 3, loyalty_change: 2 },
  gift: { affection_change: 8, trust_change: 2, loyalty_change: 3 },
  betrayal: { affection_change: -20, trust_change: -30, loyalty_change: -25, jealousy_change: 15 },
  gig_together: { affection_change: 5, trust_change: 5, loyalty_change: 5 },
  argument: { affection_change: -8, trust_change: -5, jealousy_change: 5 },
  collaboration: { affection_change: 10, trust_change: 8, loyalty_change: 5 },
  competition: { affection_change: -3, jealousy_change: 10 },
  flirt: { attraction_change: 8, affection_change: 3 },
  support_crisis: { affection_change: 15, trust_change: 10, loyalty_change: 10 },
  ignore: { affection_change: -3, trust_change: -2, loyalty_change: -3 },
  public_praise: { affection_change: 5, trust_change: 3, loyalty_change: 3 },
  public_insult: { affection_change: -15, trust_change: -10, jealousy_change: 10 },
};
