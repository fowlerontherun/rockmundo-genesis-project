import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import type { Database } from "../../../src/types/database-fallback.ts";
import { fetchProfileState, type ProfileState } from "./index.ts";

// Define MAX_SKILL_LEVEL locally (edge functions can't import from src/)
const MAX_SKILL_LEVEL = 100;

// Streak milestone constants
const STREAK_MILESTONES = [
  { days: 7, bonusSxp: 50, bonusAp: 10 },
  { days: 14, bonusSxp: 100, bonusAp: 20 },
  { days: 30, bonusSxp: 200, bonusAp: 40 },
  { days: 100, bonusSxp: 500, bonusAp: 100 },
  { days: 365, bonusSxp: 1000, bonusAp: 200 },
];

// Base stipend amounts
const BASE_STIPEND_SXP = 100;
const BASE_STIPEND_AP = 10;

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
  
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Normalize to start of day
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  
  const diffMs = d2.getTime() - d1.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  return diffDays === 1;
}

export async function handleClaimDailyXp(
  client: SupabaseClient<Database>,
  userId: string,
  profileState: ProfileState,
  metadata: Record<string, unknown> = {},
): Promise<ProfileState> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const profileId = profileState.profile.id;
  
  // Check if already claimed today
  const { data: existingGrant } = await client
    .from("profile_daily_xp_grants")
    .select("*")
    .eq("profile_id", profileId)
    .eq("grant_date", todayIso)
    .eq("source", "daily_stipend")
    .maybeSingle();

  if (existingGrant) {
    throw new Error("Daily XP already claimed today");
  }

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
  const totalSxp = BASE_STIPEND_SXP + bonusSxp;
  const totalAp = BASE_STIPEND_AP + bonusAp;

  // Get current balances (use new dual currency columns)
  const currentSxpBalance = profileState.wallet?.skill_xp_balance ?? profileState.wallet?.xp_balance ?? 0;
  const currentSxpLifetime = profileState.wallet?.skill_xp_lifetime ?? profileState.wallet?.lifetime_xp ?? 0;
  const currentApBalance = profileState.wallet?.attribute_points_balance ?? 0;
  const currentApLifetime = profileState.wallet?.attribute_points_lifetime ?? 0;

  // Create grant record
  const grantMetadata = {
    ...metadata,
    base_sxp: BASE_STIPEND_SXP,
    base_ap: BASE_STIPEND_AP,
    bonus_sxp: bonusSxp,
    bonus_ap: bonusAp,
    total_sxp: totalSxp,
    total_ap: totalAp,
    streak: newStreak,
    milestones_reached: milestones,
  };

  const { error: grantError } = await client
    .from("profile_daily_xp_grants")
    .insert({
      profile_id: profileId,
      grant_date: todayIso,
      source: "daily_stipend",
      xp_amount: totalSxp,
      attribute_points_amount: totalAp,
      metadata: grantMetadata,
    });

  if (grantError) {
    throw new Error(grantError.message || "Failed to create daily grant");
  }

  // Update wallet with dual currency and streak
  const { error: walletError } = await client
    .from("player_xp_wallet")
    .upsert({
      profile_id: profileId,
      // Dual currency updates
      skill_xp_balance: currentSxpBalance + totalSxp,
      skill_xp_lifetime: currentSxpLifetime + totalSxp,
      attribute_points_balance: currentApBalance + totalAp,
      attribute_points_lifetime: currentApLifetime + totalAp,
      // Legacy columns (keep in sync for backwards compatibility)
      xp_balance: currentSxpBalance + totalSxp,
      lifetime_xp: currentSxpLifetime + totalSxp,
      // Streak tracking
      stipend_claim_streak: newStreak,
      last_stipend_claim_date: todayIso,
      last_recalculated: new Date().toISOString(),
    }, { onConflict: "profile_id" });

  if (walletError) {
    throw new Error(walletError.message || "Failed to update XP wallet");
  }

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
  
  // Use attribute_points_balance for spending on attributes
  const currentApBalance = profileState.wallet?.attribute_points_balance ?? 0;

  console.log(`[SpendAttributeXp] Profile: ${profileId}, Attribute: ${attributeKey}, Cost: ${apCost} AP, Balance: ${currentApBalance} AP`);

  if (apCost <= 0) {
    throw new Error("AP cost must be positive");
  }

  if (currentApBalance < apCost) {
    throw new Error(`Insufficient Attribute Points. You have ${currentApBalance} AP but need ${apCost} AP.`);
  }

  // Get or create player attributes
  let { data: attrs } = await client
    .from("player_attributes")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  // Auto-create attributes if missing
  if (!attrs) {
    const resolvedUserId = (profileState.profile as any)?.user_id ?? userId;
    console.log(`[SpendAttributeXp] Creating missing player_attributes for profile: ${profileId}, user: ${resolvedUserId}`);

    if (!resolvedUserId) {
      throw new Error("Cannot initialize attributes: missing user id");
    }

    const { data: newAttrs, error: createError } = await client
      .from("player_attributes")
      .insert({ profile_id: profileId, user_id: resolvedUserId })
      .select()
      .single();
    
    if (createError) {
      console.error(`[SpendAttributeXp] Failed to create attributes:`, createError);
      throw new Error(`Failed to initialize player attributes: ${createError.message}`);
    }
    attrs = newAttrs;
  }

  // Each AP spent increases the attribute by 1 point
  const currentValue = (attrs as any)?.[attributeKey] ?? 10;
  const newValue = currentValue + apCost;

  // Update attribute
  const { error: attrError } = await client
    .from("player_attributes")
    .update({
      [attributeKey]: newValue,
      attribute_points_spent: (attrs?.attribute_points_spent ?? 0) + apCost,
    })
    .eq("profile_id", profileId);

  if (attrError) {
    throw new Error(attrError.message || "Failed to update attribute");
  }

  // Deduct from AP balance
  const { error: walletError } = await client
    .from("player_xp_wallet")
    .update({
      attribute_points_balance: currentApBalance - apCost,
      last_recalculated: new Date().toISOString(),
    })
    .eq("profile_id", profileId);

  if (walletError) {
    throw new Error(walletError.message || "Failed to deduct AP");
  }

  return await fetchProfileState(client, profileId);
}

