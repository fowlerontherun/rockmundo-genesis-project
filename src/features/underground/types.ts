export type UndergroundEventType =
  | "secret_gig"
  | "afterparty"
  | "underground_party"
  | "scene_networking"
  | "risky_promoter";

export interface UndergroundState {
  profile_id: string;
  underground_cred: number;
  heat: number;
  notoriety: number;
  scene_connections: number;
  last_event_at: string | null;
}

export interface UndergroundEvent {
  id: string;
  slug: string;
  name: string;
  description: string;
  event_type: UndergroundEventType;
  risk_tier: number;
  minimum_age: number;
  min_cred: number;
  base_success_chance: number;
  success_effects: Record<string, number>;
  failure_effects: Record<string, number>;
  location_tags: string[];
}

export interface UndergroundResolution {
  ok: boolean;
  reason?: "age_restricted" | "insufficient_cred" | string;
  minimumAge?: number;
  minimumCred?: number;
  outcome?: "success" | "failure";
  event?: string;
  effects?: Record<string, number>;
  state?: {
    undergroundCred: number;
    heat: number;
    notoriety: number;
    sceneConnections: number;
  };
}

export type SubstanceCategory = "alcohol" | "stimulant" | "depressant" | "psychedelic";

export interface SubstanceCatalogItem {
  id: string;
  slug: string;
  name: string;
  category: SubstanceCategory;
  description: string;
  minimum_age: number;
  risk_tier: number;
  cash_cost: number;
  intoxication_gain: number;
  tolerance_gain: number;
  dependency_gain: number;
  immediate_effects: Record<string, number>;
  crash_effects: Record<string, number>;
}

export interface PlayerSubstanceState {
  profile_id: string;
  substance_slug: string;
  intoxication: number;
  tolerance: number;
  dependency: number;
  total_uses: number;
  last_used_at: string | null;
  hangover_until: string | null;
  crash_until: string | null;
}

export interface SubstanceUseResolution {
  ok: boolean;
  reason?: string;
  minimumAge?: number;
  cashCost?: number;
  substance?: string;
  category?: SubstanceCategory;
  effects?: Record<string, number>;
  intoxication?: number;
  tolerance?: number;
  dependency?: number;
  hangoverUntil?: string | null;
  crashUntil?: string | null;
  highRisk?: boolean;
}

export type SceneContactStatus =
  | "stranger"
  | "acquaintance"
  | "flirting"
  | "casual"
  | "dating"
  | "exclusive"
  | "cooling_off"
  | "ended";

export type SceneInteraction = "talk" | "flirt" | "private_time" | "date" | "define_relationship" | "cool_off";

export interface SceneContactArchetype {
  slug: string;
  name: string;
  description: string;
  romance_openness: number;
  discretion: number;
  social_energy: number;
  gossip_bias: number;
}

export interface SceneContact {
  id: string;
  profile_id: string;
  npc_name: string;
  npc_age: number;
  archetype_slug: string;
  chemistry: number;
  trust: number;
  attachment: number;
  tension: number;
  gossip_exposure: number;
  encounter_count: number;
  relationship_status: SceneContactStatus;
  last_interaction_at: string | null;
  cooldown_until: string | null;
  discovered_at: string;
  archetype?: SceneContactArchetype | null;
}

export interface SceneContactDiscoveryResolution {
  ok: boolean;
  reason?: string;
  minimumAge?: number;
  created?: number;
  limit?: number;
}

export interface SceneContactResolution {
  ok: boolean;
  reason?: string;
  minimumAge?: number;
  cooldownUntil?: string;
  requiredChemistry?: number;
  requiredTrust?: number;
  requiredAttachment?: number;
  outcome?: "positive" | "neutral" | "declined" | "ended";
  mutualInterest?: boolean | null;
  message?: string;
  status?: SceneContactStatus;
  changes?: Record<string, number>;
  wellness?: Record<string, number>;
  romanceId?: string | null;
  gossipLeaked?: boolean;
  existingRelationshipAffected?: boolean;
}

export type ScandalStage = "rumor" | "press" | "frenzy" | "fading" | "resolved";
export type ScandalCategory =
  | "relationship"
  | "nightlife"
  | "property_damage"
  | "altercation"
  | "substance"
  | "promoter"
  | "authority"
  | "media"
  | "other";
export type ScandalResponse = "ignore" | "apologize" | "deny" | "lean_in" | "consultant" | "disappear" | "pay_fine";

export interface PlayerScandal {
  id: string;
  profile_id: string;
  source_type: string;
  source_id: string | null;
  category: ScandalCategory;
  headline: string;
  summary: string;
  stage: ScandalStage;
  severity: number;
  credibility: number;
  exposure: number;
  response_choice: Exclude<ScandalResponse, "pay_fine"> | null;
  response_outcome: string | null;
  fine_amount: number;
  fine_paid: boolean;
  venue_restriction_until: string | null;
  travel_scrutiny_until: string | null;
  media_blackout_until: string | null;
  next_escalation_at: string;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ScandalProcessResolution {
  ok: boolean;
  processed?: number;
  heat?: number;
  reason?: string;
}

export interface ScandalResponseResolution {
  ok: boolean;
  reason?: string;
  response?: ScandalResponse;
  success?: boolean;
  message?: string;
  cashSpent?: number;
  heatChange?: number;
  changes?: Record<string, number>;
  required?: number;
}
