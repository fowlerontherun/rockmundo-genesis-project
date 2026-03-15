import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

export interface CharacterSlotInfo {
  maxSlots: number;
  extraSlotsPurchased: number;
  usedSlots: number;
  canCreateNew: boolean;
}

export interface CharacterProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_active: boolean;
  died_at: string | null;
  slot_number: number;
  generation_number: number;
  fame: number;
  level: number;
  health: number;
}

const baseSlots = 2;
const maxAllowedSlots = 5;

function isMissingRpcError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;

  return (
    error.code === "PGRST202" ||
    error.message?.includes("Could not find the function public.create_character_profile") ||
    error.message?.includes("Could not find the function public.switch_active_character")
  );
}

async function switchActiveCharacterFallback(userId: string, profileId: string): Promise<void> {
  const { data: targetProfile, error: targetError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("user_id", userId)
    .is("died_at", null)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!targetProfile?.id) {
    throw new Error("Character not found or unavailable");
  }

  const { error: activateTargetError } = await supabase
    .from("profiles")
    .update({ is_active: true })
    .eq("id", profileId)
    .eq("user_id", userId)
    .is("died_at", null);

  if (activateTargetError) throw activateTargetError;

  const { error: deactivateOthersError } = await supabase
    .from("profiles")
    .update({ is_active: false })
    .eq("user_id", userId)
    .neq("id", profileId)
    .eq("is_active", true)
    .is("died_at", null);

  if (deactivateOthersError) throw deactivateOthersError;
}

async function switchActiveCharacter(userId: string, profileId: string): Promise<void> {
  const { error } = await supabase.rpc("switch_active_character" as any, {
    p_profile_id: profileId,
  });

  if (!error) {
    return;
  }

  if (!isMissingRpcError(error)) {
    throw error;
  }

  await switchActiveCharacterFallback(userId, profileId);
}

async function createCharacterProfileFallback(userId: string): Promise<string> {
  const { data: slotRow, error: slotError } = await supabase
    .from("character_slots")
    .select("extra_slots_purchased")
    .eq("user_id", userId)
    .maybeSingle();

  if (slotError) throw slotError;

  const extraPurchased = slotRow?.extra_slots_purchased ?? 0;
  const maxSlots = Math.min(baseSlots + extraPurchased, maxAllowedSlots);

  const { data: existingProfiles, error: existingError } = await supabase
    .from("profiles")
    .select("id, slot_number")
    .eq("user_id", userId)
    .is("died_at", null)
    .order("slot_number", { ascending: true });

  if (existingError) throw existingError;

  const usedSlots = existingProfiles?.length ?? 0;
  if (usedSlots >= maxSlots) {
    throw new Error("No character slots available");
  }

  const nextSlot = (existingProfiles?.reduce((max, profile) => Math.max(max, profile.slot_number ?? 0), 0) ?? 0) + 1;
  const generatedUsername = `player-${userId.slice(0, 8)}-${nextSlot}`;

  const { data: insertedProfile, error: insertError } = await supabase
    .from("profiles")
    .insert({
      user_id: userId,
      username: generatedUsername,
      display_name: null,
      avatar_url: null,
      bio: null,
      cash: 10000,
      fame: 0,
      level: 1,
      health: 100,
      energy: 100,
      experience: 0,
      age: 16,
      is_active: false,
      slot_number: nextSlot,
      generation_number: 1,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;

  if (!insertedProfile?.id) {
    throw new Error("Failed to create character profile");
  }

  await switchActiveCharacter(userId, insertedProfile.id);

  return insertedProfile.id;
}

export function useCharacterSlots() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const slotsQuery = useQuery({
    queryKey: ["character-slots", user?.id],
    queryFn: async (): Promise<CharacterSlotInfo> => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data: slots, error } = await supabase
        .from("character_slots")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      const extraPurchased = slots?.extra_slots_purchased ?? 0;
      const maxSlots = Math.min(baseSlots + extraPurchased, maxAllowedSlots);

      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("died_at", null);

      const usedSlots = count ?? 1;

      return {
        maxSlots,
        extraSlotsPurchased: extraPurchased,
        usedSlots,
        canCreateNew: usedSlots < maxSlots,
      };
    },
    enabled: !!user?.id,
  });

  const charactersQuery = useQuery({
    queryKey: ["character-profiles", user?.id],
    queryFn: async (): Promise<CharacterProfile[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, display_name, username, avatar_url, is_active, died_at, slot_number, generation_number, fame, level, health")
        .eq("user_id", user.id)
        .is("died_at", null)
        .order("slot_number", { ascending: true });

      if (error) throw error;
      return (data ?? []) as CharacterProfile[];
    },
    enabled: !!user?.id,
  });

  const switchCharacter = useMutation({
    mutationFn: async (profileId: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      await switchActiveCharacter(user.id, profileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const createCharacter = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("create_character_profile" as any);

      if (!error) {
        const createdProfileId = Array.isArray(data) && data.length > 0 ? (data[0] as any)?.id : null;
        if (!createdProfileId) {
          throw new Error("Failed to create character profile");
        }

        return createdProfileId as string;
      }

      if (!isMissingRpcError(error)) {
        throw error;
      }

      return createCharacterProfileFallback(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character-slots"] });
      queryClient.invalidateQueries({ queryKey: ["character-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const deleteCharacter = useMutation({
    mutationFn: async (profileId: string) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Verify the profile belongs to this user and is not active
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("id, is_active, user_id")
        .eq("id", profileId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!profile) throw new Error("Character not found");
      if (profile.is_active) throw new Error("Cannot delete your active character. Switch to another character first.");

      // Soft-delete by setting died_at
      const { error: deleteError } = await supabase
        .from("profiles")
        .update({ died_at: new Date().toISOString(), is_active: false })
        .eq("id", profileId)
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character-slots"] });
      queryClient.invalidateQueries({ queryKey: ["character-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
    },
  });

  return {
    slots: slotsQuery.data,
    slotsLoading: slotsQuery.isLoading,
    characters: charactersQuery.data ?? [],
    charactersLoading: charactersQuery.isLoading,
    switchCharacter,
    createCharacter,
    deleteCharacter,
  };
}
