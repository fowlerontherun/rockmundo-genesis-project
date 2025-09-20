import type {
  PostgrestError,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";

import type { Database } from "../../../src/lib/supabase-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

type SupabaseModule = typeof import("@supabase/supabase-js");

let supabaseModulePromise: Promise<SupabaseModule> | null = null;

async function resolveSupabaseModule(): Promise<SupabaseModule> {
  if (!supabaseModulePromise) {
    const specifier = import.meta.main
      ? "https://esm.sh/@supabase/supabase-js@2.57.4"
      : "@supabase/supabase-js";
    supabaseModulePromise = import(specifier) as Promise<SupabaseModule>;
  }

  return supabaseModulePromise;
}

type ProgressionAction =
  | "award_action_xp"
  | "weekly_bonus"
  | "buy_attribute_star"
  | "respec_attributes"
  | "award_special_xp"
  | "admin_award_special_xp";

type JsonRecord = Record<string, unknown>;

type HandlerContext = {
  client: SupabaseClient<Database>;
  user: User;
  profile: ProfileSummary;
};

type HandlerResult = {
  message?: string;
  result?: unknown;
};

type ProfileSummary = {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  level: number;
  experience: number;
  experience_at_last_weekly_bonus: number;
  cash: number;
  fame: number;
  fans: number;
  last_weekly_bonus_at: string | null;
  weekly_bonus_streak: number;
  weekly_bonus_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type WalletRow = Database["public"]["Tables"]["player_xp_wallet"]["Row"];

type WalletSummary = WalletRow | null;

type AttributeSummary = Database["public"]["Tables"]["player_attributes"]["Row"] | null;

type PointAvailability = {
  attribute_points_available: number;
  skill_points_available: number;
};

type TargetProfileSummary = {
  profile_id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
};

type NormalizedResponse = {
  success: true;
  action: ProgressionAction;
  message?: string;
  profile: ProfileSummary & PointAvailability;
  wallet: (WalletRow & PointAvailability) | null;
  attributes: AttributeSummary;
  cooldowns: Record<string, number>;
  point_availability: PointAvailability;
  result?: unknown;
};

type ErrorResponse = {
  success: false;
  action?: ProgressionAction;
  message: string;
  details?: unknown;
};

class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const LEDGER_EVENT_TYPES: Record<ProgressionAction, string> = {
  award_action_xp: "action_xp",
  weekly_bonus: "weekly_bonus",
  buy_attribute_star: "attribute_purchase",
  respec_attributes: "attribute_respec",
  award_special_xp: "special_xp",
  admin_award_special_xp: "special_xp",
};

async function progressionHandler(req: Request): Promise<Response> {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new HttpError(401, "Missing Authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new HttpError(500, "Supabase environment variables are not configured");
    }

    let payload: JsonRecord = {};
    try {
      payload = await req.json();
    } catch (_error) {
      throw new HttpError(400, "Invalid JSON payload");
    }

    const action = resolveAction(req.url, payload.action ?? payload.type);
    if (!action) {
      throw new HttpError(400, "Unable to resolve progression action from request");
    }

    const { createClient } = await resolveSupabaseModule();
    const client = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userResult, error: userError } = await client.auth.getUser();
    if (userError || !userResult?.user) {
      throw new HttpError(401, "Unauthorized", userError?.message ?? null);
    }

    const profileState = await loadActiveProfile(client, userResult.user.id);

    const context: HandlerContext = {
      client,
      user: userResult.user,
      profile: profileState.profile,
    };

    const handler = ACTION_HANDLERS[action];
    if (!handler) {
      throw new HttpError(400, `No handler defined for action: ${action}`);
    }

    const handlerResult = await handler(context, payload);

    const { profile, wallet, attributes, pointAvailability } = await fetchProfileState(client, profileState.profile.id);
    const profileWithAvailability: ProfileSummary & PointAvailability = {
      ...profile,
      ...pointAvailability,
    };
    const walletWithAvailability = wallet
      ? ({ ...wallet, ...pointAvailability } as WalletRow & PointAvailability)
      : null;
    const cooldowns = await computeActionCooldowns(client, profileState.profile.id);

    const responseBody: NormalizedResponse = {
      success: true,
      action,
      message: handlerResult.message,
      profile: profileWithAvailability,
      wallet: walletWithAvailability,
      attributes,
      cooldowns,
      point_availability: pointAvailability,
      result: handlerResult.result,
    };

    return jsonResponse(responseBody, 200);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({
        success: false,
        action: undefined,
        message: error.message,
        details: error.details ?? null,
      }, error.status);
    }

    console.error("Unhandled progression function error", error);
    return jsonResponse({
      success: false,
      action: undefined,
      message: "Internal server error",
    }, 500);
  }
}

