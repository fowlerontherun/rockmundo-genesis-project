import type { Tables } from "@/integrations/supabase/types";

export type PlayerXpWallet = Tables<"player_xp_wallet">;

export type ProgressionAction =
  | "award_action_xp"
  | "weekly_bonus"
  | "buy_attribute_star"
  | "respec_attributes"
  | "award_special_xp";

export type ProgressionProfileSnapshot = Partial<Tables<"profiles">> & { id: string };

export type ProgressionAttributesSnapshot = Partial<Tables<"player_attributes">> | null;

export interface ProgressionActionSuccessResponse {
  success: true;
  action: ProgressionAction;
  message?: string;
  profile: ProgressionProfileSnapshot;
  wallet: PlayerXpWallet | null;
  attributes: ProgressionAttributesSnapshot;
  cooldowns: Record<string, number>;
  result?: unknown;
}

export interface ProgressionActionErrorResponse {
  success: false;
  action?: ProgressionAction;
  message: string;
  details?: unknown;
}

export type ProgressionActionResponse =
  | ProgressionActionSuccessResponse
  | ProgressionActionErrorResponse;

export interface ProgressionSnapshot {
  profile: Tables<"profiles"> | null;
  wallet: PlayerXpWallet | null;
  attributes: Tables<"player_attributes"> | null;
}
