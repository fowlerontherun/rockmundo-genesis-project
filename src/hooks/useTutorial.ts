import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

interface TutorialStep {
  id: string;
  step_key: string;
  title: string;
  description: string;
  target_element: string | null;
  target_route: string | null;
  order_index: number;
  category: string;
  is_active: boolean;
}

interface TutorialProgress {
  step_key: string;
  completed_at: string;
}

export const useTutorial = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all active tutorial steps
  const { data: steps = [] } = useQuery({
    queryKey: ["tutorial-steps-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorial_steps")
        .select("*")
        .eq("is_active", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as TutorialStep[];
    },
  });

  // Fetch user's completed steps
  const { data: progress = [] } = useQuery({
    queryKey: ["tutorial-progress", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("player_tutorial_progress")
        .select("step_key, completed_at")
        .eq("user_id", user.id);
      if (error) throw error;
      return data as TutorialProgress[];
    },
    enabled: !!user,
  });

  // Mark step as complete
  const completeMutation = useMutation({
    mutationFn: async (stepKey: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("player_tutorial_progress")
        .insert({ user_id: user.id, step_key: stepKey });
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tutorial-progress", user?.id] });
    },
  });

  const completedStepKeys = new Set(progress.map(p => p.step_key));
  
  const incompleteSteps = steps.filter(s => !completedStepKeys.has(s.step_key));
  const completedSteps = steps.filter(s => completedStepKeys.has(s.step_key));
  
  const currentStep = incompleteSteps[0] || null;
  const progressPercent = steps.length > 0 
    ? Math.round((completedSteps.length / steps.length) * 100)
    : 100;

  const isStepCompleted = (stepKey: string) => completedStepKeys.has(stepKey);
  
  const completeStep = (stepKey: string) => {
    if (!isStepCompleted(stepKey)) {
      completeMutation.mutate(stepKey);
    }
  };

  const getStepForRoute = (route: string) => {
    return incompleteSteps.find(s => s.target_route === route);
  };

  return {
    steps,
    incompleteSteps,
    completedSteps,
    currentStep,
    progressPercent,
    isStepCompleted,
    completeStep,
    getStepForRoute,
    isLoading: completeMutation.isPending,
  };
};

export const useGameBalance = () => {
  const { data: configs = [] } = useQuery({
    queryKey: ["game-balance-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_balance_config")
        .select("key, value");
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const getConfig = (key: string, defaultValue: number = 0): number => {
    const config = configs.find(c => c.key === key);
    return config?.value ?? defaultValue;
  };

  return { configs, getConfig };
};