import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";

export interface BehaviorSettings {
  id: string;
  user_id: string;
  travel_comfort: "budget" | "standard" | "luxury";
  hotel_standard: "hostel" | "budget" | "standard" | "luxury" | "suite";
  partying_intensity: "abstinent" | "light" | "moderate" | "heavy" | "legendary";
  fan_interaction: "distant" | "professional" | "friendly" | "wild";
  media_behavior: "reclusive" | "professional" | "outspoken" | "controversial";
  afterparty_attendance: "never" | "sometimes" | "always";
  entourage_size: "solo" | "small" | "medium" | "large";
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: Omit<BehaviorSettings, "id" | "user_id" | "created_at" | "updated_at"> = {
  travel_comfort: "standard",
  hotel_standard: "standard",
  partying_intensity: "moderate",
  fan_interaction: "friendly",
  media_behavior: "professional",
  afterparty_attendance: "sometimes",
  entourage_size: "small",
};

// Risk score calculation weights
const RISK_WEIGHTS = {
  partying_intensity: {
    abstinent: 0,
    light: 10,
    moderate: 25,
    heavy: 60,
    legendary: 100,
  },
  fan_interaction: {
    distant: 0,
    professional: 10,
    friendly: 30,
    wild: 80,
  },
  media_behavior: {
    reclusive: 0,
    professional: 10,
    outspoken: 40,
    controversial: 90,
  },
  hotel_standard: {
    suite: 0,
    luxury: 5,
    standard: 15,
    budget: 30,
    hostel: 50,
  },
  afterparty_attendance: {
    never: 0,
    sometimes: 25,
    always: 60,
  },
};

// Health modifier calculation
export const getHealthModifiers = (settings: Partial<BehaviorSettings>) => {
  let recoveryModifier = 0;
  let restEffectiveness = 0;

  // Partying affects recovery rate
  switch (settings.partying_intensity) {
    case "abstinent": recoveryModifier = 5; break;
    case "light": recoveryModifier = 0; break;
    case "moderate": recoveryModifier = -5; break;
    case "heavy": recoveryModifier = -15; break;
    case "legendary": recoveryModifier = -25; break;
  }

  // Hotel affects rest effectiveness
  switch (settings.hotel_standard) {
    case "hostel": restEffectiveness = -10; break;
    case "budget": restEffectiveness = -5; break;
    case "standard": restEffectiveness = 0; break;
    case "luxury": restEffectiveness = 10; break;
    case "suite": restEffectiveness = 20; break;
  }

  return { recoveryModifier, restEffectiveness };
};

export const calculateRiskScore = (settings: Partial<BehaviorSettings>): number => {
  const partyRisk = RISK_WEIGHTS.partying_intensity[settings.partying_intensity || "moderate"];
  const fanRisk = RISK_WEIGHTS.fan_interaction[settings.fan_interaction || "friendly"];
  const mediaRisk = RISK_WEIGHTS.media_behavior[settings.media_behavior || "professional"];
  const hotelRisk = RISK_WEIGHTS.hotel_standard[settings.hotel_standard || "standard"];
  const afterpartyRisk = RISK_WEIGHTS.afterparty_attendance[settings.afterparty_attendance || "sometimes"];

  // Weighted average: partying 35%, fan 20%, media 20%, hotel 10%, afterparty 15%
  return Math.round(
    partyRisk * 0.35 +
    fanRisk * 0.20 +
    mediaRisk * 0.20 +
    hotelRisk * 0.10 +
    afterpartyRisk * 0.15
  );
};

export const getRiskLevel = (score: number): { label: string; color: string; description: string } => {
  if (score <= 20) {
    return {
      label: "Low Risk",
      color: "text-green-500",
      description: "Safe and steady. Lower chance of dramatic events but also less wild stories.",
    };
  } else if (score <= 45) {
    return {
      label: "Moderate Risk",
      color: "text-yellow-500",
      description: "Balanced lifestyle. A mix of stability and occasional excitement.",
    };
  } else if (score <= 70) {
    return {
      label: "High Risk",
      color: "text-orange-500",
      description: "Living on the edge. More fame but also more health and reputation risks.",
    };
  } else {
    return {
      label: "Legendary",
      color: "text-red-500",
      description: "True rock star lifestyle. Maximum fame potential but expect health consequences.",
    };
  }
};

export function useBehaviorSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["behavior-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("player_behavior_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      // If no settings exist, create default ones
      if (!data) {
        const { data: newData, error: insertError } = await supabase
          .from("player_behavior_settings")
          .insert({ user_id: user.id, ...DEFAULT_SETTINGS })
          .select()
          .single();

        if (insertError) throw insertError;
        return newData as BehaviorSettings;
      }

      return data as BehaviorSettings;
    },
    enabled: !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<BehaviorSettings>) => {
      if (!user?.id || !settings?.id) throw new Error("No user or settings");

      const { data, error } = await supabase
        .from("player_behavior_settings")
        .update(updates)
        .eq("id", settings.id)
        .select()
        .single();

      if (error) throw error;
      return data as BehaviorSettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["behavior-settings", user?.id], data);
      toast.success("Lifestyle settings updated");
    },
    onError: (error) => {
      toast.error("Failed to update settings: " + error.message);
    },
  });

  const riskScore = settings ? calculateRiskScore(settings) : 0;
  const riskLevel = getRiskLevel(riskScore);
  const healthModifiers = settings ? getHealthModifiers(settings) : { recoveryModifier: 0, restEffectiveness: 0 };

  return {
    settings,
    isLoading,
    error,
    updateSettings: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    riskScore,
    riskLevel,
    healthModifiers,
  };
}
