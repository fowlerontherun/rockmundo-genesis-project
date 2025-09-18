import { supabase } from "@/integrations/supabase/client";
import type { PlayerXpWallet } from "@/hooks/useGameData";

export type ProgressionAction = "award_action_xp";

export interface ProgressionProfileSummary {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  level: number;
  experience: number;
  attribute_points_available?: number;
  skill_points_available?: number;
  updated_at: string;
}

export interface ProgressionResponse {
  success: boolean;
  action: ProgressionAction;
  message?: string;
  profile: ProgressionProfileSummary;
  wallet: PlayerXpWallet | null;
  attributes: Record<string, unknown> | null;
  cooldowns: Record<string, number>;
  result?: unknown;
}

export interface AwardActionXpInput {
  amount: number;
  category?: string;
  actionKey?: string;
  metadata?: Record<string, unknown>;
  uniqueEventId?: string;
}

export const awardActionXp = async ({
  amount,
  category = "performance",
  actionKey = "gameplay_action",
  metadata = {},
  uniqueEventId,
}: AwardActionXpInput): Promise<ProgressionResponse> => {
  const payload = {
    action: "award_action_xp" as const,
    amount,
    category,
    action_key: actionKey,
    metadata,
    event_id: uniqueEventId,
  };

  const { data, error } = await supabase.functions.invoke<ProgressionResponse>("progression", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.success) {
    throw new Error(data?.message ?? "Failed to award experience points");
  }

  return data;
};
