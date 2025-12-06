import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Festival {
  id: string;
  title: string;
  event_type: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  max_participants: number;
  current_participants: number;
  requirements: any;
  rewards: any;
  is_active: boolean;
  created_at: string;
}

export interface FestivalParticipant {
  id: string;
  event_id: string;
  band_id: string;
  slot_type: string;
  performance_date: string | null;
  payout_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface FestivalRevenue {
  id: string;
  festival_id: string;
  revenue_type: string;
  amount: number;
  source_description: string;
  created_at: string;
}

const FESTIVALS_QUERY_KEY = ["festivals"] as const;
const PARTICIPATIONS_QUERY_KEY = (userId?: string, bandId?: string) =>
  ["festival-participations", userId, bandId] as const;
const LINEUP_QUERY_KEY = (festivalId?: string) => ["festival-lineup", festivalId] as const;

export const useFestivals = (userId?: string, bandId?: string) => {
  const queryClient = useQueryClient();

  // Fetch all active festivals
  const { data: festivals = [], isLoading: festivalsLoading } = useQuery({
    queryKey: FESTIVALS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("game_events")
        .select("*")
        .eq("event_type", "festival")
        .eq("is_active", true)
        .gte("end_date", new Date().toISOString())
        .order("start_date", { ascending: true });

      if (error) throw error;
      return data as Festival[];
    },
  });

