import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export interface UserBand {
  id: string;
  name: string;
  fame: number;
  genre: string | null;
  total_fans: number;
}

export function useUserBand() {
  const { profileId } = useActiveProfile();

  return useQuery({
    queryKey: ["user-band", profileId],
    queryFn: async (): Promise<UserBand | null> => {
      if (!profileId) return null;

      // Get band membership for the active profile
      const { data: membership, error: memberError } = await supabase
        .from("band_members")
        .select("band_id, role")
        .eq("profile_id", profileId)
        .eq("member_status", "active")
        .order("role", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (memberError || !membership) return null;

      const { data: band, error: bandError } = await supabase
        .from("bands")
        .select("id, name, fame, genre, total_fans")
        .eq("id", membership.band_id)
        .eq("status", "active")
        .single();

      if (bandError || !band) return null;

      return {
        id: band.id,
        name: band.name,
        fame: band.fame ?? 0,
        genre: band.genre,
        total_fans: band.total_fans ?? 0,
      };
    },
    enabled: !!profileId,
    staleTime: 5 * 60 * 1000,
  });
}