import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";

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
  skill_improvement: number;
  gifted_song_id: string | null;
  performance_rating: number;
  created_at: string;
}

export const useJamSessions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const startSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from("jam_sessions")
        .update({ 
          status: "active",
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
      // Update session status
      const { error: sessionError } = await supabase
        .from("jam_sessions")
        .update({ 
          status: "completed",
        })
        .eq("id", sessionId);

      if (sessionError) throw sessionError;
      return { totalXp: 50 };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jam-sessions"] });
      toast({
        title: "Session complete!",
        description: "The jam session has ended.",
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
    myOutcomes: [] as JamSessionOutcome[],
    isLoading,
    startSession: startSessionMutation.mutate,
    completeSession: completeSessionMutation.mutate,
    isStarting: startSessionMutation.isPending,
    isCompleting: completeSessionMutation.isPending,
  };
};
