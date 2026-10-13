import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

async function assertRecoverySlotAvailable(userId: string): Promise<number> {
  const { data: slot, error: slotError } = await supabase.from("character_slots")
    .select("extra_slots_purchased").eq("user_id", userId).maybeSingle();
  if (slotError) throw slotError;
  const maxSlots = Math.min(5, 2 + (slot?.extra_slots_purchased ?? 0));
  const { count, error: countError } = await supabase.from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId).is("deleted_at", null).is("died_at", null);
  if (countError) throw countError;
  if (count === null || count >= maxSlots) throw new Error("No character slots available");
  const { data: last, error: lastError } = await supabase.from("profiles")
    .select("slot_number").eq("user_id", userId)
    .order("slot_number", { ascending: false }).limit(1);
  if (lastError) throw lastError;
  return (last?.[0]?.slot_number ?? 0) + 1;
}

export interface DeadCharacter {
  id: string;
  profile_id: string;
  character_name: string;
  avatar_url: string | null;
  cause_of_death: string;
  died_at: string;
  total_fame: number;
  total_cash_at_death: number;
  final_skills: Record<string, number>;
  generation_number: number;
  resurrection_lives: number;
  coma_started_at: string | null;
  coma_last_account_activity_at: string | null;
}

export function useCharacterDeath() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query dead profiles directly from profiles table (more reliable than hall_of_immortals)
  const deadCharactersQuery = useQuery({
    queryKey: ["dead-characters", user?.id],
    queryFn: async (): Promise<DeadCharacter[]> => {
      if (!user?.id) return [];

      // Get dead profiles directly - these always exist even if hall_of_immortals entry is missing
      const { data: deadProfiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, died_at, death_cause, coma_started_at, coma_last_account_activity_at, fame, cash, level, generation_number, resurrection_lives")
        .eq("user_id", user.id)
        .not("died_at", "is", null)
        .is("deleted_at", null)
        .order("died_at", { ascending: false }) as any;

      if (profileError) throw profileError;
      if (!deadProfiles || deadProfiles.length === 0) return [];

      // Try to get memorial data from hall_of_immortals for richer info
      const { data: memorials } = await supabase
        .from("hall_of_immortals")
        .select("profile_id, character_name, cause_of_death, total_fame, total_cash_at_death, final_skills")
        .eq("user_id", user.id);

      const memorialMap = new Map(
        (memorials ?? []).map((m) => [m.profile_id, m])
      );

      return deadProfiles.map((p) => {
        const memorial = memorialMap.get(p.id);
        return {
          id: p.id,
          profile_id: p.id,
          character_name: memorial?.character_name ?? p.display_name ?? p.username ?? "Unknown",
          avatar_url: p.avatar_url,
          cause_of_death: p.death_cause ?? memorial?.cause_of_death ?? "Unknown",
          died_at: p.died_at!,
          total_fame: memorial?.total_fame ?? p.fame ?? 0,
          total_cash_at_death: memorial?.total_cash_at_death ?? p.cash ?? 0,
          final_skills: (memorial?.final_skills as Record<string, number>) ?? {},
          generation_number: p.generation_number ?? 1,
          resurrection_lives: (p as any).resurrection_lives ?? 0,
          coma_started_at: p.coma_started_at ?? null,
          coma_last_account_activity_at: p.coma_last_account_activity_at ?? null,
        };
      });
    },
    enabled: !!user?.id,
  });

  // Any living slot keeps the account in the normal playable flow. The game
  // data loader activates a living fallback when no current row is active.
  const hasLivingCharacter = useQuery({
    queryKey: ["has-living-character", user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user?.id) return false;

      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .is("died_at", null);

      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: !!user?.id,
  });

  // Create child character inheriting 10% skills, 50% cash
  const createChildCharacter = useMutation({
    mutationFn: async (input: string | { parentProfileId: string; displayName?: string; username?: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const parentProfileId = typeof input === "string" ? input : input.parentProfileId;
      const displayName = typeof input === "string" ? undefined : input.displayName?.trim() || undefined;
      const providedUsername = typeof input === "string" ? undefined : input.username?.trim() || undefined;

      const { data: profileId, error } = await supabase.rpc("create_recovery_character_atomic" as any, {
        p_parent_profile_id: parentProfileId,
        p_username: providedUsername ?? null,
        p_display_name: displayName ?? null,
      });
      if (error) throw error;
      if (!profileId) throw new Error("Recovery character creation failed");
      return profileId as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
      queryClient.invalidateQueries({ queryKey: ["character-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["has-living-character"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const resurrectCharacter = useMutation({
    mutationFn: async (profileId: string) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { error } = await supabase.rpc("resurrect_character" as any, {
        p_profile_id: profileId,
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
      queryClient.invalidateQueries({ queryKey: ["character-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["has-living-character"] });
      queryClient.invalidateQueries({ queryKey: ["dead-characters"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  // Create fresh random character (no inheritance)
  const createFreshCharacter = useMutation({
    mutationFn: async (input?: { displayName?: string; username?: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const displayName = input?.displayName?.trim() || undefined;
      const providedUsername = input?.username?.trim() || undefined;

      const { error } = await supabase.rpc("create_recovery_character_atomic" as any, {
        p_parent_profile_id: null,
        p_username: providedUsername ?? null,
        p_display_name: displayName ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
      queryClient.invalidateQueries({ queryKey: ["character-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["has-living-character"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  // Update last_login_at on the active profile
  const updateLastLogin = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;

      await supabase
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_active", true);
    },
  });

  return {
    deadCharacters: deadCharactersQuery.data ?? [],
    deadCharactersLoading: deadCharactersQuery.isLoading,
    hasLivingCharacter: hasLivingCharacter.data ?? true,
    hasLivingCharacterLoading: hasLivingCharacter.isLoading,
    createChildCharacter,
    resurrectCharacter,
    createFreshCharacter,
    updateLastLogin,
  };
}
