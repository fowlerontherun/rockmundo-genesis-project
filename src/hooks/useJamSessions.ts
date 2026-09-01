import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export interface JamSession {
  id: string;
  host_id: string;
  name: string;
  description: string | null;
  genre: string;
  tempo: number;
  max_participants: number;
  current_participants: number;
  skill_requirement: number;
  is_private: boolean;
  access_code: string | null;
  status: string;
  started_at?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  completed_at?: string | null;
  finalised_at?: string | null;
  total_xp_awarded?: number;
  mood_score?: number;
  synergy_score?: number;
  gifted_song_id?: string | null;
  engine_version?: number;
  duration_slots?: number;
  slot_minutes?: number;
  venue_trait?: string | null;
  venue_trait_bonus?: unknown;
  challenge_id?: string | null;
  challenge_completed?: boolean;
  rehearsal_room_id?: string | null;
  city_id?: string | null;
  cost_per_participant?: number;
  total_cost?: number;
  created_at: string;
  host?: {
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  participant_ids?: string[];
}

export interface JamSessionOutcome {
  id: string;
  session_id: string;
  participant_id: string;
  xp_earned: number;
  chemistry_gained: number;
  skill_slug: string | null;
  skill_xp_gained: number;
  gifted_song_id: string | null;
  performance_rating: number;
  created_at: string;
}

export interface NpcCameo {
  name: string;
  description: string;
  genre_affinity: string | null;
  buff_type: string;
  buff_value: number;
  rarity: string;
  avatar_emoji: string;
}

export interface JamSessionResults {
  session_id: string;
  total_xp_awarded: number;
  duration_minutes: number;
  synergy_score: number;
  mood_score: number;
  gifted_song_id: string | null;
  npc_cameo: NpcCameo | null;
  outcomes: {
    participant_id: string;
    xp_earned: number;
    skill_slug: string;
    skill_xp_gained: number;
    chemistry_gained: number;
    performance_rating: number;
    received_song: boolean;
  }[];
}

const messageFromError = (error: unknown) => {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");
    const friendly: Record<string, string> = {
      jam_too_early_to_start: "This jam can be started from 15 minutes before its booked time.",
      jam_host_required: "Only the session host can do that.",
      jam_session_not_startable: "This jam session can no longer be started.",
      jam_session_not_cancellable: "This jam session can no longer be cancelled.",
    };
    return friendly[message] ?? message;
  }
  return "The jam session action could not be completed.";
};

export const useJamSessions = () => {
  const { profileId } = useActiveProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lastResults, setLastResults] = useState<JamSessionResults | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["jam-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jam_sessions")
        .select(`
          *,
          host:profiles!jam_sessions_host_id_fkey(user_id, username, display_name, avatar_url)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as JamSession[];
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: myOutcomes = [] } = useQuery({
    queryKey: ["jam-session-outcomes", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("jam_session_outcomes")
        .select("*")
        .eq("participant_id", profileId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as JamSessionOutcome[];
    },
    enabled: !!profileId,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["jam-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["jam-session-workspace"] }),
      queryClient.invalidateQueries({ queryKey: ["jam-session-outcomes"] }),
      queryClient.invalidateQueries({ queryKey: ["profile"] }),
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] }),
    ]);
  };

  const buildResults = async (sessionId: string): Promise<JamSessionResults> => {
    const [{ data: session, error: sessionError }, { data: outcomes, error: outcomesError }] =
      await Promise.all([
        supabase
          .from("jam_sessions")
          .select("id, total_xp_awarded, synergy_score, mood_score, duration_slots, slot_minutes, duration_hours")
          .eq("id", sessionId)
          .single(),
        supabase
          .from("jam_session_outcomes")
          .select("participant_id, xp_earned, skill_slug, skill_xp_gained, chemistry_gained, performance_rating")
          .eq("session_id", sessionId),
      ]);

    if (sessionError) throw sessionError;
    if (outcomesError) throw outcomesError;

    const durationMinutes =
      Number((session as any).duration_slots || 0) * Number((session as any).slot_minutes || 0) ||
      Number((session as any).duration_hours || 0) * 60;

    return {
      session_id: sessionId,
      total_xp_awarded: Number((session as any).total_xp_awarded || 0),
      duration_minutes: durationMinutes,
      synergy_score: Number((session as any).synergy_score || 0),
      mood_score: Number((session as any).mood_score || 0),
      gifted_song_id: null,
      npc_cameo: null,
      outcomes: (outcomes || []).map((outcome: any) => ({
        participant_id: outcome.participant_id,
        xp_earned: Number(outcome.xp_earned || 0),
        skill_slug: outcome.skill_slug || "jam_performance",
        skill_xp_gained: Number(outcome.skill_xp_gained || 0),
        chemistry_gained: Number(outcome.chemistry_gained || 0),
        performance_rating: Number(outcome.performance_rating || 0),
        received_song: false,
      })),
    };
  };

  const startSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await (supabase.rpc as any)("start_jam_session_v2", {
        p_session_id: sessionId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidate();
      toast({
        title: "Jam started",
        description: "The slot engine is now running and will continue even if everyone goes offline.",
      });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to start session", description: messageFromError(error), variant: "destructive" });
    },
  });

  const cancelSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await (supabase.rpc as any)("cancel_jam_session_v2", {
        p_session_id: sessionId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Session cancelled", description: "Jam schedule locks were released safely." });
    },
    onError: (error: unknown) => {
      toast({ title: "Failed to cancel session", description: messageFromError(error), variant: "destructive" });
    },
  });

  const processSessionMutation = useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string; participants?: string[] }) => {
      const { data, error } = await (supabase.rpc as any)("process_jam_session_v2", {
        p_session_id: sessionId,
      });
      if (error) throw error;
      if (data?.status === "completed") return buildResults(sessionId);
      return null;
    },
    onSuccess: async (results) => {
      if (results) setLastResults(results);
      await invalidate();
    },
    onError: (error: unknown) => {
      toast({ title: "Unable to refresh jam progress", description: messageFromError(error), variant: "destructive" });
    },
  });

  const activeSessions = sessions?.filter((session) => ["waiting", "active"].includes(session.status)) || [];
  const completedSessions = sessions?.filter((session) => session.status === "completed") || [];

  return {
    sessions,
    activeSessions,
    completedSessions,
    myOutcomes,
    isLoading,
    startSession: startSessionMutation.mutate,
    completeSession: processSessionMutation.mutate,
    processSession: processSessionMutation.mutate,
    cancelSession: cancelSessionMutation.mutate,
    isStarting: startSessionMutation.isPending,
    isCompleting: processSessionMutation.isPending,
    isCancelling: cancelSessionMutation.isPending,
    lastResults,
    clearResults: () => setLastResults(null),
  };
};
