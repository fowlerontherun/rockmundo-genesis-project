import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import type { Database } from "../../../src/types/database-fallback.ts";
import { fetchProfileState, type ProfileState } from "./index.ts";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type WalletRow = Database["public"]["Tables"]["player_xp_wallet"]["Row"];
type SkillProgressRow = Database["public"]["Tables"]["skill_progress"]["Row"];

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
    .maybeSingle();

  if (existingGrant) {
    throw new Error("Daily XP already claimed today");
  }

  // Calculate daily XP based on account age
  const profileCreatedAt = new Date(profileState.profile.created_at);
  const now = new Date();
  const daysSinceCreation = Math.floor((now.getTime() - profileCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
  const isFirstMonth = daysSinceCreation < 30;
  
  const dailyAmount = isFirstMonth ? 10 : 5;

  // Create grant record
  const { error: grantError } = await client
    .from("profile_daily_xp_grants")
    .insert({
      profile_id: profileId,
      grant_date: todayIso,
      source: "daily_stipend",
      xp_amount: dailyAmount,
      metadata: metadata || {},
    });

  if (grantError) {
    throw new Error(grantError.message || "Failed to create daily grant");
  }

  // Update wallet
  const currentBalance = profileState.wallet?.xp_balance ?? 0;
  const currentLifetime = profileState.wallet?.lifetime_xp ?? 0;

  const { error: walletError } = await client
    .from("player_xp_wallet")
    .upsert({
      profile_id: profileId,
      xp_balance: currentBalance + dailyAmount,
      lifetime_xp: currentLifetime + dailyAmount,
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
  xpAmount: number,
  metadata: Record<string, unknown> = {},
): Promise<ProfileState> {
  const profileId = profileState.profile.id;
  const currentBalance = profileState.wallet?.xp_balance ?? 0;

  if (currentBalance < xpAmount) {
    throw new Error("Insufficient XP balance");
  }

  // Get current attributes
  const { data: attrs } = await client
    .from("player_attributes")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  const currentValue = (attrs as any)?.[attributeKey] ?? 10;
  const newValue = currentValue + xpAmount;

  // Update attribute
  const { error: attrError } = await client
    .from("player_attributes")
    .update({
      [attributeKey]: newValue,
      attribute_points_spent: (attrs?.attribute_points_spent ?? 0) + xpAmount,
    })
    .eq("profile_id", profileId);

  if (attrError) {
    throw new Error(attrError.message || "Failed to update attribute");
  }

  // Deduct from wallet
  const { error: walletError } = await client
    .from("player_xp_wallet")
    .update({
      xp_balance: currentBalance - xpAmount,
      xp_spent: (profileState.wallet?.xp_spent ?? 0) + xpAmount,
      last_recalculated: new Date().toISOString(),
    })
    .eq("profile_id", profileId);

  if (walletError) {
    throw new Error(walletError.message || "Failed to deduct XP");
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
  const currentBalance = profileState.wallet?.xp_balance ?? 0;

  if (currentBalance < xpAmount) {
    throw new Error("Insufficient XP balance");
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
  const currentLevel = skill?.current_level ?? 0;
  const newXp = currentXp + xpAmount;
  let requiredXp = skill?.required_xp ?? calculateRequiredXp(currentLevel);

  let newLevel = currentLevel;
  let remainingXp = newXp;

  // Calculate level ups
  while (remainingXp >= requiredXp) {
    remainingXp -= requiredXp;
    newLevel += 1;
    requiredXp = calculateRequiredXp(newLevel);
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

  // Deduct from wallet
  const { error: walletError } = await client
    .from("player_xp_wallet")
    .update({
      xp_balance: currentBalance - xpAmount,
      xp_spent: (profileState.wallet?.xp_spent ?? 0) + xpAmount,
      last_recalculated: new Date().toISOString(),
    })
    .eq("profile_id", profileId);

  if (walletError) {
    throw new Error(walletError.message || "Failed to deduct XP");
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

  // Update wallet with new XP
  const currentBalance = profileState.wallet?.xp_balance ?? 0;
  const currentLifetime = profileState.wallet?.lifetime_xp ?? 0;

  const { error: walletError } = await client
    .from("player_xp_wallet")
    .upsert({
      profile_id: profileId,
      xp_balance: currentBalance + amount,
      lifetime_xp: currentLifetime + amount,
      last_recalculated: new Date().toISOString(),
    }, { onConflict: "profile_id" });

  if (walletError) {
    throw new Error(walletError.message || "Failed to update XP wallet");
  }

  // Log the XP grant
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
        ...metadata,
      },
    });

  if (ledgerError) {
    console.error("Failed to log XP in ledger:", ledgerError);
  }

  return await fetchProfileState(client, profileId);
}
