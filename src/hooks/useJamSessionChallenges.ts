import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface JamSessionChallenge {
  id: string;
  name: string;
  description: string;
  genre_requirement: string | null;
  min_participants: number;
  difficulty: "easy" | "medium" | "hard" | "legendary";
  xp_bonus_pct: number;
  requirements: Record<string, any>;
  rewards: Record<string, any>;
}

const DIFFICULTY_COLORS = {
  easy: "bg-green-500/20 text-green-600",
  medium: "bg-yellow-500/20 text-yellow-600",
  hard: "bg-orange-500/20 text-orange-600",
  legendary: "bg-purple-500/20 text-purple-600",
};

export const useJamSessionChallenges = () => {
  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ["jam-session-challenges"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("jam_session_challenges")
        .select("*")
        .eq("is_active", true)
        .order("difficulty");

      if (error) throw error;
      return (data || []) as JamSessionChallenge[];
    },
  });

  return { challenges, isLoading, DIFFICULTY_COLORS };
};
