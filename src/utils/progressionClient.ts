import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ProgressionAction =
  | "award_action_xp"
  | "weekly_bonus"
  | "buy_attribute_star"
  | "respec_attributes"
  | "award_special_xp";

export interface ProgressionProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  level: number;
  experience: number;
};
