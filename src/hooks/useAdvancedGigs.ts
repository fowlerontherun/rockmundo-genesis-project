import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GigOffer {
  id: string;
  band_id: string;
  venue_id: string;
  slot_type: string;
  offered_date: string;
  base_payout: number;
  status: string;
  expires_at: string;
  created_at: string;
  venue?: {
    name: string;
    capacity: number;
    city_id: string;
  };
}

export interface GigConflict {
  id: string;
  band_id: string;
  gig_id_1: string;
  gig_id_2: string;
  conflict_type: string;
  detected_at: string;
  resolved: boolean;
  resolution_note: string | null;
}

export interface ActivityLockout {
  id: string;
  band_id: string;
  activity_type: string;
  locked_until: string;
  reason: string | null;
  created_at: string;
}

export const useAdvancedGigs = (bandId?: string) => {
  // Fetch pending gig offers
  const { data: offers = [], isLoading: offersLoading } = useQuery({
    queryKey: ["gig-offers", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await supabase
        .from("gig_offers")
        .select(`
          *,
          venue:venues(name, capacity, city_id)
        `)
        .eq("band_id", bandId)
        .eq("status", "pending")
        .order("expires_at", { ascending: true });

      if (error) throw error;
      return data as any;
    },
    enabled: !!bandId,
  });

  // Fetch scheduling conflicts
  const { data: conflicts = [], isLoading: conflictsLoading } = useQuery({
    queryKey: ["gig-conflicts", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await supabase
        .from("band_conflicts")
        .select("*")
        .eq("band_id", bandId)
        .eq("resolved", false)
        .order("detected_at", { ascending: false });

      if (error) throw error;
      return data as GigConflict[];
    },
    enabled: !!bandId,
  });

  // Fetch activity lockouts
  const { data: lockouts = [], isLoading: lockoutsLoading } = useQuery({
    queryKey: ["activity-lockouts", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await supabase
        .from("band_activity_lockouts")
        .select("*")
        .eq("band_id", bandId)
        .gte("locked_until", new Date().toISOString())
        .order("locked_until", { ascending: true });

      if (error) throw error;
      return data as ActivityLockout[];
    },
    enabled: !!bandId,
  });

  // Fetch upcoming scheduled gigs
  const { data: upcomingGigs = [], isLoading: gigsLoading } = useQuery({
    queryKey: ["upcoming-gigs", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await supabase
        .from("gigs")
        .select(`
          *,
          venue:venues(name, capacity, city_id)
        `)
        .eq("band_id", bandId)
        .in("status", ["scheduled", "confirmed"])
        .gte("scheduled_date", new Date().toISOString())
        .order("scheduled_date", { ascending: true })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!bandId,
  });

  return {
    offers,
    conflicts,
    lockouts,
    upcomingGigs,
    isLoading: offersLoading || conflictsLoading || lockoutsLoading || gigsLoading,
  };
};
