import type { Json } from "@/integrations/supabase/types";

export interface LifestylePropertyFeature {
  id: string;
  property_id: string;
  feature_name: string;
  feature_type: string;
  description: string | null;
  upgrade_cost: number;
  impact: Json | null;
}

export interface LifestylePropertyFinancingOption {
  id: string;
  property_id: string;
  name: string;
  description: string | null;
  down_payment_pct: number;
  interest_rate: number;
  term_months: number;
  closing_cost_pct: number | null;
  requirements: Json | null;
}

export interface LifestyleProperty {
  id: string;
  name: string;
  city: string;
  district: string | null;
  property_type: string;
  base_price: number;
  bedrooms: number;
  bathrooms: number;
  area_sq_ft: number | null;
  lot_size_sq_ft: number | null;
  image_url: string | null;
  highlight_features: string[] | null;
  description: string | null;
  energy_rating: string | null;
  lifestyle_fit: Json | null;
  rating: number | null;
  available: boolean | null;
  lifestyle_property_features?: LifestylePropertyFeature[];
  lifestyle_property_financing_options?: LifestylePropertyFinancingOption[];
}

export interface LifestylePropertyPurchase {
  id: string;
  user_id: string;
  property_id: string;
  financing_option_id: string | null;
  selected_features: Json | null;
  total_upgrade_cost: number;
  purchase_price: number;
  status: string;
  created_at: string;
  notes: string | null;
}
