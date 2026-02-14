import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useBehaviorSettings } from "@/hooks/useBehaviorSettings";
import { toast } from "sonner";
import {
  rollForAddiction,
  getAddictionTypeLabel,
  type AddictionType,
} from "@/utils/addictionSystem";

export type NightlifeActivityType =
  | "guest_visit"
  | "dj_slot"
  | "bar_crawl"
  | "vip_clubbing"
  | "afterparty";

interface NightlifeOutcome {
  fameGain: number;
  energyCost: number;
  cashSpent: number;
  addictionTriggered: boolean;
  addictionType?: AddictionType;
  addictionSeverityGain?: number;
  message: string;
}

const ACTIVITY_PROFILES: Record<
  NightlifeActivityType,
  { baseFame: number; energyCost: number; baseCash: number }
> = {
  guest_visit: { baseFame: 2, energyCost: 10, baseCash: 20 },
  dj_slot: { baseFame: 8, energyCost: 25, baseCash: 0 },
  bar_crawl: { baseFame: 3, energyCost: 15, baseCash: 30 },
  vip_clubbing: { baseFame: 5, energyCost: 20, baseCash: 50 },
  afterparty: { baseFame: 6, energyCost: 20, baseCash: 40 },
};

export function useNightlifeEvents() {
  const { user } = useAuth();
  const { settings } = useBehaviorSettings();
  const queryClient = useQueryClient();

  const nightlifeEventMutation = useMutation({
    mutationFn: async ({
      activityType,
      clubName,
    }: {
      activityType: NightlifeActivityType;
      clubName: string;
    }): Promise<NightlifeOutcome> => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!settings) throw new Error("Behavior settings not loaded");

      const profile = ACTIVITY_PROFILES[activityType];

      // Check player energy
      const { data: playerProfile } = await supabase
        .from("profiles")
        .select("energy, cash, fame")
        .eq("user_id", user.id)
        .single();

      if (!playerProfile) throw new Error("Profile not found");
      if ((playerProfile.energy ?? 100) < profile.energyCost) {
        throw new Error(`Need ${profile.energyCost} energy for this activity`);
      }
      if ((playerProfile.cash ?? 0) < profile.baseCash) {
        throw new Error(`Need $${profile.baseCash} to cover costs`);
      }

      // Roll for addiction
      const { triggered, type: addictionType } = rollForAddiction(settings);

      let addictionSeverityGain = 0;
      let addictionTriggered = false;

      if (triggered) {
        addictionTriggered = true;

        // Check for existing addiction of this type
        const { data: existing } = await supabase
          .from("player_addictions")
          .select("*")
          .eq("user_id", user.id)
          .eq("addiction_type", addictionType)
          .in("status", ["active", "recovering", "relapsed"])
          .maybeSingle();

        if (existing) {
          // Increase severity of existing addiction
          addictionSeverityGain = 5 + Math.floor(Math.random() * 6); // 5-10
          const newSev = Math.min(100, existing.severity + addictionSeverityGain);
          await supabase
            .from("player_addictions")
            .update({ severity: newSev, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          // Create new addiction
          addictionSeverityGain = 20;
          await supabase.from("player_addictions").insert({
            user_id: user.id,
            addiction_type: addictionType,
            severity: 20,
            status: "active",
            triggered_at: new Date().toISOString(),
            days_clean: 0,
            relapse_count: 0,
          });
        }
      }

      // Apply energy/cash cost and fame gain
      const fameVariance = Math.floor(Math.random() * 3) - 1; // -1 to +1
      const fameGain = Math.max(0, profile.baseFame + fameVariance);

      await supabase
        .from("profiles")
        .update({
          energy: Math.max(0, (playerProfile.energy ?? 100) - profile.energyCost),
          cash: Math.max(0, (playerProfile.cash ?? 0) - profile.baseCash),
          fame: (playerProfile.fame ?? 0) + fameGain,
        })
        .eq("user_id", user.id);

      // Build outcome message
      let message = `Night at ${clubName}: +${fameGain} fame, -${profile.energyCost} energy`;
      if (profile.baseCash > 0) message += `, -$${profile.baseCash}`;
      if (addictionTriggered) {
        message += `. ⚠️ ${getAddictionTypeLabel(addictionType)} addiction ${addictionSeverityGain === 20 ? "triggered" : `worsened (+${addictionSeverityGain})`}!`;
      }

      return {
        fameGain,
        energyCost: profile.energyCost,
        cashSpent: profile.baseCash,
        addictionTriggered,
        addictionType: addictionTriggered ? addictionType : undefined,
        addictionSeverityGain: addictionTriggered ? addictionSeverityGain : undefined,
        message,
      };
    },
    onSuccess: (outcome) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["addictions"] });

      if (outcome.addictionTriggered) {
        toast.warning(outcome.message, { duration: 6000 });
      } else {
        toast.success(outcome.message);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  return {
    triggerNightlifeEvent: nightlifeEventMutation.mutate,
    isProcessing: nightlifeEventMutation.isPending,
    lastOutcome: nightlifeEventMutation.data,
  };
}
