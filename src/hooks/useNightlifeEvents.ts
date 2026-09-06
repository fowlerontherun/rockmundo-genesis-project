import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useBehaviorSettings } from "@/hooks/useBehaviorSettings";
import { toast } from "sonner";
import { getAddictionTypeLabel, type AddictionType } from "@/utils/addictionSystem";
import {
  resolveNightlifeEvent,
  STANCE_CONFIGS,
  type NightlifeStance,
  type NightlifeOutcomeDetail,
} from "@/utils/nightlifeRiskLayer";

export type NightlifeActivityType =
  | "guest_visit"
  | "dj_slot"
  | "bar_crawl"
  | "vip_clubbing"
  | "afterparty"
  | "stance_night";

interface NightlifeOutcome {
  fameGain: number;
  energyCost: number;
  cashSpent: number;
  addictionTriggered: boolean;
  addictionRelapsed?: boolean;
  addictionType?: AddictionType;
  addictionSeverityGain?: number;
  message: string;
  outcomeDetail?: NightlifeOutcomeDetail;
}

const ACTIVITY_PROFILES: Record<Exclude<NightlifeActivityType, "stance_night">, { baseFame: number; energyCost: number; baseCash: number }> = {
  guest_visit: { baseFame: 2, energyCost: 10, baseCash: 20 },
  dj_slot: { baseFame: 8, energyCost: 25, baseCash: 0 },
  bar_crawl: { baseFame: 3, energyCost: 15, baseCash: 30 },
  vip_clubbing: { baseFame: 5, energyCost: 20, baseCash: 50 },
  afterparty: { baseFame: 6, energyCost: 20, baseCash: 40 },
};

const BASE_EXPOSURE: Record<Exclude<NightlifeActivityType, "stance_night">, number> = {
  guest_visit: 2,
  dj_slot: 4,
  bar_crawl: 12,
  vip_clubbing: 8,
  afterparty: 10,
};