if (import.meta.main) {
  const { serve } = await import("https://deno.land/std@0.224.0/http/server.ts");
  serve(progressionHandler);
}

const ACTION_HANDLERS: Record<ProgressionAction, (ctx: HandlerContext, payload: JsonRecord) => Promise<HandlerResult>> = {
  award_action_xp: async (ctx, payload) => {
    const amount = resolveNumber(payload.amount ?? payload.xp ?? payload.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpError(400, "XP amount must be a positive number");
    }

    const category = resolveString(payload.category) ?? "general";
    const actionKey = resolveString(payload.action_key ?? payload.reason ?? payload.source) ?? "gameplay_action";
    const uniqueEventId = resolveUniqueEventId(payload);

    await enforceLedgerRules(ctx.client, ctx.profile.id, "award_action_xp", {
      uniqueEventId,
      windowSeconds: 60,
      maxEntries: 20,
    });

    const metadata = buildMetadata(payload, {
      action_key: actionKey,
      category,
      unique_event_id: uniqueEventId ?? null,
      awarded_by: ctx.user.id,
    });

    const result = await callProgressionProcedure<JsonRecord>(ctx.client, "progression_award_action_xp", {
      p_profile_id: ctx.profile.id,
      p_amount: amount,
      p_category: category,
      p_action_key: actionKey,
      p_metadata: metadata,
    });

    return {
      message: result?.message ?? "Action XP awarded",
      result,
    };
  },

  weekly_bonus: async (ctx, payload) => {
    const bonusXp = resolveNumber(payload.xp ?? payload.bonus ?? payload.amount, 0);
    const attributePoints = Math.max(0, Math.trunc(resolveNumber(payload.attribute_points ?? payload.attributePoints, 0)));
    if (bonusXp <= 0 && attributePoints <= 0) {
      throw new HttpError(400, "Weekly bonus requires XP or attribute points");
    }

    await enforceLedgerRules(ctx.client, ctx.profile.id, "weekly_bonus", {
      windowSeconds: 7 * 24 * 60 * 60,
      maxEntries: 1,
      uniqueEventId: resolveUniqueEventId(payload),
    });

    const metadata = buildMetadata(payload, {
      attribute_points: attributePoints,
      xp_granted: bonusXp,
      granted_by: ctx.user.id,
      unique_event_id: resolveUniqueEventId(payload) ?? null,
    });

    const result = await callProgressionProcedure<JsonRecord>(ctx.client, "progression_award_weekly_bonus", {
      p_profile_id: ctx.profile.id,
      p_bonus_xp: bonusXp,
      p_attribute_points: attributePoints,
      p_metadata: metadata,
    });

    return {
      message: result?.message ?? "Weekly bonus processed",
      result,
    };
  },

  buy_attribute_star: async (ctx, payload) => {
    const attributeKey = resolveString(payload.attribute_key ?? payload.attributeKey);
    if (!attributeKey) {
      throw new HttpError(400, "Attribute key is required for purchases");
    }

    const stars = Math.max(1, Math.trunc(resolveNumber(payload.points ?? payload.quantity ?? 1, 1)));
    const metadata = buildMetadata(payload, {
      attribute_key: attributeKey,
      stars,
      unique_event_id: resolveUniqueEventId(payload) ?? null,
    });

    const result = await callProgressionProcedure<JsonRecord>(ctx.client, "progression_buy_attribute_star", {
      p_profile_id: ctx.profile.id,
      p_attribute_key: attributeKey,
      p_points: stars,
      p_metadata: metadata,
    });

    return {
      message: result?.message ?? "Attribute upgrade purchased",
      result,
    };
  },

  respec_attributes: async (ctx, payload) => {
    const distribution = normalizeDistribution(payload.target_distribution ?? payload.attributes ?? payload.distribution);
    if (!distribution) {
      throw new HttpError(400, "Attribute distribution payload is required for respec");
    }

    const metadata = buildMetadata(payload, {
      unique_event_id: resolveUniqueEventId(payload) ?? null,
    });

    const result = await callProgressionProcedure<JsonRecord>(ctx.client, "progression_respec_attributes", {
      p_profile_id: ctx.profile.id,
      p_distribution: distribution,
      p_metadata: metadata,
    });

    return {
      message: result?.message ?? "Attributes respeced",
      result,
    };
  },

  award_special_xp: async (ctx, payload) => {
    const xpAmount = resolveNumber(payload.xp ?? payload.amount ?? payload.bonus);
    if (!Number.isFinite(xpAmount) || xpAmount <= 0) {
      throw new HttpError(400, "Special XP award requires a positive XP amount");
    }

    const bonusType = resolveString(payload.bonus_type ?? payload.kind ?? payload.reason) ?? "special";
    const metadata = buildMetadata(payload, {
      bonus_type: bonusType,
      unique_event_id: resolveUniqueEventId(payload) ?? null,
    });

    await enforceLedgerRules(ctx.client, ctx.profile.id, "award_special_xp", {
      uniqueEventId: resolveUniqueEventId(payload),
      windowSeconds: 60 * 60,
      maxEntries: 50,
    });

    const result = await callProgressionProcedure<JsonRecord>(ctx.client, "progression_award_special_xp", {
      p_profile_id: ctx.profile.id,
      p_amount: xpAmount,
      p_bonus_type: bonusType,
      p_metadata: metadata,
    });

    return {
      message: result?.message ?? "Special XP granted",
      result,
    };
  },

  admin_award_special_xp: async (ctx, payload) => {
    await assertAdminPrivileges(ctx.client, ctx.user.id);

    const xpAmount = resolveNumber(payload.xp ?? payload.amount ?? payload.bonus);
    if (!Number.isFinite(xpAmount) || xpAmount <= 0) {
      throw new HttpError(400, "Admin XP grants require a positive XP amount");
    }

    const targetScope = resolveString(payload.target_scope ?? payload.scope);
    const applyToAll = payload.apply_to_all === true
      || payload.applyToAll === true
      || targetScope === "all";

    const profileIds = normalizeProfileIdPayload(payload);
    const targets = await resolveTargetProfiles(ctx.client, {
      applyToAll,
      profileIds,
    });

    if (targets.length === 0) {
      throw new HttpError(
        400,
        applyToAll
          ? "No player profiles are available to receive XP"
          : "No matching player profiles were found for the grant",
        { apply_to_all: applyToAll, profile_ids: profileIds },
      );
    }

    const reason = resolveString(payload.reason ?? payload.description ?? payload.context) ?? "Admin XP grant";
    const metadataBase = buildMetadata(payload, {
      reason,
      awarded_by: ctx.user.id,
      target_scope: applyToAll ? "all" : "selected",
      unique_event_id: resolveUniqueEventId(payload) ?? null,
    });

    const awardedTargets: TargetProfileSummary[] = [];

    for (const target of targets) {
      const metadata = {
        ...metadataBase,
        target_profile_id: target.profile_id,
        target_user_id: target.user_id,
      };

      await callProgressionProcedure<JsonRecord>(ctx.client, "progression_award_special_xp", {
        p_profile_id: target.profile_id,
        p_amount: xpAmount,
        p_bonus_type: "admin_award",
        p_metadata: metadata,
      });

      awardedTargets.push(target);
    }

    if (awardedTargets.length === 0) {
      throw new HttpError(500, "Failed to apply XP grant to the selected players");
    }

    const notificationMessage = buildNotificationMessage(xpAmount, reason);
    await createXpNotifications(ctx.client, awardedTargets, notificationMessage);

    return {
      message: `Granted ${xpAmount} XP to ${awardedTargets.length} player${awardedTargets.length === 1 ? "" : "s"}.`,
      result: {
        amount: xpAmount,
        reason,
        awarded_count: awardedTargets.length,
        target_profile_ids: awardedTargets.map((target) => target.profile_id),
        apply_to_all: applyToAll,
      },
    };
  },
};

