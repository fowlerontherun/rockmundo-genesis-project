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

// Streak milestone constants (AP kept low — total daily AP hard-capped at 30)
// SXP boosted; total daily SXP hard-capped at DAILY_STIPEND_SXP_CAP below
const STREAK_MILESTONES = [
  { days: 7, bonusSxp: 150, bonusAp: 2 },
  { days: 14, bonusSxp: 300, bonusAp: 3 },
  { days: 30, bonusSxp: 500, bonusAp: 5 },
  { days: 100, bonusSxp: 1000, bonusAp: 8 },
  { days: 365, bonusSxp: 2000, bonusAp: 12 },
];

// Base stipend amounts
const BASE_STIPEND_SXP = 600;
// Daily base AP is rolled randomly between these bounds on every claim.
const MIN_STIPEND_AP = 1;
const MAX_STIPEND_AP = 10;
// Hard cap on total AP from the daily stipend claim (base + streak bonuses)
const DAILY_STIPEND_AP_CAP = 30;
// Hard cap on total SXP from the daily stipend claim (base + streak bonuses)
const DAILY_STIPEND_SXP_CAP = 2000;

function rollDailyBaseAp(): number {
  return MIN_STIPEND_AP + Math.floor(Math.random() * (MAX_STIPEND_AP - MIN_STIPEND_AP + 1));
}

type SkillProgressRow = Database["public"]["Tables"]["skill_progress"]["Row"];

/**
 * Calculate streak bonuses based on current streak
 */
function calculateStreakBonuses(streak: number): { bonusSxp: number; bonusAp: number; milestones: number[] } {
  let bonusSxp = 0;
  let bonusAp = 0;
  const milestones: number[] = [];

  for (const milestone of STREAK_MILESTONES) {
    if (streak >= milestone.days) {
      bonusSxp += milestone.bonusSxp;
      bonusAp += milestone.bonusAp;
      milestones.push(milestone.days);
    }
  }

  return { bonusSxp, bonusAp, milestones };
}

/**
 * Check if two dates are consecutive days
 */
function areConsecutiveDays(date1: string | null, date2: string): boolean {
  if (!date1) return false;
  
  // YYYY-MM-DD values must be compared on UTC calendar boundaries.
  const previous = Date.parse(date1.slice(0, 10) + "T00:00:00Z");
  const current = Date.parse(date2.slice(0, 10) + "T00:00:00Z");
  return Number.isFinite(previous) && Number.isFinite(current)
    && current - previous === 86_400_000;
}

