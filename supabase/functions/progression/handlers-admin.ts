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
  let profileUserMap = new Map<string, string | null>();

  if (applyToAll) {
    // Get all profile IDs (+ user IDs for ledger)
    const { data: allProfiles, error: profilesError } = await client
      .from("profiles")
      .select("id, user_id");

    if (profilesError) {
      throw new Error("Failed to fetch profiles");
    }

    targetProfileIds = (allProfiles || []).map((p) => p.id);
    profileUserMap = new Map((allProfiles || []).map((p) => [p.id, p.user_id]));
  } else {
    targetProfileIds = profileIds;

    const { data: targetProfiles, error: targetProfilesError } = await client
      .from("profiles")
      .select("id, user_id")
      .in("id", targetProfileIds);

    if (targetProfilesError) {
      throw new Error("Failed to fetch target profiles");
    }

    profileUserMap = new Map((targetProfiles || []).map((p) => [p.id, p.user_id]));
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

      const walletData = {
        profile_id: profileId,
        xp_balance: currentBalance + amount,
        lifetime_xp: currentLifetime + amount,
        last_recalculated: new Date().toISOString(),
      };

      let walletSuccess = false;

      if (existingWallet) {
        const { error: updateError } = await client
          .from("player_xp_wallet")
          .update({
            xp_balance: currentBalance + amount,
            lifetime_xp: currentLifetime + amount,
            last_recalculated: new Date().toISOString(),
          })
          .eq("profile_id", profileId);

        if (updateError) {
          console.error(`Failed to update wallet for profile ${profileId}:`, updateError);
        } else {
          walletSuccess = true;
        }
      } else {
        const { error: insertError } = await client
          .from("player_xp_wallet")
          .insert(walletData);

        if (insertError) {
          console.error(`Failed to insert wallet for profile ${profileId}:`, insertError);
        } else {
          walletSuccess = true;
        }
      }

      if (!walletSuccess) {
        console.error(`Wallet operation failed for profile ${profileId}, skipping`);
        continue;
      }

      // Count as rewarded once wallet update succeeded.
      updatedCount++;

      // Log the grant (best-effort; do not fail the reward if ledger insert fails)
      const targetUserId = profileUserMap.get(profileId) ?? null;
      if (!targetUserId) {
        console.warn(
          `Skipping experience_ledger insert for profile ${profileId}: missing user_id on profiles row`,
        );
        continue;
      }

      const { error: ledgerError } = await client.from("experience_ledger").insert({
        profile_id: profileId,
        user_id: targetUserId,
        activity_type: "admin_grant",
        xp_amount: amount,
        metadata: {
          reason,
          granted_by: userId,
          ...metadata,
        },
      });

      if (ledgerError) {
        console.error(`Failed to insert experience_ledger for profile ${profileId}:`, ledgerError);
      }
    } catch (error) {
      console.error(`Failed to award XP to profile ${profileId}:`, error);
    }
  }

  return {
    success: true,
    profiles_updated: updatedCount,
  };
};
