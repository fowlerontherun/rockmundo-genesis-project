import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/lib/supabase-types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const ACTIVE_PROFILE_SELECT = "*";

const isMissingSwitchFunctionError = (error: { code?: string; message?: string }) =>
  error.code === "PGRST202" ||
  error.message?.includes("Could not find the function public.switch_active_character");

export async function getActiveProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(ACTIVE_PROFILE_SELECT)
    .eq("user_id", userId)
    .eq("is_active", true)
    .is("died_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load active profile: ${error.message}`);
  }

  return (data as ProfileRow | null) ?? null;
}

export async function getFirstLivingProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(ACTIVE_PROFILE_SELECT)
    .eq("user_id", userId)
    .is("died_at", null)
    .order("slot_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load fallback profile: ${error.message}`);
  }

  return (data as ProfileRow | null) ?? null;
}

export async function activateProfile(profile: ProfileRow, userId: string): Promise<ProfileRow> {
  if (profile.is_active) {
    return profile;
  }

  const { error: switchError } = await supabase.rpc("switch_active_character" as any, {
    p_profile_id: profile.id,
  });

  if (switchError && !isMissingSwitchFunctionError(switchError)) {
    throw new Error(`Failed to switch active profile: ${switchError.message}`);
  }

  if (switchError) {
    const { error: activateTargetError } = await supabase
      .from("profiles")
      .update({ is_active: true })
      .eq("id", profile.id)
      .eq("user_id", userId)
      .is("died_at", null);

    if (activateTargetError) {
      throw new Error(`Failed to activate profile: ${activateTargetError.message}`);
    }

    const { error: deactivateOthersError } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("user_id", userId)
      .neq("id", profile.id)
      .eq("is_active", true)
      .is("died_at", null);

    if (deactivateOthersError) {
      throw new Error(`Failed to deactivate previous profiles: ${deactivateOthersError.message}`);
    }
  }

  return { ...profile, is_active: true };
}

export async function getOrActivatePlayableProfile(userId: string): Promise<ProfileRow | null> {
  const activeProfile = await getActiveProfile(userId);
  if (activeProfile) {
    return activeProfile;
  }

  const fallbackProfile = await getFirstLivingProfile(userId);
  if (!fallbackProfile) {
    return null;
  }

  return activateProfile(fallbackProfile, userId);
}