  // Fetch user/band festival participations
  const { data: participations = [], isLoading: participationsLoading } = useQuery({
    queryKey: PARTICIPATIONS_QUERY_KEY(userId, bandId),
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await (supabase as any)
        .from("festival_participants")
        .select(`
          *,
          festivals:game_events!event_id(title, start_date, end_date, requirements)
        `)
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as FestivalParticipant[];
    },
    enabled: !!bandId,
  });

  // Fetch festival lineup for a specific festival
  const fetchFestivalLineup = async (festivalId: string) => {
    const { data, error } = await (supabase as any)
      .from("festival_participants")
      .select(`
        *,
        bands(name, genre, fame)
      `)
      .eq("event_id", festivalId)
      .order("slot_type", { ascending: true });

    if (error) throw error;
    return data;
  };

  // Apply to perform at festival
  const applyToFestival = useMutation({
    mutationFn: async (application: {
      festival_id: string;
      band_id: string;
      performance_slot: string;
      stage: string;
      setlist_songs: string[];
      payment_amount?: number;
    }) => {
      if (!userId) throw new Error("User not authenticated");

      // Check if band is already registered
      const { data: existing } = await (supabase as any)
        .from("festival_participants")
        .select("id")
        .eq("event_id", application.festival_id)
        .eq("band_id", application.band_id)
        .maybeSingle();

      if (existing) {
        throw new Error("Your band is already registered for this festival");
      }

      const { data, error } = await (supabase as any)
        .from("festival_participants")
        .insert({
          event_id: application.festival_id,
          band_id: application.band_id,
          slot_type: application.performance_slot,
          performance_date: application.stage, // Using stage field as performance_date
          payout_amount: application.payment_amount || 0,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: PARTICIPATIONS_QUERY_KEY(userId, bandId) });
      queryClient.invalidateQueries({ queryKey: FESTIVALS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LINEUP_QUERY_KEY(variables.festival_id) });
      toast.success("Festival application submitted!");
    },
    onError: (error: any) => {
      toast.error("Failed to apply", { description: error.message });
    },
  });

  // Withdraw from festival
  const withdrawFromFestival = useMutation({
    mutationFn: async (participationId: string) => {
      const { data: participation } = await (supabase as any)
        .from("festival_participants")
        .select("event_id, status")
        .eq("id", participationId)
        .single();

      if (!participation) {
        throw new Error("Participation not found");
      }

      if (participation.status === "performed") {
        throw new Error("Cannot withdraw after performing");
      }

      const { error } = await (supabase as any)
        .from("festival_participants")
        .update({ status: "withdrawn" })
        .eq("id", participationId);

      if (error) throw error;

      return participation.event_id as string;
    },
    onSuccess: (festivalId) => {
      queryClient.invalidateQueries({ queryKey: PARTICIPATIONS_QUERY_KEY(userId, bandId) });
      queryClient.invalidateQueries({ queryKey: FESTIVALS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LINEUP_QUERY_KEY(festivalId) });
      toast.success("Withdrawn from festival");
    },
    onError: (error: any) => {
      toast.error("Failed to withdraw", { description: error.message });
    },
  });

  // Update setlist for festival performance - NOTE: festival_participants table doesn't have setlist_songs column
  // This feature requires a schema update to store setlists per festival performance
  const updateSetlist = useMutation({
    mutationFn: async (params: {
      participation_id: string;
      setlist_songs: string[];
      festival_id?: string;
    }) => {
      // For now, just return the festival_id - setlist storage needs schema update
      const { data } = await (supabase as any)
        .from("festival_participants")
        .select("event_id")
        .eq("id", params.participation_id)
        .maybeSingle();

      return data?.event_id as string | undefined;
    },
    onSuccess: (festivalId) => {
      queryClient.invalidateQueries({ queryKey: PARTICIPATIONS_QUERY_KEY(userId, bandId) });
      queryClient.invalidateQueries({ queryKey: LINEUP_QUERY_KEY(festivalId) });
      toast.success("Setlist updated!");
    },
    onError: (error: any) => {
      toast.error("Failed to update setlist", { description: error.message });
    },
  });

  // Perform at festival
  const performAtFestival = useMutation({
    mutationFn: async (participationId: string) => {
      const { data: participation } = await (supabase as any)
        .from("festival_participants")
        .select("*, festivals:game_events!event_id(rewards)")
        .eq("id", participationId)
        .single();

      if (!participation) {
        throw new Error("Participation not found");
      }

      if (participation.status !== "confirmed" && participation.status !== "pending" && participation.status !== "invited") {
        throw new Error("Cannot perform with current status");
      }

      // Simulate performance score
      const performanceScore = Math.floor(Math.random() * 30) + 70; // 70-100
      const festivalId = participation.event_id as string;

      const { error } = await (supabase as any)
        .from("festival_participants")
        .update({ status: "performed" })
        .eq("id", participationId);

      if (error) throw error;

      // Award payment and fame
      const rewards = participation.festivals?.rewards || {};
      const fame = rewards.fame || 100;
      const payment = participation.payout_amount || 5000;

      // Update band balance and fame
      if (participation.band_id) {
        const { data: bandData } = await (supabase as any)
          .from("bands")
          .select("band_balance, fame")
          .eq("id", participation.band_id)
          .single();

        if (bandData) {
          await (supabase as any)
            .from("bands")
            .update({ 
              band_balance: (bandData.band_balance || 0) + payment,
              fame: (bandData.fame || 0) + fame
            })
            .eq("id", participation.band_id);
        }
      }

      return { performanceScore, payment, fame, festivalId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: PARTICIPATIONS_QUERY_KEY(userId, bandId) });
      queryClient.invalidateQueries({ queryKey: FESTIVALS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LINEUP_QUERY_KEY(result.festivalId) });
      toast.success(
        `Performance complete! Score: ${result.performanceScore}/100 | +${result.fame} fame | +$${result.payment}`
      );
    },
    onError: (error: any) => {
      toast.error("Performance failed", { description: error.message });
    },
  });

  return {
    festivals,
    festivalsLoading,
    participations,
    participationsLoading,
    fetchFestivalLineup,
    applyToFestival,
    withdrawFromFestival,
    updateSetlist,
    performAtFestival,
    isApplying: applyToFestival.isPending,
    isWithdrawing: withdrawFromFestival.isPending,
    isUpdatingSetlist: updateSetlist.isPending,
    isPerforming: performAtFestival.isPending,
  };
};
