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
  attribute_points_available: number;
  skill_points_available: number;
  last_point_conversion_at: string | null;
  created_at: string;
  updated_at: string;
  is_active?: boolean | null;
}

export type PlayerXpWalletSnapshot = {
  profile_id: string | null;
  xp_balance: number;
  lifetime_xp: number;
  xp_spent: number;
  attribute_points_earned: number;
  skill_points_earned: number;
  last_recalculated: string | null;
};

export type ProgressionAttributesSnapshot = Tables<"player_attributes"> | null;

export const PROGRESSION_COOLDOWN_KEYS = [
  "weekly_bonus",
  "award_action_xp",
  "award_special_xp",
  "buy_attribute_star",
  "respec_attributes"
] as const;

export type ProgressionCooldownKey = (typeof PROGRESSION_COOLDOWN_KEYS)[number];
export type ProgressionCooldowns = Record<ProgressionCooldownKey, number>;

export const DEFAULT_PROGRESSION_COOLDOWNS: ProgressionCooldowns = PROGRESSION_COOLDOWN_KEYS.reduce(
  (acc, key) => {
    acc[key] = 0;
    return acc;
  },
  {} as ProgressionCooldowns
);

export type ProgressionStateSnapshot = {
  profile: ProgressionProfile | null;
  wallet: PlayerXpWalletSnapshot | null;
  attributes: ProgressionAttributesSnapshot;
  cooldowns: ProgressionCooldowns;
};

type RawProgressionResponse = {
  success: boolean;
  action?: string;
  message?: string;
  result?: unknown;
  details?: unknown;
  profile?: unknown;
  wallet?: unknown;
  attributes?: unknown;
  cooldowns?: unknown;
};

export type ProgressionFunctionResult = {
  success: boolean;
  action?: ProgressionAction;
  message?: string;
  result?: unknown;
  details?: unknown;
  state: ProgressionStateSnapshot;
};

export interface InvokeProgressionOptions {
  action: ProgressionAction;
  body?: Record<string, unknown>;
  signal?: AbortSignal;
  fallbackProfileId?: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const UNKNOWN_TIMESTAMP = new Date(0).toISOString();

const normalizeProfile = (value: unknown): ProgressionProfile | null => {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  const profile: ProgressionProfile = {
    id: value.id,
    user_id: typeof value.user_id === "string" ? value.user_id : "",
    username: typeof value.username === "string" ? value.username : "",
    display_name:
      typeof value.display_name === "string" || value.display_name === null
        ? (value.display_name as string | null)
        : null,
    level: toNumber(value.level),
    experience: toNumber(value.experience),
    attribute_points_available: toNumber(value.attribute_points_available),
    skill_points_available: toNumber(value.skill_points_available),
    last_point_conversion_at:
      typeof value.last_point_conversion_at === "string"
        ? value.last_point_conversion_at
        : null,
    created_at:
      typeof value.created_at === "string" && value.created_at.length > 0
        ? value.created_at
        : UNKNOWN_TIMESTAMP,
    updated_at:
      typeof value.updated_at === "string" && value.updated_at.length > 0
        ? value.updated_at
        : UNKNOWN_TIMESTAMP,
    is_active: typeof value.is_active === "boolean" ? value.is_active : null
  };

  return profile;
};

const normalizeWallet = (
  value: unknown,
  fallbackProfileId?: string | null
): PlayerXpWalletSnapshot | null => {
  if (!isRecord(value)) {
    return null;
  }

  const profileId = typeof value.profile_id === "string" ? value.profile_id : fallbackProfileId ?? null;

  return {
    profile_id: profileId,
    xp_balance: toNumber(value.xp_balance),
    lifetime_xp: toNumber(value.lifetime_xp),
    xp_spent: toNumber(value.xp_spent),
    attribute_points_earned: toNumber(value.attribute_points_earned),
    skill_points_earned: toNumber(value.skill_points_earned),
    last_recalculated:
      typeof value.last_recalculated === "string" ? value.last_recalculated : null
  };
};

const normalizeAttributes = (value: unknown): ProgressionAttributesSnapshot => {
  if (!isRecord(value)) {
    return null;
  }

  return value as Tables<"player_attributes">;
};

const normalizeCooldowns = (value: unknown): ProgressionCooldowns => {
  if (!isRecord(value)) {
    return { ...DEFAULT_PROGRESSION_COOLDOWNS };
  }

  const normalized: ProgressionCooldowns = { ...DEFAULT_PROGRESSION_COOLDOWNS };

  for (const key of PROGRESSION_COOLDOWN_KEYS) {
    const raw = value[key];
    normalized[key] = toNumber(raw);
    if (normalized[key] < 0) {
      normalized[key] = 0;
    } else {
      normalized[key] = Math.floor(normalized[key]);
    }
  }

  return normalized;
};

const normalizeResponse = (
  payload: RawProgressionResponse | null | undefined,
  fallbackProfileId?: string | null
): ProgressionFunctionResult => {
  const state: ProgressionStateSnapshot = {
    profile: null,
    wallet: null,
    attributes: null,
    cooldowns: { ...DEFAULT_PROGRESSION_COOLDOWNS }
  };

  if (!payload) {
    return {
      success: false,
      message: "Unknown progression response",
      state
    };
  }

  state.profile = normalizeProfile(payload.profile);
  state.wallet = normalizeWallet(payload.wallet, fallbackProfileId ?? state.profile?.id ?? null);
  state.attributes = normalizeAttributes(payload.attributes);
  state.cooldowns = normalizeCooldowns(payload.cooldowns);

  const action =
    typeof payload.action === "string" &&
    (PROGRESSION_ACTIONS as readonly string[]).includes(payload.action)
      ? (payload.action as ProgressionAction)
      : undefined;

  return {
    success: Boolean(payload.success),
    action,
    message: typeof payload.message === "string" ? payload.message : undefined,
    result: payload.result,
    details: payload.details,
    state
  };
};

const PROGRESSION_ACTIONS = [
  "award_action_xp",
  "weekly_bonus",
  "buy_attribute_star",
  "respec_attributes",
  "award_special_xp"
] as const satisfies readonly string[];

export const invokeProgression = async ({
  action,
  body,
  signal,
  fallbackProfileId
}: InvokeProgressionOptions): Promise<ProgressionFunctionResult> => {
  const requestBody = {
    ...(body ?? {}),
    action
  };

  const { data, error } = await supabase.functions.invoke<RawProgressionResponse>(
    "progression",
    {
      body: requestBody,
      signal
    }
  );

  if (error) {
    throw error;
  }

  return normalizeResponse(data, fallbackProfileId);
};
