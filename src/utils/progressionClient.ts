import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ProgressionWalletSummary = Tables<"player_xp_wallet"> | null;
export type ProgressionAttributeSummary = Tables<"player_attributes"> | null;

export interface ProgressionProfileSummary {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  level: number;
  experience: number;
  created_at: string;
  updated_at: string;
  attribute_points_available?: number;
  skill_points_available?: number;
  [key: string]: unknown;
}

export interface ProgressionSuccessResponse {
  success: true;
  action: string;
  message?: string;
  profile: ProgressionProfileSummary;
  wallet: ProgressionWalletSummary;
  attributes: ProgressionAttributeSummary;
  cooldowns: Record<string, number>;
  result?: unknown;
}

export interface ProgressionErrorResponse {
  success: false;
  action?: string;
  message: string;
  details?: unknown;
}

export type ProgressionResponse = ProgressionSuccessResponse | ProgressionErrorResponse;

export interface AwardActionXpInput {
  amount: number;
  category?: string;
  actionKey?: string;
  sessionSlug?: string;
  focus?: string;
  durationMinutes?: number;
  collaborationCount?: number;
  quality?: number;
  metadata?: Record<string, unknown>;
  uniqueEventId?: string;
}

export interface BuyAttributeStarInput {
  attributeKey: string;
  stars?: number;
  metadata?: Record<string, unknown>;
  uniqueEventId?: string;
}

const sanitizeMetadata = (metadata: Record<string, unknown> | undefined) => {
  if (!metadata) {
    return undefined;
  }

  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
};

const invokeProgression = async (body: Record<string, unknown>): Promise<ProgressionResponse> => {
  const { data, error } = await supabase.functions.invoke<ProgressionResponse>("progression", {
    body,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to call progression service.");
  }

  if (!data) {
    throw new Error("Progression service returned no data.");
  }

  return data;
};

export const isProgressionSuccessResponse = (
  response: ProgressionResponse,
): response is ProgressionSuccessResponse => response.success === true;

export const awardActionXp = async (input: AwardActionXpInput): Promise<ProgressionResponse> => {
  const {
    amount,
    category,
    actionKey,
    sessionSlug,
    focus,
    durationMinutes,
    collaborationCount,
    quality,
    metadata,
    uniqueEventId,
  } = input;

  const combinedMetadata = sanitizeMetadata({
    ...metadata,
    session_slug: sessionSlug,
    focus,
    duration_minutes: durationMinutes,
    collaboration_count: collaborationCount,
    quality,
  });

  return invokeProgression({
    action: "award_action_xp",
    amount,
    category,
    action_key: actionKey,
    unique_event_id: uniqueEventId,
    metadata: combinedMetadata,
  });
};

export const buyAttributeStar = async (input: BuyAttributeStarInput): Promise<ProgressionResponse> => {
  const { attributeKey, stars, metadata, uniqueEventId } = input;

  const combinedMetadata = sanitizeMetadata({
    ...metadata,
    attribute_key: attributeKey,
    stars,
  });

  return invokeProgression({
    action: "buy_attribute_star",
    attribute_key: attributeKey,
    points: stars,
    unique_event_id: uniqueEventId,
    metadata: combinedMetadata,
  });
};