function resolveAction(url: string, payloadAction: unknown): ProgressionAction | null {
  const normalizedPayloadAction = typeof payloadAction === "string"
    ? payloadAction.trim().toLowerCase()
    : null;

  if (normalizedPayloadAction && isProgressionAction(normalizedPayloadAction)) {
    return normalizedPayloadAction as ProgressionAction;
  }

  const parsedUrl = new URL(url);
  const segments = parsedUrl.pathname.split("/").filter(Boolean);
  const progressionIndex = segments.findIndex((segment) => segment === "progression");
  const pathCandidate = progressionIndex >= 0 && segments.length > progressionIndex + 1
    ? segments[progressionIndex + 1]?.toLowerCase()
    : null;

  if (pathCandidate && isProgressionAction(pathCandidate)) {
    return pathCandidate as ProgressionAction;
  }

  return null;
}

function isProgressionAction(action: string): action is ProgressionAction {
  return [
    "award_action_xp",
    "weekly_bonus",
    "buy_attribute_star",
    "respec_attributes",
    "award_special_xp",
  ].includes(action as ProgressionAction);
}

async function loadActiveProfile(client: SupabaseClient<Database>, userId: string) {
  const { data: profiles, error } = await client
    .from("profiles")
    .select(
      "id, user_id, username, display_name, avatar_url, bio, level, experience, experience_at_last_weekly_bonus, cash, fame, fans, last_weekly_bonus_at, weekly_bonus_streak, weekly_bonus_metadata, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new HttpError(500, "Failed to load active profile", error);
  }

  const profile = profiles?.[0];
  if (!profile) {
    throw new HttpError(404, "Active profile not found for user");
  }

  return { profile: normalizeProfileRow(profile as ProfileRow) };
}

