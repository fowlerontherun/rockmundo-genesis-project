import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

export type ProgressionAction =
  | "award_action_xp"
  | "weekly_bonus"
  | "buy_attribute_star"
  | "respec_attributes"
  | "award_special_xp"
  | "admin_award_special_xp"
  | "admin_adjust_momentum"
  | "admin_set_daily_xp_amount";

export interface ProgressionProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  level: number;
  experience: number;
};
