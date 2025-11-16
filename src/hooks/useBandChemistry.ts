import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChemistryEvent {
  id: string;
  band_id: string;
  event_type: string;
  chemistry_change: number;
  event_data: any;
  created_at: string;
}

export interface BandMemberChemistry {
  id: string;
  user_id: string | null;
  instrument_role: string;
  vocal_role: string | null;
  chemistry_contribution: number;
  can_be_leader: boolean;
  leadership_votes: number;
  is_touring_member: boolean;
  member_status: string;
}

export const useBandChemistry = (bandId?: string) => {
  // Fetch band chemistry level
  const { data: band, isLoading: bandLoading } = useQuery({
    queryKey: ["band-chemistry", bandId],
    queryFn: async () => {
      if (!bandId) return null;

      const { data, error } = await supabase
        .from("bands")
        .select("chemistry_level, cohesion_score, days_together, last_chemistry_update")
        .eq("id", bandId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!bandId,
  });

  // Fetch chemistry events
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["band-chemistry-events", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await supabase
        .from("band_chemistry_events")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ChemistryEvent[];
    },
    enabled: !!bandId,
  });

  // Fetch band members with chemistry contributions
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["band-members-chemistry", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await supabase
        .from("band_members")
        .select("*")
        .eq("band_id", bandId)
        .order("chemistry_contribution", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as BandMemberChemistry[];
    },
    enabled: !!bandId,
  });

  // Calculate chemistry breakdown
  const chemistryBreakdown = {
    excellent: events.filter((e) => e.chemistry_change > 5).length,
    good: events.filter((e) => e.chemistry_change > 0 && e.chemistry_change <= 5).length,
    neutral: events.filter((e) => e.chemistry_change === 0).length,
    poor: events.filter((e) => e.chemistry_change < 0 && e.chemistry_change >= -5).length,
    terrible: events.filter((e) => e.chemistry_change < -5).length,
  };

  return {
    band,
    events,
    members,
    chemistryBreakdown,
    isLoading: bandLoading || eventsLoading || membersLoading,
  };
};