async function fetchProfileState(client: SupabaseClient<Database>, profileId: string) {
  const profilePromise = client
    .from("profiles")
    .select(
      "id, user_id, username, display_name, avatar_url, bio, level, experience, experience_at_last_weekly_bonus, cash, fame, fans, last_weekly_bonus_at, weekly_bonus_streak, weekly_bonus_metadata, created_at, updated_at",
    )
    .eq("id", profileId)
    .maybeSingle();

  const walletPromise = client
    .from("player_xp_wallet")
    .select("profile_id, xp_balance, lifetime_xp, xp_spent, attribute_points_earned, skill_points_earned, last_recalculated")
    .eq("profile_id", profileId)
    .maybeSingle();

  const attributesPromise = client
    .from("player_attributes")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  const [profileResult, walletResult, attributesResult] = await Promise.all([
    profilePromise,
    walletPromise,
    attributesPromise,
  ]);

  if (profileResult.error) {
    throw new HttpError(500, "Failed to reload profile state", profileResult.error);
  }

  if (!profileResult.data) {
    throw new HttpError(500, "Profile missing after progression update");
  }

  if (walletResult.error && walletResult.error.code !== "PGRST116") {
    throw new HttpError(500, "Failed to load wallet state", walletResult.error);
  }

  if (attributesResult.error && attributesResult.error.code !== "PGRST116") {
    throw new HttpError(500, "Failed to load attribute state", attributesResult.error);
  }

  const wallet = walletResult.data ? walletResult.data as WalletRow : null;
  const attributes = attributesResult.data ?? null;
  const pointAvailability = calculatePointAvailability(wallet, attributes);

  return {
    profile: normalizeProfileRow(profileResult.data as ProfileRow),
    wallet,
    attributes,
    pointAvailability,
  };
}

