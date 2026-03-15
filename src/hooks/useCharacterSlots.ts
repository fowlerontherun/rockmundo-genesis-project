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

  const { error: deactivateError } = await supabase
    .from("profiles")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);

  if (deactivateError) throw deactivateError;

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
      is_active: true,
      slot_number: nextSlot,
      generation_number: 1,
      unlock_cost: 0,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;

  if (!insertedProfile?.id) {
    throw new Error("Failed to create character profile");
  }

  return insertedProfile.id;
}

export function useCharacterSlots() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const slotsQuery = useQuery({
    queryKey: ["character-slots", user?.id],
    queryFn: async (): Promise<CharacterSlotInfo> => {
      if (!user?.id) throw new Error("Not authenticated");

      // Get or create character_slots row
      const { data: slots, error } = await supabase
        .from("character_slots")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      const extraPurchased = slots?.extra_slots_purchased ?? 0;
      const maxSlots = Math.min(baseSlots + extraPurchased, maxAllowedSlots);

      // Count living profiles
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

      const { error } = await supabase.rpc("switch_active_character" as any, {
        p_profile_id: profileId,
      });

      if (error) throw error;
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

      const isMissingFunctionError =
        error.message?.includes("Could not find the function public.create_character_profile") ||
        error.code === "PGRST202";

      if (!isMissingFunctionError) {
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

  return {
    slots: slotsQuery.data,
    slotsLoading: slotsQuery.isLoading,
    characters: charactersQuery.data ?? [],
    charactersLoading: charactersQuery.isLoading,
    switchCharacter,
    createCharacter,
  };
}