export function useNightlifeEvents() {
  const { profileId } = useActiveProfile();
  const { settings } = useBehaviorSettings();
  const queryClient = useQueryClient();
  const [lastOutcomeDetail, setLastOutcomeDetail] = useState<NightlifeOutcomeDetail | null>(null);
  const [lastAddictionWarning, setLastAddictionWarning] = useState<string | null>(null);

  const nightlifeEventMutation = useMutation({
    mutationFn: async ({ activityType, clubName, stance, venueQuality }: {
      activityType: NightlifeActivityType;
      clubName: string;
      stance?: NightlifeStance;
      venueQuality?: number;
    }): Promise<NightlifeOutcome> => {
      if (!profileId) throw new Error("Not authenticated");
      if (!settings) throw new Error("Behavior settings not loaded");

      const { data: playerProfile } = await supabase
        .from("profiles")
        .select("energy, cash, fame")
        .eq("id", profileId)
        .single();
      if (!playerProfile) throw new Error("Profile not found");

      let fameGain: number;
      let energyCost: number;
      let cashSpent: number;
      let addictionRiskMultiplier = 1;
      let outcomeDetail: NightlifeOutcomeDetail | undefined;

      if (activityType === "stance_night" && stance) {
        const stanceConfig = STANCE_CONFIGS[stance];
        const quality = venueQuality ?? 3;
        const outcome = resolveNightlifeEvent({
          stance,
          venueQuality: quality,
          playerFame: playerProfile.fame ?? 0,
          playerEnergy: playerProfile.energy ?? 100,
          playerCash: playerProfile.cash ?? 0,
        });
        fameGain = outcome.fameChange;
        energyCost = Math.abs(outcome.energyChange);
        cashSpent = Math.abs(outcome.cashChange);
        addictionRiskMultiplier = stanceConfig.addictionRiskMultiplier;
        outcomeDetail = outcome;
      } else {
        const profile = ACTIVITY_PROFILES[activityType as Exclude<NightlifeActivityType, "stance_night">];
        const fameVariance = Math.floor(Math.random() * 3) - 1;
        fameGain = Math.max(0, profile.baseFame + fameVariance);
        energyCost = profile.energyCost;
        cashSpent = profile.baseCash;
      }

      if ((playerProfile.energy ?? 100) < energyCost) throw new Error(`Need ${energyCost} energy for this activity`);
      if ((playerProfile.cash ?? 0) < cashSpent) throw new Error(`Need $${cashSpent} to cover costs`);

      let addictionTriggered = false;
      let addictionRelapsed = false;
      let addictionType: AddictionType = "partying";
      let addictionSeverityGain = 0;

      const behaviourIntensity = settings.partying_intensity === "legendary" ? 1.5
        : settings.partying_intensity === "heavy" ? 1.25
          : settings.partying_intensity === "light" ? 0.6
            : 1;
      const baseExposure = activityType === "stance_night"
        ? Math.max(1, Math.round(6 * addictionRiskMultiplier))
        : BASE_EXPOSURE[activityType as Exclude<NightlifeActivityType, "stance_night">];
      const exposureIntensity = Math.max(1, Math.min(30, Math.round(baseExposure * behaviourIntensity)));

      if (exposureIntensity > 1) {
        const { data: exposureData, error: exposureError } = await (supabase as any).rpc("record_addiction_exposure", {
          p_profile_id: profileId,
          p_addiction_type: "partying",
          p_intensity: exposureIntensity,
          p_source: "nightclub",
          p_source_id: `${activityType}:${clubName}`,
        });
        if (exposureError) throw exposureError;

        addictionTriggered = Boolean(exposureData?.triggered);
        addictionRelapsed = Boolean(exposureData?.relapsed);
        addictionType = (exposureData?.addictionType || "partying") as AddictionType;
        addictionSeverityGain = addictionTriggered ? Number(exposureData?.severity ?? 0) : 0;
      }

      const newFame = Math.max(0, (playerProfile.fame ?? 0) + fameGain);
      const newEnergy = Math.max(0, (playerProfile.energy ?? 100) - energyCost);
      const newCash = Math.max(0, (playerProfile.cash ?? 0) - cashSpent);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ energy: newEnergy, cash: newCash, fame: newFame })
        .eq("id", profileId);
      if (updateError) throw updateError;

      let message = `Night at ${clubName}: ${fameGain >= 0 ? "+" : ""}${fameGain} fame, -${energyCost} energy`;
      if (cashSpent > 0) message += `, -$${cashSpent}`;
      if (addictionRelapsed) message += `. ⚠️ ${getAddictionTypeLabel(addictionType)} relapse.`;
      else if (addictionTriggered) message += `. ⚠️ Repeated nights out have developed into ${getAddictionTypeLabel(addictionType).toLowerCase()} addiction.`;

      return {
        fameGain,
        energyCost,
        cashSpent,
        addictionTriggered,
        addictionRelapsed,
        addictionType: addictionTriggered || addictionRelapsed ? addictionType : undefined,
        addictionSeverityGain: addictionTriggered ? addictionSeverityGain : undefined,
        message,
        outcomeDetail,
      };
    },
    onSuccess: (outcome) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["addictions"] });

      if (outcome.outcomeDetail) {
        setLastOutcomeDetail(outcome.outcomeDetail);
        if ((outcome.addictionTriggered || outcome.addictionRelapsed) && outcome.addictionType) {
          setLastAddictionWarning(outcome.addictionRelapsed
            ? `${getAddictionTypeLabel(outcome.addictionType)} relapse.`
            : `Repeated nightlife exposure has developed into ${getAddictionTypeLabel(outcome.addictionType).toLowerCase()} addiction.`);
        } else {
          setLastAddictionWarning(null);
        }
      } else if (outcome.addictionTriggered || outcome.addictionRelapsed) {
        toast.warning(outcome.message, { duration: 6000 });
      } else {
        toast.success(outcome.message);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const dismissOutcome = () => {
    setLastOutcomeDetail(null);
    setLastAddictionWarning(null);
  };

  return {
    triggerNightlifeEvent: nightlifeEventMutation.mutate,
    isProcessing: nightlifeEventMutation.isPending,
    lastOutcome: nightlifeEventMutation.data,
    lastOutcomeDetail,
    lastAddictionWarning,
    dismissOutcome,
  };
}
