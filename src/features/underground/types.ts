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
