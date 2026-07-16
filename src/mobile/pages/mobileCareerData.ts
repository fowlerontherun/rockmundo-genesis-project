import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useAdvancedGigs } from "@/hooks/useAdvancedGigs";
import { useSongwritingData } from "@/hooks/useSongwritingData";

export function useMobileCareerData() {
  const active = useActiveProfile();
  const primaryBand = usePrimaryBand();
  const bandId = primaryBand.data?.band_id ?? null;
  const songwriting = useSongwritingData(active.profileId, active.userId);
  const gigs = useAdvancedGigs(bandId ?? undefined);

  const members = useQuery({
    queryKey: ["mobile-career-band-members", bandId],
    enabled: !!bandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_members")
        .select("id, role, instrument, joined_at, member_status, is_touring_member, profile:profiles!band_members_profile_id_fkey(id, display_name, stage_name, avatar_url, last_active)")
        .eq("band_id", bandId)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const songs = useQuery({
    queryKey: ["mobile-career-songs", active.userId, bandId],
    enabled: !!active.userId || !!bandId,
    queryFn: async () => {
      let query = supabase
        .from("songs")
        .select("id,title,genre,status,quality_score,completion_percentage,created_at,updated_at,archived,band_id,user_id,profile_id,bands(name,genre)")
        .order("updated_at", { ascending: false })
        .limit(80);
      if (bandId && active.userId) query = query.or(`user_id.eq.${active.userId},band_id.eq.${bandId}`);
      else if (active.userId) query = query.eq("user_id", active.userId);
      else if (bandId) query = query.eq("band_id", bandId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).filter((song: any) => song.archived !== true);
    },
  });


  const rehearsals = useQuery({
    queryKey: ["mobile-career-rehearsals", bandId],
    enabled: !!bandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_rehearsals")
        .select("id, band_id, rehearsal_room_id, duration_hours, total_cost, scheduled_start, scheduled_end, selected_song_id, setlist_id, status, chemistry_gain, xp_earned, familiarity_gained, rehearsal_rooms:rehearsal_room_id(name, location, hourly_rate)")
        .eq("band_id", bandId)
        .order("scheduled_start", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  const completedGigs = useQuery({
    queryKey: ["mobile-career-completed-gigs", bandId],
    enabled: !!bandId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gigs")
        .select("*, venue:venues!gigs_venue_id_fkey(name, capacity, city_id)")
        .eq("band_id", bandId)
        .eq("status", "completed")
        .order("scheduled_date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  return { active, primaryBand, band: primaryBand.data?.bands ?? null, bandRole: primaryBand.data?.role ?? null, members, songs, songwriting, rehearsals, gigs, completedGigs };
}

export function canManageBand(role?: string | null) {
  return ["leader", "manager", "founder"].includes(String(role ?? "").toLowerCase());
}

export function songProgress(song: any) {
  return Number(song?.completion_percentage ?? (song?.status === "completed" || song?.status === "recorded" || song?.status === "released" ? 100 : 35));
}

export function gigReadiness(gig: any) {
  const setlistReady = Boolean(gig?.setlist_id || gig?.setlist_status === "ready");
  const travelReady = Boolean(gig?.travel_booked || gig?.travel_status === "ready" || gig?.status === "completed");
  const equipmentReady = gig?.equipment_status !== "blocked";
  const score = [setlistReady, travelReady, equipmentReady].filter(Boolean).length * 33 + (gig?.status === "confirmed" ? 1 : 0);
  return Math.min(100, score);
}
