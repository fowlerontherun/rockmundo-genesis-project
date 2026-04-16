import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TourStats {
  totalTicketRevenue: number;
  totalMerchRevenue: number;
  totalNetProfit: number;
  totalFameGained: number;
  avgRating: number | null;
  completedShows: number;
  totalShows: number;
  totalTicketsSold: number;
  totalCapacity: number;
  bestShow: { venueName: string; rating: number } | null;
  worstShow: { venueName: string; rating: number } | null;
}

/** Fetches aggregated stats for a single tour from gig_outcomes */
export function useTourStats(tourId: string | null | undefined) {
  return useQuery({
    queryKey: ["tour-stats", tourId],
    queryFn: async (): Promise<TourStats> => {
      if (!tourId) throw new Error("No tour ID");

      // Get gigs for this tour
      const { data: gigs, error: gigsErr } = await supabase
        .from("gigs")
        .select("id, venue_id, status, tickets_sold")
        .eq("tour_id", tourId);
      if (gigsErr) throw gigsErr;

      const gigIds = (gigs || []).map((g) => g.id);
      const venueIds = [...new Set((gigs || []).map((g) => g.venue_id).filter(Boolean))] as string[];

      // Get outcomes + venues in parallel
      const [outcomesRes, venuesRes] = await Promise.all([
        gigIds.length > 0
          ? supabase
              .from("gig_outcomes")
              .select("gig_id, ticket_revenue, merch_revenue, net_profit, fame_gained, overall_rating")
              .in("gig_id", gigIds)
          : Promise.resolve({ data: [], error: null }),
        venueIds.length > 0
          ? supabase.from("venues").select("id, name, capacity").in("id", venueIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (outcomesRes.error) throw outcomesRes.error;

      const outcomes = outcomesRes.data || [];
      const venueMap = new Map((venuesRes.data || []).map((v: any) => [v.id, v]));
      const gigVenueMap = new Map((gigs || []).map((g) => [g.id, g.venue_id]));

      let totalTicketRevenue = 0;
      let totalMerchRevenue = 0;
      let totalNetProfit = 0;
      let totalFameGained = 0;
      let ratingSum = 0;
      let ratingCount = 0;
      let bestShow: TourStats["bestShow"] = null;
      let worstShow: TourStats["worstShow"] = null;

      for (const o of outcomes) {
        totalTicketRevenue += o.ticket_revenue || 0;
        totalMerchRevenue += o.merch_revenue || 0;
        totalNetProfit += o.net_profit || 0;
        totalFameGained += o.fame_gained || 0;
        if (o.overall_rating != null) {
          ratingSum += o.overall_rating;
          ratingCount++;
          const venueId = gigVenueMap.get(o.gig_id);
          const venue = venueId ? venueMap.get(venueId) : null;
          const name = venue?.name || "Unknown Venue";
          if (!bestShow || o.overall_rating > bestShow.rating) {
            bestShow = { venueName: name, rating: o.overall_rating };
          }
          if (!worstShow || o.overall_rating < worstShow.rating) {
            worstShow = { venueName: name, rating: o.overall_rating };
          }
        }
      }

      const completedShows = (gigs || []).filter((g) => g.status === "completed").length;
      const totalCapacity = [...venueMap.values()].reduce((s: number, v: any) => s + (v.capacity || 0), 0);
      const totalTicketsSold = (gigs || []).reduce((s, g) => s + (g.tickets_sold || 0), 0);

      return {
        totalTicketRevenue,
        totalMerchRevenue,
        totalNetProfit,
        totalFameGained,
        avgRating: ratingCount > 0 ? ratingSum / ratingCount : null,
        completedShows,
        totalShows: (gigs || []).length,
        totalTicketsSold,
        totalCapacity,
        bestShow,
        worstShow,
      };
    },
    enabled: !!tourId,
  });
}

/** Fetches aggregated stats for ALL tours belonging to a band */
export function useBandTourTotals(bandId: string | null | undefined) {
  return useQuery({
    queryKey: ["band-tour-totals", bandId],
    queryFn: async () => {
      if (!bandId) throw new Error("No band ID");

      const { data: gigs, error } = await supabase
        .from("gigs")
        .select("id, tour_id")
        .eq("band_id", bandId)
        .not("tour_id", "is", null);
      if (error) throw error;

      const gigIds = (gigs || []).map((g) => g.id);
      if (gigIds.length === 0) return { totalRevenue: 0, totalFame: 0, totalProfit: 0 };

      const { data: outcomes, error: oErr } = await supabase
        .from("gig_outcomes")
        .select("ticket_revenue, merch_revenue, net_profit, fame_gained")
        .in("gig_id", gigIds);
      if (oErr) throw oErr;

      const totalRevenue = (outcomes || []).reduce((s, o) => s + (o.ticket_revenue || 0) + (o.merch_revenue || 0), 0);
      const totalFame = (outcomes || []).reduce((s, o) => s + (o.fame_gained || 0), 0);
      const totalProfit = (outcomes || []).reduce((s, o) => s + (o.net_profit || 0), 0);

      return { totalRevenue, totalFame, totalProfit };
    },
    enabled: !!bandId,
  });
}
