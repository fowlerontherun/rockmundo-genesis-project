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
