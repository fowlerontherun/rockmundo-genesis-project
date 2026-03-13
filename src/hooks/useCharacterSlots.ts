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
      const baseSlots = 2;
      const maxSlots = Math.min(baseSlots + extraPurchased, 5);

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

      const { error } = await supabase.rpc("switch_active_character", {
        p_profile_id: profileId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["player-character-identity"] });
    },
  });

  const createCharacter = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("create_character_profile");
      if (error) throw error;

      const createdProfileId = Array.isArray(data)
        ? data[0]?.id
        : typeof data === "object" && data !== null && "id" in data
          ? (data as { id?: string }).id
          : null;
      if (!createdProfileId) {
        throw new Error("Failed to create character profile");
      }

      return createdProfileId as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["character-slots"] });
      queryClient.invalidateQueries({ queryKey: ["character-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["player-character-identity"] });
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
