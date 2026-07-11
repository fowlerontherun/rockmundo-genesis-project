import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PublicParticipantProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type RehearsalParticipant = {
  id: string;
  rehearsal_id: string;
  band_id: string;
  profile_id: string;
  participation_status: string;
  responded_at: string | null;
  profiles: PublicParticipantProfile | null;
};

export type GigPerformer = {
  id: string;
  gig_id: string;
  band_id: string;
  profile_id: string;
  role_or_instrument: string | null;
  lineup_status: string;
  profiles: PublicParticipantProfile | null;
};

const profileSelect = "id, username, display_name, avatar_url";

export function useRehearsalParticipants(rehearsalId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["rehearsal-participants", rehearsalId],
    enabled: enabled && !!rehearsalId,
    queryFn: async (): Promise<RehearsalParticipant[]> => {
      const { data, error } = await (supabase as any)
        .from("band_rehearsal_participants")
        .select(`id, rehearsal_id, band_id, profile_id, participation_status, responded_at, profiles:profiles!band_rehearsal_participants_profile_id_fkey(${profileSelect})`)
        .eq("rehearsal_id", rehearsalId)
        .order("participation_status", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as RehearsalParticipant[];
    },
  });
}

export function useGigPerformers(gigId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["gig-performers", gigId],
    enabled: enabled && !!gigId,
    queryFn: async (): Promise<GigPerformer[]> => {
      const { data, error } = await (supabase as any)
        .from("gig_performers")
        .select(`id, gig_id, band_id, profile_id, role_or_instrument, lineup_status, profiles:profiles!gig_performers_profile_id_fkey(${profileSelect})`)
        .eq("gig_id", gigId)
        .order("lineup_status", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as GigPerformer[];
    },
  });
}
