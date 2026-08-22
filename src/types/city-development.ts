export interface CityDevelopment {
  city_id: string;
  economy: number;
  infrastructure: number;
  transport: number;
  public_safety: number;
  healthcare: number;
  culture: number;
  music_scene: number;
  tourism: number;
  quality_of_life: number;
  education: number;
  updated_at: string;
}

export interface CityGameplayModifiers {
  economy_rating: number;
  infrastructure_rating: number;
  transport_rating: number;
  public_safety_rating: number;
  healthcare_rating: number;
  culture_rating: number;
  music_scene_rating: number;
  tourism_rating: number;
  quality_of_life_rating: number;
  education_rating: number;
  economy_revenue_multiplier: number;
  audience_demand_multiplier: number;
  travel_cost_multiplier: number;
  travel_duration_multiplier: number;
  incident_risk_multiplier: number;
  recovery_multiplier: number;
  festival_demand_multiplier: number;
  tax_base_multiplier: number;
  logistics_multiplier: number;
  local_talent_multiplier: number;
}

export type CityDevelopmentRatingKey =
  | "economy"
  | "infrastructure"
  | "transport"
  | "public_safety"
  | "healthcare"
  | "culture"
  | "music_scene"
  | "tourism"
  | "quality_of_life"
  | "education";

export const CITY_DEVELOPMENT_LABELS: Record<CityDevelopmentRatingKey, string> = {
  economy: "Economy",
  infrastructure: "Infrastructure",
  transport: "Transport",
  public_safety: "Public Safety",
  healthcare: "Healthcare",
  culture: "Culture",
  music_scene: "Music Scene",
  tourism: "Tourism",
  quality_of_life: "Quality of Life",
  education: "Education",
};

export function cityRatingBand(value: number) {
  if (value >= 85) return "World class";
  if (value >= 70) return "Excellent";
  if (value >= 55) return "Strong";
  if (value >= 45) return "Stable";
  if (value >= 30) return "Weak";
  return "Critical";
}
