import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export interface PerformanceStats {
  totalGigs: number;
  totalRevenue: number;
  averageRating: number;
  totalAttendance: number;
  bestPerformance: {
    venue: string;
    rating: number;
    date: string;
  } | null;
}

export interface SongwritingStats {
  totalSongs: number;
  averageQuality: number;
  totalStreams: number;
  totalRevenue: number;
  topSong: {
    title: string;
    streams: number;
    quality: number;
  } | null;
}

export interface BandStats {
  bandName: string;
  memberCount: number;
  chemistryLevel: number;
  fameLev: number;
  totalEarnings: number;
}

export const usePlayerStatistics = (userId?: string) => {
  const { profileId } = useActiveProfile();

  const { data: performanceStats, isLoading: isLoadingPerformance } = useQuery({
    queryKey: ["player-performance-stats", profileId],
    queryFn: async () => {
      if (!profileId) return null;

      // Get bands for this profile
      const { data: memberships } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("profile_id", profileId)
        .eq("member_status", "active");

      const bandIds = memberships?.map(m => m.band_id) || [];
      if (bandIds.length === 0) return {
        totalGigs: 0, totalRevenue: 0, averageRating: 0, totalAttendance: 0, bestPerformance: null,
      };

      const { data: outcomes } = await supabase
        .from("gig_outcomes")
        .select(`
          *,
          gig:gigs(
            venue:venues(name)
          )
        `)
        .in("gig.band_id", bandIds)
        .order("created_at", { ascending: false });

      if (!outcomes || outcomes.length === 0) {
        return {
          totalGigs: 0,
          totalRevenue: 0,
          averageRating: 0,
          totalAttendance: 0,
          bestPerformance: null,
        };
      }

      const totalGigs = outcomes.length;
      const totalRevenue = outcomes.reduce((sum, o) => sum + (o.total_revenue || 0), 0);
      const totalAttendance = outcomes.reduce((sum, o) => sum + (o.actual_attendance || 0), 0);
      const averageRating = outcomes.reduce((sum, o) => sum + (o.overall_rating || 0), 0) / totalGigs;

      const best = outcomes.reduce((best, current) => {
        if (!best || (current.overall_rating || 0) > (best.overall_rating || 0)) {
          return current;
        }
        return best;
      }, outcomes[0]);

      return {
        totalGigs,
        totalRevenue,
        averageRating: Math.round(averageRating * 10) / 10,
        totalAttendance,
        bestPerformance: best ? {
          venue: (best.gig as any)?.venue?.name || "Unknown",
          rating: best.overall_rating || 0,
          date: best.created_at,
        } : null,
      } as PerformanceStats;
    },
    enabled: !!profileId,
  });

  const { data: songwritingStats, isLoading: isLoadingSongwriting } = useQuery({
    queryKey: ["player-songwriting-stats", profileId],
    queryFn: async () => {
      if (!profileId) return null;

      const { data: songs } = await supabase
        .from("songs")
        .select("*")
        .eq("profile_id", profileId);

      if (!songs || songs.length === 0) {
        return {
          totalSongs: 0,
          averageQuality: 0,
          totalStreams: 0,
          totalRevenue: 0,
          topSong: null,
        };
      }

      const totalSongs = songs.length;
      const totalStreams = songs.reduce((sum, s) => sum + (s.streams || 0), 0);
      const totalRevenue = songs.reduce((sum, s) => sum + (s.revenue || 0), 0);
      const averageQuality = songs.reduce((sum, s) => sum + (s.quality_score || 0), 0) / totalSongs;

      const top = songs.reduce((top, current) => {
        if (!top || (current.streams || 0) > (top.streams || 0)) {
          return current;
        }
        return top;
      }, songs[0]);

      return {
        totalSongs,
        averageQuality: Math.round(averageQuality * 10) / 10,
        totalStreams,
        totalRevenue,
        topSong: top ? {
          title: top.title,
          streams: top.streams || 0,
          quality: top.quality_score || 0,
        } : null,
      } as SongwritingStats;
    },
    enabled: !!profileId,
  });

  return {
    performanceStats,
    songwritingStats,
    isLoading: isLoadingPerformance || isLoadingSongwriting,
  };
};
