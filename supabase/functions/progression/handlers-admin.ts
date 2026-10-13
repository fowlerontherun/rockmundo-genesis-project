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
    const allProfiles: Array<{id:string;user_id:string|null}> = [];
    for (let offset = 0;; offset += 500) {
      const { data: page, error: profilesError } = await client.from("profiles")
        .select("id, user_id").order("id", { ascending: true })
        .range(offset, offset + 499);
      if (profilesError) throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
      allProfiles.push(...(page ?? []));
      if (!page || page.length < 500) break;
    }
    targetProfileIds = allProfiles.map(p => p.id);
    profileUserMap = new Map(allProfiles.map(p => [p.id, p.user_id]));
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

  const failures: string[] = [];
  for (const profileId of targetProfileIds) {
    const { error } = await client.rpc("admin_grant_special_xp_atomic" as any, {
      p_profile_id: profileId,
      p_amount: amount,
      p_reason: reason,
      p_metadata: metadata ?? {},
      p_request_id: typeof metadata?.request_id === "string" ? metadata.request_id : null,
    });
    if (error) {
      failures.push(`${profileId}: ${error.message}`);
    } else {
      updatedCount++;
    }
  }
  if (failures.length) throw new Error(
    `XP grants applied to ${updatedCount} of ${targetProfileIds.length} profiles. ${failures.length} failed: ${failures.slice(0, 3).join("; ")}`
  );

  return {
    success: true,
    profiles_updated: updatedCount,
  };
};
