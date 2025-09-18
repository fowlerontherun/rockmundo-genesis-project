import { supabase } from "@/integrations/supabase/client";

export class ProgressionClientError extends Error {
  status?: number;
  action?: string;
  details?: unknown;

  constructor(message: string, options?: { status?: number; action?: string; details?: unknown }) {
    super(message);
    this.name = "ProgressionClientError";
    this.status = options?.status;
    this.action = options?.action;
    this.details = options?.details;
  }
}

export interface ProgressionSuccessResponse<Result = unknown> {
  success: true;
  action: string;
  message?: string | null;
  profile: Record<string, unknown>;
  wallet: Record<string, unknown> | null;
  attributes: Record<string, unknown> | null;
  cooldowns: Record<string, number>;
  result?: Result;
}

export interface ProgressionErrorResponse {
  success: false;
  action?: string;
  message: string;
  details?: unknown;
}

export interface AwardActionXpInput {
  amount: number;
  category?: string;
  actionKey?: string;
  uniqueEventId?: string;
  metadata?: Record<string, unknown>;
}

export interface BuyAttributeStarInput {
  attributeKey: string;
  points?: number;
  uniqueEventId?: string;
  metadata?: Record<string, unknown>;
}

const ensurePositiveInteger = (
  value: number,
  options?: { action?: string; message?: string }
) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ProgressionClientError(options?.message ?? "Amount must be a positive number", {
      action: options?.action ?? "award_action_xp",
      status: 400,
    });
  }

  return Math.max(1, Math.round(value));
};

const invokeProgression = async <Result = unknown>(
  action: string,
  body: Record<string, unknown>,
): Promise<ProgressionSuccessResponse<Result>> => {
  const { data, error } = await supabase.functions.invoke(`progression/${action}`, { body });

  if (error) {
    throw new ProgressionClientError(error.message ?? "Progression request failed", {
      status: error.status ?? 500,
      action,
      details: error,
    });
  }

  if (!data || typeof data !== "object") {
    throw new ProgressionClientError("Received an empty response from progression service", {
      action,
      status: 502,
    });
  }

  const parsed = data as ProgressionSuccessResponse<Result> | ProgressionErrorResponse;

  if (!parsed.success) {
    throw new ProgressionClientError(parsed.message ?? "Progression service rejected the request", {
      status: 400,
      action: parsed.action ?? action,
      details: parsed.details,
    });
  }

  return parsed;
};

const ensureNonEmptyString = (value: unknown, message: string, action: string) => {
  if (typeof value !== "string") {
    throw new ProgressionClientError(message, {
      action,
      status: 400,
    });
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new ProgressionClientError(message, {
      action,
      status: 400,
    });
  }

  return trimmed;
};

export const progressionClient = {
  async awardActionXp<Result = unknown>(input: AwardActionXpInput) {
    const amount = ensurePositiveInteger(input.amount, {
      action: "award_action_xp",
      message: "XP amount must be a positive number",
    });

    const body: Record<string, unknown> = {
      amount,
    };

    if (input.category) {
      body.category = input.category;
    }

    if (input.actionKey) {
      body.action_key = input.actionKey;
    }

    if (input.uniqueEventId) {
      body.unique_event_id = input.uniqueEventId;
      body.event_id = input.uniqueEventId;
    }

    if (input.metadata) {
      body.metadata = input.metadata;
    }

    return invokeProgression<Result>("award_action_xp", body);
  },

  async buyAttributeStar<Result = unknown>(input: BuyAttributeStarInput) {
    const attributeKey = ensureNonEmptyString(
      input.attributeKey,
      "Attribute key is required to purchase attribute stars",
      "buy_attribute_star",
    );

    const points = ensurePositiveInteger(input.points ?? 1, {
      action: "buy_attribute_star",
      message: "Attribute point quantity must be a positive number",
    });

    const body: Record<string, unknown> = {
      attribute_key: attributeKey,
      points,
    };

    if (input.uniqueEventId) {
      body.unique_event_id = input.uniqueEventId;
      body.event_id = input.uniqueEventId;
    }

    if (input.metadata) {
      body.metadata = input.metadata;
    }

    return invokeProgression<Result>("buy_attribute_star", body);
  },
};

export type { ProgressionSuccessResponse as ProgressionResponse };
