import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

export interface UserBand {
  id: string;
  name: string;
  fame: number;
  genre: string | null;
  total_fans: number;
}

export function useUserBand() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-band", user?.id],
    queryFn: async (): Promise<UserBand | null> => {
      if (!user?.id) return null;

      // First get the band_id from band_members where user is leader or member
      const { data: membership, error: memberError } = await supabase
        .from("band_members")
        .select("band_id, role")
        .eq("user_id", user.id)
        .eq("member_status", "active")
        .order("role", { ascending: true }) // leader comes first
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
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}