export async function handleClaimDailyXp(
  client: SupabaseClient<Database>,
  userId: string,
  profileState: ProfileState,
  metadata: Record<string, unknown> = {},
): Promise<ProfileState> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const profileId = profileState.profile.id;
  
  // Calculate streak
  const lastClaimDate = profileState.wallet?.last_stipend_claim_date ?? null;
  const currentStreak = profileState.wallet?.stipend_claim_streak ?? 0;
  
  let newStreak = 1; // Default to 1 for new or broken streak
  if (areConsecutiveDays(lastClaimDate, todayIso)) {
    // Consecutive day - increment streak
    newStreak = currentStreak + 1;
  }

  // Calculate bonuses based on new streak
  const { bonusSxp, bonusAp, milestones } = calculateStreakBonuses(newStreak);
  const scaledBaseAp = rollDailyBaseAp();

  // VIP bonus: active VIP subscribers get +25% on the daily stipend (SXP and AP)
  const VIP_BONUS_MULTIPLIER = 0.25;
  let isVip = false;
  try {
    const { data: vipData } = await client
      .from("vip_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();
    isVip = !!vipData;
  } catch (err) {
    console.warn("[claim_daily_xp] VIP check failed, proceeding without bonus", err);
  }

  const preCapSxp = BASE_STIPEND_SXP + bonusSxp;
  const preCapAp = scaledBaseAp + bonusAp;
  const vipBonusSxp = isVip ? Math.round(preCapSxp * VIP_BONUS_MULTIPLIER) : 0;
  const vipBonusAp = isVip ? Math.round(preCapAp * VIP_BONUS_MULTIPLIER) : 0;
  const totalSxp = Math.min(DAILY_STIPEND_SXP_CAP, preCapSxp + vipBonusSxp);
  const totalAp = Math.min(DAILY_STIPEND_AP_CAP, preCapAp + vipBonusAp);

  // Create grant record
  const grantMetadata = {
    ...metadata,
    base_sxp: BASE_STIPEND_SXP,
    base_ap: scaledBaseAp,
    bonus_sxp: bonusSxp,
    bonus_ap: bonusAp,
    vip_bonus_sxp: vipBonusSxp,
    vip_bonus_ap: vipBonusAp,
    is_vip: isVip,
    total_sxp: totalSxp,
    total_ap: totalAp,
    streak: newStreak,
    milestones_reached: milestones,
  };

  const { error: grantError } = await client.rpc("claim_daily_stipend_atomic" as any, {
    p_profile_id: profileId,
    p_sxp: totalSxp,
    p_ap: totalAp,
    p_metadata: grantMetadata,
  });
  if (grantError) throw new Error(grantError.message || "Failed to claim daily stipend");

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
  const { data: skill, error: skillFetchError } = await client
    .from("skill_progress")
    .select("*")
    .eq("profile_id", profileId)
    .eq("skill_slug", skillSlug)
    .maybeSingle();

  if (skillFetchError) {
    throw new Error(skillFetchError.message || "Failed to fetch skill");
  }

  if (!skill) {
    throw new Error("No progress found for this skill");
  }

  const currentLevel = Math.max(0, skill.current_level ?? 0);
  const currentXp = Math.max(0, skill.current_xp ?? 0);

  // Total XP invested = sum of required XP for each completed level + current xp in progress
  let totalInvested = currentXp;
  for (let L = 0; L < currentLevel; L++) {
    totalInvested += calculateRequiredXp(L);
  }

  if (totalInvested <= 0) {
    throw new Error("Nothing to unlearn for this skill");
  }

  const refundedXp = Math.floor(totalInvested * 0.8);

  // Reset skill progress to zero
  const { error: resetError } = await client
    .from("skill_progress")
    .update({
      current_xp: 0,
      current_level: 0,
      required_xp: calculateRequiredXp(0),
      last_practiced_at: new Date().toISOString(),
      metadata: { ...(metadata || {}), unlearned_at: new Date().toISOString(), refunded_xp: refundedXp, balance_version: PROGRESSION_BALANCE_VERSION } as Record<string, string | number | boolean | null>,
    })
    .eq("profile_id", profileId)
    .eq("skill_slug", skillSlug);

  if (resetError) {
    throw new Error(resetError.message || "Failed to reset skill progress");
  }

  // Credit refund to wallet
  const currentSxpBalance = profileState.wallet?.skill_xp_balance ?? profileState.wallet?.xp_balance ?? 0;
  const currentSxpSpent = profileState.wallet?.skill_xp_spent ?? profileState.wallet?.xp_spent ?? 0;
  const newSpent = Math.max(0, currentSxpSpent - refundedXp);

  const { error: walletError } = await client
    .from("player_xp_wallet")
    .update({
      skill_xp_balance: currentSxpBalance + refundedXp,
      skill_xp_spent: newSpent,
      xp_balance: currentSxpBalance + refundedXp,
      xp_spent: newSpent,
      last_recalculated: new Date().toISOString(),
    })
    .eq("profile_id", profileId);

  if (walletError) {
    throw new Error(walletError.message || "Failed to refund SXP");
  }

  const { data: updatedSkillProgress } = await client
    .from("skill_progress")
    .select("*")
    .eq("profile_id", profileId)
    .eq("skill_slug", skillSlug)
    .maybeSingle();

  const state = await fetchProfileState(client, profileId);
  return { state, refundedXp, skillProgress: updatedSkillProgress };
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
