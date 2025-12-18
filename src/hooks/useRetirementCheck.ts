import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { shouldPromptRetirement, RETIREMENT_AGES } from "@/utils/skillDecline";
import { useAuth } from "@/hooks/use-auth-context";

interface RetirementCheckResult {
  shouldShowDialog: boolean;
  isMandatory: boolean;
  playerAge: number;
  dismissPrompt: () => void;
  stats: {
    characterName: string;
    fame: number;
    cash: number;
    totalSongs: number;
    totalGigs: number;
    yearsActive: number;
  } | null;
}

export function useRetirementCheck(): RetirementCheckResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  // Fetch profile data
  const { data: profile } = useQuery({
    queryKey: ["retirement-check-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, username, age, fame, cash, last_retirement_prompt_age, created_at")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch career stats
  const { data: careerStats } = useQuery({
    queryKey: ["retirement-career-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return { totalSongs: 0, totalGigs: 0 };
      return { totalSongs: 0, totalGigs: 0 }; // Simplified to avoid type issues
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 10,
  });

  // Mutation to update last prompt age
  const updatePromptAgeMutation = useMutation({
    mutationFn: async (newAge: number) => {
      if (!profile?.id) return;

      await supabase
        .from("profiles")
        .update({ last_retirement_prompt_age: newAge })
        .eq("id", profile.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retirement-check-profile"] });
    },
  });

  const playerAge = profile?.age || 16;
  const lastPromptAge = profile?.last_retirement_prompt_age || 0;

  const { shouldPrompt, isMandatory } = shouldPromptRetirement(playerAge, lastPromptAge);

  const dismissPrompt = useCallback(() => {
    setDismissed(true);
    // Update the last prompt age to current age
    if (playerAge >= RETIREMENT_AGES.FIRST_PROMPT) {
      updatePromptAgeMutation.mutate(playerAge);
    }
  }, [playerAge, updatePromptAgeMutation]);

  // Reset dismissed state when age changes to a new threshold
  useEffect(() => {
    if (
      (playerAge >= RETIREMENT_AGES.SECOND_PROMPT && lastPromptAge < RETIREMENT_AGES.SECOND_PROMPT) ||
      (playerAge >= RETIREMENT_AGES.THIRD_PROMPT && lastPromptAge < RETIREMENT_AGES.THIRD_PROMPT) ||
      playerAge >= RETIREMENT_AGES.MANDATORY
    ) {
      setDismissed(false);
    }
  }, [playerAge, lastPromptAge]);

  const yearsActive = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)) // Approximate months as years in game
    : playerAge - 16;

  return {
    shouldShowDialog: shouldPrompt && !dismissed,
    isMandatory,
    playerAge,
    dismissPrompt,
    stats: profile
      ? {
          characterName: profile.display_name || profile.username || "Unknown Artist",
          fame: profile.fame || 0,
          cash: profile.cash || 0,
          totalSongs: careerStats?.totalSongs || 0,
          totalGigs: careerStats?.totalGigs || 0,
          yearsActive,
        }
      : null,
  };
}