export async function handleSpendSkillXp(
  client: SupabaseClient<Database>,
  userId: string,
  profileState: ProfileState,
  skillSlug: string,
  xpAmount: number,
  metadata: Record<string, unknown> = {},
): Promise<{ state: ProfileState; skillProgress: SkillProgressRow }> {
  const profileId = profileState.profile.id;
  
  // Use skill_xp_balance for spending on skills
  const currentSxpBalance = profileState.wallet?.skill_xp_balance ?? profileState.wallet?.xp_balance ?? 0;

  console.log(`[SpendSkillXp] Profile: ${profileId}, Skill: ${skillSlug}, Amount: ${xpAmount} SXP, Balance: ${currentSxpBalance} SXP`);

  if (xpAmount <= 0) {
    throw new Error("XP amount must be positive");
  }

  if (currentSxpBalance < xpAmount) {
    throw new Error(`Insufficient Skill XP. You have ${currentSxpBalance} SXP but need ${xpAmount} SXP.`);
  }

  // Get or create skill progress
  const { data: skill } = await client
    .from("skill_progress")
    .select("*")
    .eq("profile_id", profileId)
    .eq("skill_slug", skillSlug)
    .maybeSingle();

  const calculateRequiredXp = (level: number) => Math.floor(100 * Math.pow(1.5, level));

  const currentXp = skill?.current_xp ?? 0;
  const currentLevel = Math.min(skill?.current_level ?? 0, MAX_SKILL_LEVEL);
  const newXp = currentXp + xpAmount;
  let requiredXp = skill?.required_xp ?? calculateRequiredXp(currentLevel);

  let newLevel = currentLevel;
  let remainingXp = newXp;

  // Calculate level ups
  while (newLevel < MAX_SKILL_LEVEL && remainingXp >= requiredXp) {
    remainingXp -= requiredXp;
    newLevel += 1;
    requiredXp = calculateRequiredXp(newLevel);
  }

  if (newLevel >= MAX_SKILL_LEVEL) {
    newLevel = MAX_SKILL_LEVEL;
    remainingXp = Math.min(remainingXp, currentXp);
  }

  // Update skill progress
  const newRequiredXp = Math.floor(100 * Math.pow(1.5, newLevel));

  const { error: skillError } = await client
    .from("skill_progress")
    .upsert({
      profile_id: profileId,
      skill_slug: skillSlug,
      current_xp: remainingXp,
      current_level: newLevel,
      required_xp: newRequiredXp,
      last_practiced_at: new Date().toISOString(),
      metadata: metadata || {},
    }, { onConflict: "profile_id,skill_slug" });

  if (skillError) {
    throw new Error(skillError.message || "Failed to update skill");
  }

  const { data: updatedSkillProgress, error: fetchSkillError } = await client
    .from("skill_progress")
    .select("*")
    .eq("profile_id", profileId)
    .eq("skill_slug", skillSlug)
    .maybeSingle();

  if (fetchSkillError) {
    throw new Error(fetchSkillError.message || "Failed to fetch updated skill progress");
  }

  if (!updatedSkillProgress) {
    throw new Error("Updated skill progress not found");
  }

  // Deduct from SXP balance
  const { error: walletError } = await client
    .from("player_xp_wallet")
    .update({
      skill_xp_balance: currentSxpBalance - xpAmount,
      skill_xp_spent: (profileState.wallet?.skill_xp_spent ?? 0) + xpAmount,
      // Keep legacy columns in sync
      xp_balance: currentSxpBalance - xpAmount,
      xp_spent: (profileState.wallet?.xp_spent ?? 0) + xpAmount,
      last_recalculated: new Date().toISOString(),
    })
    .eq("profile_id", profileId);

  if (walletError) {
    throw new Error(walletError.message || "Failed to deduct SXP");
  }

  const state = await fetchProfileState(client, profileId);

  return { state, skillProgress: updatedSkillProgress };
}

export async function handleAwardActionXp(
  client: SupabaseClient<Database>,
  userId: string,
  profileState: ProfileState,
  amount: number,
  category: string = "performance",
  actionKey: string = "gameplay_action",
  metadata: Record<string, unknown> = {},
): Promise<ProfileState> {
  const profileId = profileState.profile.id;

  if (amount <= 0) {
    throw new Error("XP amount must be positive");
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
        ...metadata,
      },
    });

  if (ledgerError) {
    console.error("Failed to log XP in ledger:", ledgerError);
  }

  return await fetchProfileState(client, profileId);
}
