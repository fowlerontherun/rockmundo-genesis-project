import { supabase } from "@/integrations/supabase/client";
import type { PlayerXpWallet } from "@/hooks/useGameData";

export type ProgressionAction =
  | "award_action_xp"
  | "award_special_xp"
  | "admin_award_special_xp"
  | "admin_adjust_momentum"
  | "admin_set_daily_xp"
  | "claim_daily_xp"
  | "spend_attribute_xp"
  | "spend_skill_xp";

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

export interface AwardSpecialXpInput {
  amount: number;
  reason?: string;
  metadata?: Record<string, unknown>;
  uniqueEventId?: string;
}

export const awardSpecialXp = async ({
  amount,
  reason = "special",
  metadata = {},
  uniqueEventId,
}: AwardSpecialXpInput): Promise<ProgressionResponse> => {
  const payload = {
    action: "award_special_xp" as const,
    amount,
    bonus_type: reason,
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

export interface ClaimDailyXpInput {
  metadata?: Record<string, unknown>;
}

export const claimDailyXp = async ({ metadata = {} }: ClaimDailyXpInput = {}): Promise<ProgressionResponse> => {
  const payload = {
    action: "claim_daily_xp" as const,
    metadata,
  };

  const { data, error } = await supabase.functions.invoke<ProgressionResponse>("progression", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.success) {
    throw new Error(data?.message ?? "Failed to claim daily experience points");
  }

  return data;
};

export interface SpendAttributeXpInput {
  attributeKey: string;
  amount: number;
  metadata?: Record<string, unknown>;
  uniqueEventId?: string;
}

export const spendAttributeXp = async ({
  attributeKey,
  amount,
  metadata = {},
  uniqueEventId,
}: SpendAttributeXpInput): Promise<ProgressionResponse> => {
  const payload = {
    action: "spend_attribute_xp" as const,
    attribute_key: attributeKey,
    xp: amount,
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
    throw new Error(data?.message ?? "Failed to spend XP on attribute");
  }

  return data;
};

export interface SpendSkillXpInput {
  skillSlug: string;
  amount: number;
  metadata?: Record<string, unknown>;
  uniqueEventId?: string;
}

export const spendSkillXp = async ({
  skillSlug,
  amount,
  metadata = {},
  uniqueEventId,
}: SpendSkillXpInput): Promise<ProgressionResponse> => {
  const payload = {
    action: "spend_skill_xp" as const,
    skill_slug: skillSlug,
    xp: amount,
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
    throw new Error(data?.message ?? "Failed to invest XP into skill");
  }

  return data;
};

export interface AdminAdjustMomentumInput {
  amount: number;
  reason?: string;
  profileIds?: string[];
  applyToAll?: boolean;
  metadata?: Record<string, unknown>;
  notifyTargets?: boolean;
  uniqueEventId?: string;
}

export const adminAdjustMomentum = async ({
  amount,
  reason,
  profileIds = [],
  applyToAll = false,
  metadata = {},
  notifyTargets,
  uniqueEventId,
}: AdminAdjustMomentumInput): Promise<ProgressionResponse> => {
  const momentumAmount = Math.trunc(Number(amount));
  if (!Number.isFinite(momentumAmount) || momentumAmount === 0) {
    throw new Error("Momentum adjustment must be a non-zero integer");
  }

  const payload: Record<string, unknown> = {
    action: "admin_adjust_momentum" satisfies ProgressionAction,
    amount: momentumAmount,
    metadata,
  };

  if (typeof reason === "string" && reason.trim().length > 0) {
    payload.reason = reason;
  }

  if (Array.isArray(profileIds) && profileIds.length > 0) {
    payload.profile_ids = profileIds;
  }

  if (applyToAll) {
    payload.apply_to_all = true;
  }

  if (typeof notifyTargets === "boolean") {
    payload.notify = notifyTargets;
  }

  if (uniqueEventId) {
    payload.event_id = uniqueEventId;
  }

  const { data, error } = await supabase.functions.invoke<ProgressionResponse>("progression", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.success) {
    throw new Error(data?.message ?? "Failed to adjust player momentum");
  }

  return data;
};

export interface AdminSetDailyXpAmountInput {
  amount: number;
  reason?: string;
  metadata?: Record<string, unknown>;
  notifyPlayers?: boolean;
  applyToAll?: boolean;
  profileIds?: string[];
  uniqueEventId?: string;
}

export const adminSetDailyXpAmount = async ({
  amount,
  reason,
  metadata = {},
  notifyPlayers,
  applyToAll = false,
  profileIds = [],
  uniqueEventId,
}: AdminSetDailyXpAmountInput): Promise<ProgressionResponse> => {
  const stipendAmount = Math.trunc(Number(amount));
  if (!Number.isFinite(stipendAmount) || stipendAmount <= 0) {
    throw new Error("Daily XP stipend must be a positive integer");
  }

  const payload: Record<string, unknown> = {
    action: "admin_set_daily_xp" satisfies ProgressionAction,
    amount: stipendAmount,
    metadata,
  };

  if (typeof reason === "string" && reason.trim().length > 0) {
    payload.reason = reason;
  }

  if (typeof notifyPlayers === "boolean") {
    payload.notify = notifyPlayers;
  }

  if (applyToAll) {
    payload.apply_to_all = true;
  }

  if (Array.isArray(profileIds) && profileIds.length > 0) {
    payload.profile_ids = profileIds;
  }

  if (uniqueEventId) {
    payload.event_id = uniqueEventId;
  }

  const { data, error } = await supabase.functions.invoke<ProgressionResponse>("progression", {
    body: payload,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.success) {
    throw new Error(data?.message ?? "Failed to update the daily XP stipend");
  }

  return data;
};

export interface AdminAwardSpecialXpInput {
  amount: number;
  reason: string;
  profileIds?: string[];
  applyToAll?: boolean;
  metadata?: Record<string, unknown>;
  uniqueEventId?: string;
}

export const adminAwardSpecialXp = async ({
  amount,
  reason,
  profileIds = [],
  applyToAll = false,
  metadata = {},
  uniqueEventId,
}: AdminAwardSpecialXpInput): Promise<ProgressionResponse> => {
  const normalizedProfileIds = Array.from(
    new Set(
      profileIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    ),
  );

  const payload: Record<string, unknown> = {
    action: "admin_award_special_xp" as const,
    amount,
    reason,
    metadata,
  };

  if (applyToAll) {
    payload.apply_to_all = true;
  }

  if (normalizedProfileIds.length > 0) {
    payload.target_profile_ids = normalizedProfileIds;
  }

  if (uniqueEventId) {
    payload.event_id = uniqueEventId;
  }

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
