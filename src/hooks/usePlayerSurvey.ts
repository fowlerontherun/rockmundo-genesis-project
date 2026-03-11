import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { awardSpecialXp } from "@/utils/progression";
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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch survey config
  const { data: surveyConfig } = useQuery<SurveyConfig | null>({
    queryKey: ["survey-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("game_config")
        .select("config_value")
        .eq("config_key", "player_survey_enabled")
        .maybeSingle();
      if (!data?.config_value) return null;
      const val = typeof data.config_value === "string"
        ? JSON.parse(data.config_value)
        : data.config_value;
      return val as SurveyConfig;
    },
  });

  // Check if player already completed current round
  const { data: hasCompleted } = useQuery({
    queryKey: ["survey-completion", user?.id, surveyConfig?.round],
    enabled: !!user && !!surveyConfig?.round,
    queryFn: async () => {
      const { data } = await supabase
        .from("player_survey_completions")
        .select("id")
        .eq("user_id", user!.id)
        .eq("survey_round", surveyConfig!.round)
        .maybeSingle();
      return !!data;
    },
  });

  // Should show survey?
  const shouldShowSurvey = !!(
    surveyConfig?.enabled &&
    user &&
    hasCompleted === false
  );

  // Fetch random questions for this session
  const { data: questions } = useQuery<SurveyQuestion[]>({
    queryKey: ["survey-questions", surveyConfig?.round],
    enabled: shouldShowSurvey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_survey_questions")
        .select("id, category, question_text, question_type, options, display_order")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      // Shuffle and pick N
      const count = surveyConfig?.questions_per_session ?? 10;
      const shuffled = (data || []).sort(() => Math.random() - 0.5);
      return shuffled.slice(0, count) as SurveyQuestion[];
    },
    staleTime: Infinity, // Don't re-shuffle on refocus
  });

  // Submit all answers + claim reward
  const submitMutation = useMutation({
    mutationFn: async (answers: { questionId: string; answerValue: string; answerNumeric?: number }[]) => {
      if (!user || !surveyConfig) throw new Error("Not ready");

      // Get profile_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileId = profile?.id ?? null;
      const round = surveyConfig.round;

      // Insert responses
      const rows = answers.map((a) => ({
        user_id: user.id,
        profile_id: profileId,
        question_id: a.questionId,
        survey_round: round,
        answer_value: a.answerValue,
        answer_numeric: a.answerNumeric ?? null,
      }));

      const { error: respError } = await supabase
        .from("player_survey_responses")
        .upsert(rows, { onConflict: "user_id,question_id,survey_round" });
      if (respError) throw respError;

      // Award XP
      try {
        await awardSpecialXp({ amount: 250, reason: "survey_completion" });
      } catch (e) {
        console.warn("XP award failed (may have already been awarded):", e);
      }

      // Award attribute points via wallet update
      const { error: walletError } = await supabase.rpc("increment_wallet_field" as any, {
        p_user_id: user.id,
        p_field: "attribute_points_balance",
        p_amount: 25,
      });
      // If RPC doesn't exist, try direct update
      if (walletError) {
        await supabase
          .from("player_xp_wallet")
          .update({
            attribute_points_balance: supabase.rpc("" as any) // fallback below
          })
          .eq("user_id", user.id);
        // Direct SQL fallback - just update with raw increment
        const { data: wallet } = await supabase
          .from("player_xp_wallet")
          .select("attribute_points_balance, attribute_points_lifetime")
          .eq("user_id", user.id)
          .maybeSingle();
        if (wallet) {
          await supabase
            .from("player_xp_wallet")
            .update({
              attribute_points_balance: (wallet.attribute_points_balance || 0) + 25,
              attribute_points_lifetime: (wallet.attribute_points_lifetime || 0) + 25,
            })
            .eq("user_id", user.id);
        }
      }

      // Record completion
      const { error: compError } = await supabase
        .from("player_survey_completions")
        .insert({
          user_id: user.id,
          profile_id: profileId,
          survey_round: round,
          xp_awarded: 250,
          attribute_points_awarded: 25,
        });
      if (compError) throw compError;
    },
    onSuccess: () => {
      toast({
        title: "Survey Complete! 🎉",
        description: "You earned 250 XP and 25 Attribute Points!",
      });
      queryClient.invalidateQueries({ queryKey: ["survey-completion"] });
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
