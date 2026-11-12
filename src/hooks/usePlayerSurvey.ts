import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import type { SurveyAnswers } from "@/lib/playerSurvey";
import { useToast } from "@/hooks/use-toast";

export interface SurveyQuestion {
  id: string;
  category: string;
  question_text: string;
  question_type: "rating_1_5" | "multiple_choice" | "yes_no" | "free_text";
  options: string[] | null;
  display_order: number;
}

export interface SurveyConfig {
  enabled: boolean;
  round: string;
  questions_per_session: number;
}

export function usePlayerSurvey() {
  const { profileId, userId } = useActiveProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch survey config
  const { data: surveyConfig, isSuccess: configLoaded } = useQuery<SurveyConfig | null>({
    queryKey: ["survey-config"],
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_config")
        .select("config_value")
        .eq("config_key", "player_survey_enabled")
        .maybeSingle();
      if (error) {
        console.error("Survey config fetch error:", error);
        return null;
      }
      if (!data?.config_value) return null;
      try {
        const val = typeof data.config_value === "string"
          ? JSON.parse(data.config_value)
          : data.config_value;
        // Ensure required fields have defaults
        return {
          enabled: val.enabled ?? false,
          round: val.round || "2026-03",
          questions_per_session: val.questions_per_session || 10,
        } as SurveyConfig;
      } catch (e) {
        console.error("Survey config parse error:", e);
        return null;
      }
    },
  });

  // Check if player already completed current round
  const { data: hasCompleted, isSuccess: completionChecked } = useQuery({
    queryKey: ["survey-completion", userId, surveyConfig?.round],
    enabled: !!userId && !!surveyConfig?.enabled && !!surveyConfig?.round,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_survey_completions")
        .select("id")
        .eq("user_id", userId!)
        .eq("survey_round", surveyConfig!.round)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  // Should show survey? Only after both queries have resolved
  const shouldShowSurvey = !!(
    configLoaded &&
    completionChecked &&
    surveyConfig?.enabled &&
    userId &&
    profileId &&
    hasCompleted === false
  );

  const { data: questions } = useQuery<SurveyQuestion[]>({
    queryKey: ["survey-questions", userId, surveyConfig?.round, surveyConfig?.questions_per_session],
    enabled: shouldShowSurvey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_player_survey_questions", { p_round: surveyConfig!.round });
      if (error) throw error;
      return data as SurveyQuestion[];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (answers: SurveyAnswers) => {
      if (!userId || !profileId || !surveyConfig) throw new Error("The survey is still loading.");

      const { data, error } = await supabase.rpc("submit_player_survey", {
        p_round: surveyConfig.round,
        p_profile_id: profileId,
        p_answers: answers,
      });
      if (error) throw new Error(error.message);
      return data as { already_completed: true } | { already_completed: false; xp: number; ap: number };
    },
    onSuccess: (result) => {
      toast("xp" in result
        ? {
          title: "Survey complete",
          description: `You earned ${result.xp.toLocaleString()} XP and ${result.ap} Attribute Points. Thank you for your feedback!`,
        }
        : { title: "Survey already completed" });
      queryClient.setQueryData(["survey-completion", userId, surveyConfig?.round], true);
    },
    onError: (err) => {
      toast({
        title: "Survey Error",
        description: err instanceof Error ? err.message : "Failed to submit survey",
        variant: "destructive",
      });
    },
  });

  return {
    shouldShowSurvey,
    questions: questions || [],
    surveyConfig,
    submitSurvey: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
  };
}
