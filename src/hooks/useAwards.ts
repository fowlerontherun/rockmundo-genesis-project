import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AwardShow {
  id: string;
  show_name: string;
  year: number;
  venue: string;
  district: string;
  overview: string;
  schedule: any;
  categories: any[];
  voting_breakdown: any;
  rewards: any;
  performance_slots: any[];
  broadcast_partners: string[];
  status: string;
  created_at: string;
}

export interface AwardNomination {
  id: string;
  award_show_id: string;
  category_name: string;
  nominee_type: string;
  nominee_id: string;
  nominee_name: string;
  band_id: string | null;
  user_id: string;
  submission_data: any;
  status: string;
  vote_count: number;
  created_at: string;
}

export interface AwardWin {
  id: string;
  award_show_id: string;
  category_name: string;
  winner_name: string;
  band_id: string | null;
  user_id: string;
  fame_boost: number;
  prize_money: number;
  won_at: string;
}

export const useAwards = (userId?: string, bandId?: string) => {
  const queryClient = useQueryClient();

  // Fetch all award shows
  const { data: shows = [], isLoading: showsLoading } = useQuery({
    queryKey: ["award-shows"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("award_shows")
        .select("*")
        .order("year", { ascending: false });

      if (error) throw error;
      return data as AwardShow[];
    },
  });

  // Fetch user/band nominations
  const { data: nominations = [], isLoading: nominationsLoading } = useQuery({
    queryKey: ["award-nominations", userId, bandId],
    queryFn: async () => {
      if (!userId) return [];

      let query = (supabase as any)
        .from("award_nominations")
        .select("*")
        .eq("user_id", userId);

      if (bandId) {
        query = query.eq("band_id", bandId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data as AwardNomination[];
    },
    enabled: !!userId,
  });

  // Fetch user/band wins
  const { data: wins = [], isLoading: winsLoading } = useQuery({
    queryKey: ["award-wins", userId, bandId],
    queryFn: async () => {
      if (!userId) return [];

      let query = (supabase as any)
        .from("award_wins")
        .select("*")
        .eq("user_id", userId);

      if (bandId) {
        query = query.eq("band_id", bandId);
      }

      const { data, error } = await query.order("won_at", { ascending: false });

      if (error) throw error;
      return data as AwardWin[];
    },
    enabled: !!userId,
  });

  // Fetch nominations for a specific show
  const fetchShowNominations = async (showId: string) => {
    const { data, error } = await (supabase as any)
      .from("award_nominations")
      .select("*")
      .eq("award_show_id", showId)
      .order("vote_count", { ascending: false });

    if (error) throw error;
    return data as AwardNomination[];
  };

  const fetchVoteCountForShow = async (showId: string) => {
    if (!userId) return 0;

    const { data: nominations, error: nominationsError } = await (supabase as any)
      .from("award_nominations")
      .select("id")
      .eq("award_show_id", showId);

    if (nominationsError) throw nominationsError;

    const nominationIds = (nominations || []).map((nomination: { id: string }) => nomination.id);
    if (nominationIds.length === 0) return 0;

    const { count, error } = await (supabase as any)
      .from("award_votes")
      .select("id", { count: "exact", head: true })
      .eq("voter_id", userId)
      .in("nomination_id", nominationIds);

    if (error) throw error;
    return count || 0;
  };

  // Submit nomination
  const submitNomination = useMutation({
    mutationFn: async (nomination: {
      award_show_id: string;
      category_name: string;
      nominee_type: string;
      nominee_id: string;
      nominee_name: string;
      band_id?: string;
      submission_data?: any;
    }) => {
      if (!userId) throw new Error("User not authenticated");

      const { data, error } = await (supabase as any)
        .from("award_nominations")
        .insert({
          ...nomination,
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-nominations"] });
      toast.success("Nomination submitted successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to submit nomination", { description: error.message });
    },
  });

  // Cast vote
  const castVote = useMutation({
    mutationFn: async (params: {
      nomination_id: string;
      show_id: string;
      weight?: number;
    }) => {
      if (!userId) throw new Error("User not authenticated");

      const { data, error } = await (supabase as any)
        .from("award_votes")
        .insert({
          nomination_id: params.nomination_id,
          voter_type: "player",
          voter_id: userId,
          weight: params.weight || 1.0,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("You have already voted for this nomination");
        }
        throw error;
      }
      return data;
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ["award-show-nominations", params.show_id] });

      const voteCountKey = ["award-show-vote-count", params.show_id, userId];
      const previousNominations = queryClient.getQueryData<AwardNomination[]>(["award-show-nominations", params.show_id]);
      const previousVoteCount = queryClient.getQueryData<number>(voteCountKey);

      if (previousNominations) {
        const updatedNominations = previousNominations.map((nomination) =>
          nomination.id === params.nomination_id
            ? { ...nomination, vote_count: (nomination.vote_count || 0) + 1 }
            : nomination
        );
        queryClient.setQueryData(["award-show-nominations", params.show_id], updatedNominations);
      }

      if (typeof previousVoteCount === "number") {
        queryClient.setQueryData(voteCountKey, Math.min(previousVoteCount + 1, 5));
      }

      return { previousNominations, previousVoteCount, showId: params.show_id };
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: ["award-nominations"] });
      queryClient.invalidateQueries({ queryKey: ["award-show-nominations", params.show_id] });
      queryClient.invalidateQueries({ queryKey: ["award-show-vote-count", params.show_id, userId] });
      toast.success("Vote cast successfully!");
    },
    onError: (error: any, params, context) => {
      if (context?.previousNominations) {
        queryClient.setQueryData(
          ["award-show-nominations", context.showId],
          context.previousNominations
        );
      }

      if (typeof context?.previousVoteCount === "number") {
        queryClient.setQueryData(
          ["award-show-vote-count", context.showId, userId],
          context.previousVoteCount
        );
      }

      toast.error("Failed to cast vote", { description: error.message });
    },
    onSettled: (_data, _error, params) => {
      queryClient.invalidateQueries({ queryKey: ["award-show-nominations", params.show_id] });
      queryClient.invalidateQueries({ queryKey: ["award-show-vote-count", params.show_id, userId] });
    },
  });

  // Book performance slot
  const bookPerformance = useMutation({
    mutationFn: async (booking: {
      award_show_id: string;
      band_id: string;
      slot_label: string;
      stage: string;
      song_ids: string[];
      rehearsal_scheduled?: string;
    }) => {
      if (!userId) throw new Error("User not authenticated");

      const { data, error } = await (supabase as any)
        .from("award_performance_bookings")
        .insert({
          ...booking,
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("This performance slot is already booked");
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-performance-bookings"] });
      toast.success("Performance slot booked!");
    },
    onError: (error: any) => {
      toast.error("Failed to book performance", { description: error.message });
    },
  });

  // Attend red carpet
  const attendRedCarpet = useMutation({
    mutationFn: async (attendance: {
      award_show_id: string;
      outfit_choice: string;
      participant_type: "user" | "band";
    }) => {
      if (!userId) throw new Error("User not authenticated");

      // Calculate fame gain based on outfit choice
      const fameGain = attendance.outfit_choice === "designer" ? 50 : 
                       attendance.outfit_choice === "custom" ? 75 : 25;

      const { data, error } = await (supabase as any)
        .from("award_red_carpet_events")
        .insert({
          award_show_id: attendance.award_show_id,
          participant_id: userId,
          participant_type: attendance.participant_type,
          outfit_choice: attendance.outfit_choice,
          fame_gain: fameGain,
          media_interactions: Math.floor(Math.random() * 10) + 5,
        })
        .select()
        .single();

      if (error) throw error;

      // Update user fame (skip if function doesn't exist yet)
      try {
        await (supabase as any).rpc("increment_user_fame", {
          p_user_id: userId,
          p_amount: fameGain,
        });
      } catch (e) {
        console.warn("Fame increment function not available");
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["award-red-carpet"] });
      toast.success(`Red carpet appearance complete! +${data.fame_gain} fame`);
    },
    onError: (error: any) => {
      toast.error("Failed to attend red carpet", { description: error.message });
    },
  });

  return {
    shows,
    showsLoading,
    nominations,
    nominationsLoading,
    wins,
    winsLoading,
    fetchShowNominations,
    fetchVoteCountForShow,
    submitNomination: submitNomination.mutate,
    castVote: castVote.mutate,
    bookPerformance: bookPerformance.mutate,
    attendRedCarpet: attendRedCarpet.mutate,
    isSubmitting: submitNomination.isPending,
    isVoting: castVote.isPending,
    isBooking: bookPerformance.isPending,
    isAttending: attendRedCarpet.isPending,
  };
};
