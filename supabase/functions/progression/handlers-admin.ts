import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import type { Database } from "../../../src/types/database-fallback.ts";
import type { ProfileState } from "./index.ts";
import { fetchProfileState } from "./index.ts";

type WalletRow = Database["public"]["Tables"]["player_xp_wallet"]["Row"];

export const handleAdminAwardSpecialXp = async (
  client: SupabaseClient<Database>,
  userId: string,
  currentState: ProfileState,
  amount: number,
  reason: string,
  profileIds: string[],
  applyToAll: boolean,
  metadata?: Record<string, unknown>,
): Promise<{ success: true; profiles_updated: number }> => {
  if (amount <= 0) {
    throw new Error("XP amount must be positive");
  }

  // Verify admin permission
  const { data: adminRole, error: roleError } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError || !adminRole) {
    throw new Error("Unauthorized: Admin role required");
  }

  let targetProfileIds: string[] = [];

  if (applyToAll) {
    // Get all profile IDs
    const { data: allProfiles, error: profilesError } = await client
      .from("profiles")
      .select("id");

    if (profilesError) {
      throw new Error("Failed to fetch profiles");
    }

    targetProfileIds = (allProfiles || []).map((p) => p.id);
  } else {
    targetProfileIds = profileIds;
  }

  if (targetProfileIds.length === 0) {
    throw new Error("No profiles specified");
  }

  let updatedCount = 0;

  for (const profileId of targetProfileIds) {
    try {
      // Get or create wallet
      const { data: existingWallet } = await client
        .from("player_xp_wallet")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();

      const currentBalance = existingWallet?.xp_balance ?? 0;
      const currentLifetime = existingWallet?.lifetime_xp ?? 0;

      // Update wallet
      const { error: walletError } = await client
        .from("player_xp_wallet")
        .upsert({
          profile_id: profileId,
          xp_balance: currentBalance + amount,
          lifetime_xp: currentLifetime + amount,
          last_recalculated: new Date().toISOString(),
        });

      if (walletError) {
        console.error(`Failed to update wallet for profile ${profileId}:`, walletError);
        continue;
      }

      // Log the grant
      await client.from("experience_ledger").insert({
        profile_id: profileId,
        user_id: (await client.from("profiles").select("user_id").eq("id", profileId).single()).data?.user_id,
        activity_type: "admin_grant",
        xp_amount: amount,
        metadata: {
          reason,
          granted_by: userId,
          ...metadata,
        },
      });

      updatedCount++;
    } catch (error) {
      console.error(`Failed to award XP to profile ${profileId}:`, error);
    }
  }

  return {
    success: true,
    profiles_updated: updatedCount,
  };
};