function normalizeProfileRow(row: ProfileRow): ProfileSummary {
  return {
    id: row.id,
    user_id: row.user_id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    bio: row.bio,
    level: row.level,
    experience: row.experience,
    experience_at_last_weekly_bonus: row.experience_at_last_weekly_bonus ?? 0,
    cash: row.cash ?? 0,
    fame: row.fame ?? 0,
    fans: row.fans ?? 0,
    last_weekly_bonus_at: row.last_weekly_bonus_at,
    weekly_bonus_streak: row.weekly_bonus_streak ?? 0,
    weekly_bonus_metadata: coerceJsonRecord(row.weekly_bonus_metadata),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function calculatePointAvailability(wallet: WalletSummary, attributes: AttributeSummary): PointAvailability {
  const attributePointsBanked = attributes?.attribute_points;
  const attributePointsSpent = attributes?.attribute_points_spent ?? 0;
  const attributePointsFromWallet = (wallet?.attribute_points_earned ?? 0) - attributePointsSpent;
  const attributePointsAvailable = Math.max(
    0,
    Math.trunc(attributePointsBanked ?? attributePointsFromWallet),
  );

  const skillPointsAvailable = Math.max(0, Math.trunc(wallet?.skill_points_earned ?? 0));

  return {
    attribute_points_available: attributePointsAvailable,
    skill_points_available: skillPointsAvailable,
  };
}

function coerceJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function computeActionCooldowns(client: SupabaseClient<Database>, profileId: string) {
  const now = Date.now();
  const cooldowns: Record<string, number> = {
    weekly_bonus: 0,
    award_action_xp: 0,
    award_special_xp: 0,
    buy_attribute_star: 0,
    respec_attributes: 0,
    admin_award_special_xp: 0,
  };

  const weeklyPromise = client
    .from("xp_ledger")
    .select("created_at")
    .eq("profile_id", profileId)
    .eq("event_type", LEDGER_EVENT_TYPES.weekly_bonus)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const specialPromise = client
    .from("xp_ledger")
    .select("created_at")
    .eq("profile_id", profileId)
    .eq("event_type", LEDGER_EVENT_TYPES.award_special_xp)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [weeklyResult, specialResult] = await Promise.all([weeklyPromise, specialPromise]);

  if (!weeklyResult.error && weeklyResult.data?.created_at) {
    const elapsed = (now - Date.parse(weeklyResult.data.created_at)) / 1000;
    const remaining = 7 * 24 * 60 * 60 - elapsed;
    cooldowns.weekly_bonus = Math.max(0, Math.ceil(remaining));
  }

  if (!specialResult.error && specialResult.data?.created_at) {
    const elapsed = (now - Date.parse(specialResult.data.created_at)) / 1000;
    const remaining = 60 * 60 - elapsed;
    cooldowns.award_special_xp = Math.max(0, Math.ceil(remaining));
  }

  return cooldowns;
}

function resolveUniqueEventId(payload: JsonRecord): string | undefined {
  const candidateKeys = [
    "event_id",
    "eventId",
    "source_id",
    "sourceId",
    "quest_id",
    "questId",
    "session_id",
    "sessionId",
    "transaction_id",
    "transactionId",
  ];

  for (const key of candidateKeys) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function buildMetadata(payload: JsonRecord, extras: JsonRecord = {}): JsonRecord {
  const metadataSource = payload.metadata;
  const metadata = typeof metadataSource === "object" && metadataSource !== null && !Array.isArray(metadataSource)
    ? { ...metadataSource as JsonRecord }
    : {};

  for (const [key, value] of Object.entries(extras)) {
    if (value !== undefined) {
      metadata[key] = value;
    }
  }

  return metadata;
}

function resolveNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function resolveString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

async function assertAdminPrivileges(client: SupabaseClient<Database>, userId: string): Promise<void> {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Unable to verify admin privileges", error);
  }

  if (!data) {
    throw new HttpError(403, "Admin privileges are required to grant XP bonuses");
  }
}

function normalizeProfileIdPayload(payload: JsonRecord): string[] {
  const uniqueIds = new Set<string>();

  const addId = (candidate: unknown) => {
    const value = resolveString(candidate);
    if (value) {
      uniqueIds.add(value);
    }
  };

  const addFromDelimitedString = (value: string) => {
    const segments = value.split(",");
    if (segments.length === 1) {
      addId(value);
      return;
    }

    for (const segment of segments) {
      addId(segment);
    }
  };

  const addCandidate = (candidate: unknown) => {
    if (typeof candidate === "string") {
      addFromDelimitedString(candidate);
      return;
    }

    if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        if (typeof entry === "string") {
          addFromDelimitedString(entry);
        } else if (entry && typeof entry === "object" && "profile_id" in entry) {
          addId((entry as JsonRecord).profile_id);
        } else if (entry && typeof entry === "object" && "id" in entry) {
          addId((entry as JsonRecord).id);
        }
      }
    }
  };

  const arrayCandidates = [
    payload.profile_ids,
    payload.target_profile_ids,
    payload.profileIds,
    payload.targetProfileIds,
  ];

  for (const candidate of arrayCandidates) {
    addCandidate(candidate);
  }

  const singleCandidates = [
    payload.profile_id,
    payload.target_profile_id,
    payload.profileId,
    payload.targetProfileId,
  ];

  for (const candidate of singleCandidates) {
    addId(candidate);
  }

  return Array.from(uniqueIds);
}

