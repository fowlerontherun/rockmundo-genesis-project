import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import type { Database } from "../../../src/types/database-fallback.ts";
import { fetchProfileState, type ProfileState } from "./index.ts";

// Skill level cap (must match src/data/skillConstants.ts MAX_SKILL_LEVEL)
const MAX_SKILL_LEVEL = 20;


const PROGRESSION_BALANCE_VERSION = "progression_v2.0.0";
const STANDARD_ROLE_XP = [120,148,176,204,232,260,289,318,348,377,406,436,465,494,524,553,582,612,641,670];
function calculateRequiredXp(level: number): number {
  if (!Number.isFinite(level) || level < 0) return STANDARD_ROLE_XP[0];
  return STANDARD_ROLE_XP[Math.min(Math.floor(level), STANDARD_ROLE_XP.length - 1)] ?? STANDARD_ROLE_XP[STANDARD_ROLE_XP.length - 1];
}
function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let next = 0; next < Math.min(level, MAX_SKILL_LEVEL); next += 1) total += calculateRequiredXp(next);
  return total;
}

// The claim RPC is the only authority for daily stipend amounts, VIP status,
// streaks and base AP rolls. Avoid duplicating reward calculations in Edge.
type SkillProgressRow = Database["public"]["Tables"]["skill_progress"]["Row"];

export async function handleClaimDailyXp(
  client: SupabaseClient<Database>,
  _userId: string,
  profileState: ProfileState,
  _metadata: Record<string, unknown> = {},
): Promise<ProfileState> {
  // The caller's JWT reaches PostgREST through the request-scoped client.
  // Postgres verifies ownership and calculates the stipend under the wallet lock.
  // Never forward client-controlled SXP/AP, VIP flags, streak or metadata.
  const profileId = profileState.profile.id;
  const { error } = await client.rpc("claim_daily_stipend_atomic" as any, {
    p_profile_id: profileId,
  });
  if (error) throw new Error(error.message || "Failed to claim daily stipend");
  return await fetchProfileState(client, profileId);
}

export async function handleSpendAttributeXp(
  client: SupabaseClient<Database>,
  userId: string,
  profileState: ProfileState,
  attributeKey: string,
  apCost: number,
  metadata: Record<string, unknown> = {},
): Promise<ProfileState> {
  const profileId = profileState.profile.id;
  
  const { error } = await client.rpc("spend_attribute_points_atomic" as any, {
    p_profile_id: profileId,
    p_attribute: attributeKey,
    p_cost: apCost,
  });
  if (error) throw new Error(error.message || "Attribute purchase failed");

  return await fetchProfileState(client, profileId);
}

export async function handleSpendSkillXp(
  client: SupabaseClient<Database>,
  _userId: string,
  profileState: ProfileState,
  skillSlug: string,
  xpAmount: number,
  metadata: Record<string, unknown> = {},
  eventId?: string,
): Promise<{ state: ProfileState; skillProgress: SkillProgressRow; spendResult: Record<string, unknown> }> {
  const profileId = profileState.profile.id;
  const idempotencyKey = eventId || (typeof metadata?.idempotency_key === "string" ? metadata.idempotency_key : undefined);

  if (!Number.isInteger(xpAmount) || xpAmount <= 0) {
    throw new Error("skill_xp_invalid_amount");
  }

  if (!idempotencyKey) {
    throw new Error("skill_xp_missing_idempotency_key");
  }

  const { data, error } = await client.rpc("progression_spend_skill_xp" as any, {
    p_profile_id: profileId,
    p_skill_slug: skillSlug,
    p_xp: xpAmount,
    p_metadata: { ...(metadata || {}), idempotency_key: idempotencyKey },
    p_idempotency_key: idempotencyKey,
  } as any);

  if (error) {
    throw new Error(error.message || "skill_xp_spend_failed");
  }

  const result = (data ?? {}) as Record<string, unknown>;
  const skillProgress = result.skill_progress as SkillProgressRow | undefined;
  if (!skillProgress) {
    throw new Error("skill_xp_updated_progress_missing");
  }

  const state = await fetchProfileState(client, profileId);
  return { state, skillProgress, spendResult: result };
}


