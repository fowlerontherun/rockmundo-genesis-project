import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { useState } from "react";

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
  completed_at?: string | null;
  total_xp_awarded?: number;
  mood_score?: number;
  synergy_score?: number;
  gifted_song_id?: string | null;
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

export interface JamSessionResults {
  session_id: string;
  total_xp_awarded: number;
  duration_minutes: number;
  synergy_score: number;
  mood_score: number;
  gifted_song_id: string | null;
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

export const useJamSessions = () => {
  const { user } = useAuth();
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
  });

  const { data: myOutcomes = [] } = useQuery({
    queryKey: ["jam-session-outcomes", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      
      if (!profile) return [];

      const { data, error } = await supabase
        .from("jam_session_outcomes")
        .select("*")
        .eq("participant_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as JamSessionOutcome[];
    },
    enabled: !!user?.id,
  });

  const startSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("jam_sessions")
        .update({ 
          status: "active",
          started_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jam-sessions"] });
      toast({
        title: "Session started!",
        description: "The jam session is now in progress.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to start session",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeSessionMutation = useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string; participants: string[] }) => {
      const { data, error } = await supabase.functions.invoke('complete-jam-session', {
        body: { session_id: sessionId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data as JamSessionResults;
    },
    onSuccess: (data) => {
      setLastResults(data);
      queryClient.invalidateQueries({ queryKey: ["jam-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["jam-session-outcomes"] });
      toast({
        title: "Session complete!",
        description: `${data.total_xp_awarded} XP awarded to all participants!`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to complete session",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activeSessions = sessions?.filter(s => s.status === "waiting" || s.status === "active") || [];
  const completedSessions = sessions?.filter(s => s.status === "completed") || [];

  return {
    sessions,
    activeSessions,
    completedSessions,
    myOutcomes,
    isLoading,
    startSession: startSessionMutation.mutate,
    completeSession: completeSessionMutation.mutate,
    isStarting: startSessionMutation.isPending,
    isCompleting: completeSessionMutation.isPending,
    lastResults,
    clearResults: () => setLastResults(null),
  };
};
