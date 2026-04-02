import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useBehaviorSettings } from "@/hooks/useBehaviorSettings";
import { toast } from "sonner";
import {
  rollForAddiction,
  getAddictionTypeLabel,
  type AddictionType,
} from "@/utils/addictionSystem";
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
  addictionType?: AddictionType;
  addictionSeverityGain?: number;
  message: string;
  outcomeDetail?: NightlifeOutcomeDetail;
}

const ACTIVITY_PROFILES: Record<
  Exclude<NightlifeActivityType, "stance_night">,
  { baseFame: number; energyCost: number; baseCash: number }
> = {
  guest_visit: { baseFame: 2, energyCost: 10, baseCash: 20 },
  dj_slot: { baseFame: 8, energyCost: 25, baseCash: 0 },
  bar_crawl: { baseFame: 3, energyCost: 15, baseCash: 30 },
  vip_clubbing: { baseFame: 5, energyCost: 20, baseCash: 50 },
  afterparty: { baseFame: 6, energyCost: 20, baseCash: 40 },
};

export function useNightlifeEvents() {
  const { profileId } = useActiveProfile();
  const { settings } = useBehaviorSettings();
  const queryClient = useQueryClient();
  const [lastOutcomeDetail, setLastOutcomeDetail] = useState<NightlifeOutcomeDetail | null>(null);
  const [lastAddictionWarning, setLastAddictionWarning] = useState<string | null>(null);

  const nightlifeEventMutation = useMutation({
    mutationFn: async ({
      activityType,
      clubName,
      stance,
      venueQuality,
    }: {
      activityType: NightlifeActivityType;
      clubName: string;
      stance?: NightlifeStance;
      venueQuality?: number;
    }): Promise<NightlifeOutcome> => {
      if (!profileId) throw new Error("Not authenticated");
      if (!settings) throw new Error("Behavior settings not loaded");

      // Fetch player profile
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
        // Stance-based nightlife event
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
        // Legacy activity-based event
        const profile = ACTIVITY_PROFILES[activityType as Exclude<NightlifeActivityType, "stance_night">];
        const fameVariance = Math.floor(Math.random() * 3) - 1;
        fameGain = Math.max(0, profile.baseFame + fameVariance);
        energyCost = profile.energyCost;
        cashSpent = profile.baseCash;
      }

      // Check affordability
      if ((playerProfile.energy ?? 100) < energyCost) {
        throw new Error(`Need ${energyCost} energy for this activity`);
      }
      if ((playerProfile.cash ?? 0) < cashSpent) {
        throw new Error(`Need $${cashSpent} to cover costs`);
      }

      // Roll for addiction (influenced by stance multiplier)
      let addictionTriggered = false;
      let addictionType: AddictionType = "alcohol";
      let addictionSeverityGain = 0;

      if (addictionRiskMultiplier > 0) {
        const modifiedSettings = {
          ...settings,
          // Boost partying intensity for addiction calc based on stance
          partying_intensity: addictionRiskMultiplier >= 2 ? "legendary" as const :
            addictionRiskMultiplier >= 1 ? (settings.partying_intensity || "moderate") :
            "light" as const,
        };
        const roll = rollForAddiction(modifiedSettings);
        if (roll.triggered) {
          addictionTriggered = true;
          addictionType = roll.type;

          const { data: existing } = await (supabase as any)
            .from("player_addictions")
            .select("*")
            .eq("profile_id", profileId)
            .eq("addiction_type", addictionType)
            .in("status", ["active", "recovering", "relapsed"])
            .maybeSingle();

          if (existing) {
            addictionSeverityGain = 5 + Math.floor(Math.random() * 6);
            const newSev = Math.min(100, existing.severity + addictionSeverityGain);
            await (supabase as any)
              .from("player_addictions")
              .update({ severity: newSev, updated_at: new Date().toISOString() })
              .eq("id", existing.id);
          } else {
            addictionSeverityGain = 20;
            await (supabase as any).from("player_addictions").insert({
              user_id: profileId,
              profile_id: profileId,
              addiction_type: addictionType,
              severity: 20,
              status: "active",
              triggered_at: new Date().toISOString(),
              days_clean: 0,
              relapse_count: 0,
            });
          }
        }
      }

      // Apply changes to profile
      const newFame = Math.max(0, (playerProfile.fame ?? 0) + fameGain);
      const newEnergy = Math.max(0, (playerProfile.energy ?? 100) - energyCost);
      const newCash = Math.max(0, (playerProfile.cash ?? 0) - cashSpent);

      await supabase
        .from("profiles")
        .update({
          energy: newEnergy,
          cash: newCash,
          fame: newFame,
        })
        .eq("id", profileId);

      // Build message
      let message = `Night at ${clubName}: ${fameGain >= 0 ? "+" : ""}${fameGain} fame, -${energyCost} energy`;
      if (cashSpent > 0) message += `, -$${cashSpent}`;
      if (addictionTriggered) {
        message += `. ⚠️ ${getAddictionTypeLabel(addictionType)} addiction ${addictionSeverityGain === 20 ? "triggered" : `worsened (+${addictionSeverityGain})`}!`;
      }

      return {
        fameGain,
        energyCost,
        cashSpent,
        addictionTriggered,
        addictionType: addictionTriggered ? addictionType : undefined,
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
        if (outcome.addictionTriggered && outcome.addictionType) {
          setLastAddictionWarning(
            `${getAddictionTypeLabel(outcome.addictionType)} addiction ${outcome.addictionSeverityGain === 20 ? "triggered" : `worsened (+${outcome.addictionSeverityGain})`}!`
          );
        } else {
          setLastAddictionWarning(null);
        }
      } else {
        if (outcome.addictionTriggered) {
          toast.warning(outcome.message, { duration: 6000 });
        } else {
          toast.success(outcome.message);
        }
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