export async function handleUnlearnSkill(
  client: SupabaseClient<Database>,
  _userId: string,
  profileState: ProfileState,
  skillSlug: string,
  metadata: Record<string, unknown> = {},
): Promise<{ state: ProfileState; refundedXp: number; skillProgress: SkillProgressRow | null }> {
  const profileId = profileState.profile.id;
  const { data, error } = await client.rpc("unlearn_skill_atomic" as any, {
    p_profile_id: profileId,
    p_skill_slug: skillSlug,
    p_metadata: metadata,
  });
  if (error) throw new Error(error.message || "Unable to unlearn skill");
  const { data: skillProgress, error: readError } = await client.from("skill_progress")
    .select("*").eq("profile_id",profileId).eq("skill_slug",skillSlug).maybeSingle();
  if (readError) throw readError;
  return { state: await fetchProfileState(client, profileId), refundedXp: Number(data ?? 0), skillProgress };
}

// AP to SXP conversion rate
const AP_TO_SXP_RATE = 100;

export async function handleConvertApToSxp(
  client: SupabaseClient<Database>,
  userId: string,
  profileState: ProfileState,
  apAmount: number,
  metadata: Record<string, unknown> = {},
): Promise<ProfileState> {
  const profileId = profileState.profile.id;
  const { error } = await client.rpc("convert_ap_to_sxp_atomic" as any, {
    p_profile_id: profileId,
    p_amount: apAmount,
    p_metadata: metadata,
  });
  if (error) throw new Error(error.message || "AP conversion failed");

  return await fetchProfileState(client, profileId);
}

export async function handleAwardActionXp(
  client: SupabaseClient<Database>,
  userId: string,
  profileState: ProfileState,
  amount: number,
  category: string = "performance",
  actionKey: string = "gameplay_action",
  metadata: Record<string, unknown> = {},
  eventId?: string,
): Promise<ProfileState> {
  const profileId = profileState.profile.id;

  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 250) {
    throw new Error("Action XP amount must be an integer between 1 and 250");
  }

  const transactionRef = typeof eventId === "string" && eventId.trim().length > 0 ? eventId.trim() : undefined;
  if (!transactionRef) throw new Error("Action XP requires a stable idempotency key");

  if (transactionRef) {
    const { data: existingLedger, error: existingLedgerError } = await client
      .from("experience_ledger")
      .select("id")
      .eq("profile_id", profileId)
      .eq("activity_type", actionKey)
      .eq("metadata->>transaction_ref", transactionRef)
      .maybeSingle();

    if (existingLedgerError && existingLedgerError.code !== "PGRST116") {
      throw new Error(existingLedgerError.message || "Failed to verify XP transaction");
    }

    if (existingLedger) {
      return await fetchProfileState(client, profileId);
    }
  }

  // Calculate health drain if metadata includes duration
  let healthDrain = 0;
  if (metadata.duration_minutes && typeof metadata.duration_minutes === "number") {
    const activityType = metadata.activity_type as string || actionKey;
    const healthCosts: Record<string, number> = {
      busking_session: 5,
      gig: 8,
      recording: 4,
      jam_session: 3,
      songwriting: 2,
      travel: 6,
      default: 3,
    };
    
    const hourlyRate = healthCosts[activityType] || healthCosts.default;
    const hours = metadata.duration_minutes / 60;
    healthDrain = Math.round(hourlyRate * hours);
  }

  // Log the XP grant to ledger (will be processed daily)
  const { error: ledgerError } = await client
    .from("experience_ledger")
    .insert({
      user_id: userId,
      profile_id: profileId,
      activity_type: actionKey,
      xp_amount: amount,
      metadata: {
        category,
        action_key: actionKey,
        health_drain: healthDrain,
        pending_daily_process: true,
        transaction_ref: transactionRef ?? null,
        ...metadata,
      },
    });

  if (ledgerError) {
    throw new Error(ledgerError.message || "Failed to log XP in ledger");
  }

  // Never drain health when the XP ledger write failed.
  // Update profile health if needed
  if (healthDrain > 0) {
    const currentHealth = profileState.profile.health ?? 100;
    const newHealth = Math.max(0, currentHealth - healthDrain);
    
    const { error: healthError } = await client
      .from("profiles")
      .update({
        health: newHealth,
        last_health_update: new Date().toISOString(),
      })
      .eq("id", profileId);
    
    if (healthError) {
      console.error("Failed to update health:", healthError);
    }
  }

  // Note: We only log to experience_ledger here
  // The actual wallet update happens in the daily process-daily-activity-xp function
  // This ensures activities are auto-credited the next day with the 250 SXP cap


  return await fetchProfileState(client, profileId);
}