async function resolveTargetProfiles(
  client: SupabaseClient<Database>,
  options: { applyToAll: boolean; profileIds: string[] },
): Promise<TargetProfileSummary[]> {
  if (options.applyToAll) {
    const { data, error } = await client
      .from("profiles")
      .select("id, user_id, username, display_name");

    if (error) {
      throw new HttpError(500, "Failed to load player profiles", error);
    }

    return (Array.isArray(data) ? data : [])
      .filter((row): row is { id: string; user_id: string; username: string | null; display_name: string | null } => {
        return typeof row?.id === "string" && typeof row?.user_id === "string";
      })
      .map((row) => ({
        profile_id: row.id,
        user_id: row.user_id,
        username: typeof row.username === "string" ? row.username : null,
        display_name: typeof row.display_name === "string" ? row.display_name : null,
      }));
  }

  if (!options.profileIds || options.profileIds.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(new Set(options.profileIds));
  const { data, error } = await client
    .from("profiles")
    .select("id, user_id, username, display_name")
    .in("id", uniqueIds);

  if (error) {
    throw new HttpError(500, "Failed to load target player profiles", error);
  }

  const rows = (Array.isArray(data) ? data : []).filter((row): row is {
    id: string;
    user_id: string;
    username: string | null;
    display_name: string | null;
  } => typeof row?.id === "string" && typeof row?.user_id === "string");

  const results = rows.map((row) => ({
    profile_id: row.id,
    user_id: row.user_id,
    username: typeof row.username === "string" ? row.username : null,
    display_name: typeof row.display_name === "string" ? row.display_name : null,
  }));

  const foundIds = new Set(results.map((row) => row.profile_id));
  const missingIds = uniqueIds.filter((id) => !foundIds.has(id));

  if (missingIds.length > 0) {
    throw new HttpError(404, "One or more player profiles could not be found", { missing_profile_ids: missingIds });
  }

  return results;
}

function buildNotificationMessage(amount: number, reason: string): string {
  const formatter = new Intl.NumberFormat("en-US");
  const formattedAmount = formatter.format(Math.round(amount));
  const trimmedReason = reason.length > 250 ? `${reason.slice(0, 247)}...` : reason;
  return `You received ${formattedAmount} XP: ${trimmedReason}`;
}

async function createXpNotifications(
  client: SupabaseClient<Database>,
  targets: TargetProfileSummary[],
  message: string,
): Promise<void> {
  const notifications: { user_id: string; type: string; message: string }[] = [];
  const seenUsers = new Set<string>();

  for (const target of targets) {
    if (!target.user_id || seenUsers.has(target.user_id)) {
      continue;
    }

    seenUsers.add(target.user_id);
    notifications.push({
      user_id: target.user_id,
      type: "system",
      message,
    });
  }

  if (notifications.length === 0) {
    return;
  }

  const { error } = await client.from("notifications").insert(notifications);
  if (error) {
    throw new HttpError(500, "Failed to create XP notifications", error);
  }
}

async function enforceLedgerRules(
  client: SupabaseClient<Database>,
  profileId: string,
  action: ProgressionAction,
  options: { uniqueEventId?: string; windowSeconds?: number; maxEntries?: number },
) {
  const eventType = LEDGER_EVENT_TYPES[action];

  if (options.uniqueEventId) {
    const { data, error } = await client
      .from("xp_ledger")
      .select("id")
      .eq("profile_id", profileId)
      .eq("event_type", eventType)
      .contains("metadata", { unique_event_id: options.uniqueEventId })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw new HttpError(500, "Failed to check progression ledger for duplicates", error);
    }

    if (data) {
      throw new HttpError(409, "Duplicate progression event detected", { unique_event_id: options.uniqueEventId });
    }
  }

  if (options.windowSeconds && options.maxEntries) {
    const since = new Date(Date.now() - options.windowSeconds * 1000).toISOString();
    const { data, error } = await client
      .from("xp_ledger")
      .select("id")
      .eq("profile_id", profileId)
      .eq("event_type", eventType)
      .gte("created_at", since);

    if (error) {
      throw new HttpError(500, "Failed to evaluate progression rate limits", error);
    }

    if ((data?.length ?? 0) >= options.maxEntries) {
      throw new HttpError(429, "Progression action rate limit exceeded", {
        window_seconds: options.windowSeconds,
        max_entries: options.maxEntries,
      });
    }
  }
}

async function callProgressionProcedure<T>(
  client: SupabaseClient<Database>,
  functionName: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(functionName, args);
  if (error) {
    throw new HttpError(mapRpcErrorToStatus(error), error.message, {
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }
  return data as T;
}

function mapRpcErrorToStatus(error: PostgrestError): number {
  if (error.code === "P0001" || error.code === "23514" || error.code === "42501") {
    return 400;
  }
  if (error.code === "PGRST116") {
    return 404;
  }
  return 500;
}

function normalizeDistribution(value: unknown): JsonRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const distribution: JsonRecord = {};
  for (const [key, raw] of Object.entries(value)) {
    const numericValue = resolveNumber(raw, Number.NaN);
    if (Number.isFinite(numericValue)) {
      distribution[key] = numericValue;
    }
  }

  return Object.keys(distribution).length > 0 ? distribution : null;
}

function jsonResponse(body: NormalizedResponse | ErrorResponse, status: number) {
  return new Response(JSON.stringify(body, (_key, value) => (value === undefined ? null : value)), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export { progressionHandler, loadActiveProfile, fetchProfileState };
export type { PointAvailability, ProfileSummary };
