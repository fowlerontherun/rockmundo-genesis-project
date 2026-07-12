import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

export const playerAttributesQueryKey = (profileId?: string | null) => ["player-attributes", profileId] as const;

export function usePlayerAttributesQuery(profileId?: string | null) {
  return useQuery<Tables<"player_attributes"> | null>({
    queryKey: playerAttributesQueryKey(profileId),
    enabled: Boolean(profileId),
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("player_attributes")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
