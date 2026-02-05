import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FestivalPerformanceRecord {
  id: string;
  participation_id: string;
  band_id: string;
  festival_id: string;
  user_id: string;
  performance_score: number;
  crowd_energy_peak: number;
  crowd_energy_avg: number;
  songs_performed: number;
  payment_earned: number;
  fame_earned: number;
  merch_revenue: number;
  new_fans_gained: number;
  critic_score: number | null;
  fan_score: number | null;
  review_headline: string | null;
  review_summary: string | null;
  highlight_moments: string[];
  slot_type: string | null;
  stage_name: string | null;
  performance_date: string | null;
  attendance_estimate: number | null;
  weather_conditions: string | null;
  created_at: string;
  festival?: {
    title: string;
    location: string;
    start_date: string;
  };
}

export interface FestivalCareerStats {
  totalPerformances: number;
  averageScore: number;
  totalEarnings: number;
  totalFameGained: number;
  totalMerchRevenue: number;
  totalNewFans: number;
  bestPerformance: FestivalPerformanceRecord | null;
  headlineSlots: number;
  uniqueFestivals: number;
}

export function useFestivalHistory(bandId?: string, userId?: string) {
  // Fetch all performance history for the band
  const { data: performances = [], isLoading, error, refetch } = useQuery({
    queryKey: ["festival-performance-history", bandId, userId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("festival_performance_history")
        .select(`
          *,
          festival:game_events!festival_id(title, location, start_date)
        `)
        .order("created_at", { ascending: false });

      if (bandId) {
        query = query.eq("band_id", bandId);
      } else if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((p: any) => ({
        ...p,
        highlight_moments: p.highlight_moments || [],
      })) as FestivalPerformanceRecord[];
    },
    enabled: !!(bandId || userId),
  });

  // Calculate career stats
  const stats: FestivalCareerStats = {
    totalPerformances: performances.length,
    averageScore: performances.length > 0
      ? Math.round(performances.reduce((acc, p) => acc + p.performance_score, 0) / performances.length)
      : 0,
    totalEarnings: performances.reduce((acc, p) => acc + p.payment_earned, 0),
    totalFameGained: performances.reduce((acc, p) => acc + p.fame_earned, 0),
    totalMerchRevenue: performances.reduce((acc, p) => acc + p.merch_revenue, 0),
    totalNewFans: performances.reduce((acc, p) => acc + p.new_fans_gained, 0),
    bestPerformance: performances.length > 0
      ? performances.reduce((best, p) => p.performance_score > best.performance_score ? p : best, performances[0])
      : null,
    headlineSlots: performances.filter((p) => p.slot_type === "headline").length,
    uniqueFestivals: new Set(performances.map((p) => p.festival_id)).size,
  };

  return {
    performances,
    stats,
    isLoading,
    error,
    refetch,
  };
}

// Fetch reviews for a specific performance
export function useFestivalReviews(performanceId?: string) {
  return useQuery({
    queryKey: ["festival-reviews", performanceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festival_reviews")
        .select("*")
        .eq("performance_id", performanceId)
        .order("published_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!performanceId,
  });
}

// Fetch rivalries for a festival
export function useFestivalRivalries(festivalId?: string, bandId?: string) {
  return useQuery({
    queryKey: ["festival-rivalries", festivalId, bandId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("festival_rivalries")
        .select(`
          *,
          band_a:bands!band_a_id(id, name, genre, fame),
          band_b:bands!band_b_id(id, name, genre, fame),
          winner:bands!winner_band_id(id, name)
        `);

      if (festivalId) {
        query = query.eq("festival_id", festivalId);
      }

      if (bandId) {
        query = query.or(`band_a_id.eq.${bandId},band_b_id.eq.${bandId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!(festivalId || bandId),
  });
}

// Fetch sponsorships for a festival
export function useFestivalSponsorships(festivalId?: string) {
  return useQuery({
    queryKey: ["festival-sponsorships-detail", festivalId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festival_sponsorships")
        .select(`
          *,
          brand:sponsorship_brands(id, name, logo_url, wealth_tier)
        `)
        .eq("festival_id", festivalId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!festivalId,
  });
}

// Fetch merch sales for a performance
export function useFestivalMerchSales(performanceId?: string) {
  return useQuery({
    queryKey: ["festival-merch-sales", performanceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festival_merch_sales")
        .select("*")
        .eq("performance_id", performanceId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!performanceId,
  });
}
