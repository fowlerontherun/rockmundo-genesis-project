import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export interface ClubPresenceEntry {
  id: string;
  profile_id: string;
  club_id: string;
  entered_at: string;
  expires_at: string;
  profile?: { display_name: string | null; username: string | null; level: number | null; fame: number | null } | null;
}

export const useClubPresence = (clubId?: string) => {
  return useQuery<ClubPresenceEntry[]>({
    queryKey: ["club-presence", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await (supabase as any)
        .from("club_presence")
        .select(`*, profile:profiles!profile_id(display_name, username, level, fame)`)
        .eq("club_id", clubId)
        .gte("expires_at", new Date().toISOString())
        .order("entered_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ClubPresenceEntry[];
    },
    enabled: !!clubId,
    refetchInterval: 30000,
  });
};

export const useEnterClub = () => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clubId: string) => {
      if (!profileId) throw new Error("Not signed in");
      const { error } = await (supabase as any)
        .from("club_presence")
        .upsert(
          {
            profile_id: profileId,
            club_id: clubId,
            entered_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          },
          { onConflict: "profile_id,club_id" }
        );
      if (error) throw error;
    },
    onSuccess: (_, clubId) => {
      queryClient.invalidateQueries({ queryKey: ["club-presence", clubId] });
    },
  });
};
