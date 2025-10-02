import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import type { Database } from "../../../src/types/database-fallback.ts";
import { fetchProfileState, type ProfileState } from "./index.ts";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type WalletRow = Database["public"]["Tables"]["player_xp_wallet"]["Row"];

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

  const dailyAmount = 150;

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
  const newValue = currentValue + 1;

  // Update attribute
  const { error: attrError } = await client
    .from("player_attributes")
    .upsert({
      ...attrs,
      profile_id: profileId,
      user_id: userId,
      [attributeKey]: newValue,
      attribute_points_spent: (attrs?.attribute_points_spent ?? 0) + 1,
    }, { onConflict: "profile_id" });

  if (attrError) {
    throw new Error(attrError.message || "Failed to update attribute");
  }

  // Deduct from wallet
  const { error: walletError } = await client
    .from("player_xp_wallet")
    .upsert({
      profile_id: profileId,
      xp_balance: currentBalance - xpAmount,
      xp_spent: (profileState.wallet?.xp_spent ?? 0) + xpAmount,
      lifetime_xp: profileState.wallet?.lifetime_xp ?? 0,
      last_recalculated: new Date().toISOString(),
    }, { onConflict: "profile_id" });

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
): Promise<ProfileState> {
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
  const { error: skillError } = await client
    .from("skill_progress")
    .upsert({
      profile_id: profileId,
      skill_slug: skillSlug,
      current_xp: remainingXp,
      current_level: newLevel,
      required_xp: requiredXp,
      last_practiced_at: new Date().toISOString(),
      metadata: metadata || {},
    }, { onConflict: "profile_id,skill_slug" });

  if (skillError) {
    throw new Error(skillError.message || "Failed to update skill");
  }

  // Deduct from wallet
  const { error: walletError } = await client
    .from("player_xp_wallet")
    .upsert({
      profile_id: profileId,
      xp_balance: currentBalance - xpAmount,
      xp_spent: (profileState.wallet?.xp_spent ?? 0) + xpAmount,
      lifetime_xp: profileState.wallet?.lifetime_xp ?? 0,
      last_recalculated: new Date().toISOString(),
    }, { onConflict: "profile_id" });

  if (walletError) {
    throw new Error(walletError.message || "Failed to deduct XP");
  }

  return await fetchProfileState(client, profileId);
}
