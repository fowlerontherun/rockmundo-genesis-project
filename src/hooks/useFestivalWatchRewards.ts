import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";

export type RewardType = "xp" | "song_gift" | "attribute_point";

interface WatchRewardResult {
  reward_type: RewardType;
  reward_value: Record<string, any>;
  message: string;
}

/**
 * Roll for a watch reward after viewing a band's set at a festival.
 * - XP: 100% chance, 10-30 XP
 * - Song gift: 5% chance
 * - Attribute point: 3% chance
 */
function rollWatchReward(bandId: string): WatchRewardResult | null {
  const roll = Math.random();

  if (roll < 0.03) {
    // Attribute point
    const attributes = ["creativity", "charisma", "technique", "stamina"];
    const attr = attributes[Math.floor(Math.random() * attributes.length)];
    return {
      reward_type: "attribute_point",
      reward_value: { attribute: attr, amount: 1 },
      message: `Inspired by the performance! +1 ${attr}`,
    };
  }

  if (roll < 0.08) {
    // Song gift (5% chance = 0.03 to 0.08)
    return {
      reward_type: "song_gift",
      reward_value: { band_id: bandId, gifted: true },
      message: "The band gifted you one of their songs!",
    };
  }

  // XP reward (always)
  const xp = Math.floor(Math.random() * 21) + 10; // 10-30
  return {
    reward_type: "xp",
    reward_value: { xp_amount: xp },
    message: `Gained ${xp} XP from watching the performance!`,
  };
}

export const useClaimWatchReward = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      festivalId,
      bandId,
      stageSlotId,
    }: {
      festivalId: string;
      bandId: string;
      stageSlotId: string;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Check if already claimed for this slot
      const { data: existing } = await (supabase as any)
        .from("festival_watch_rewards")
        .select("id")
        .eq("festival_id", festivalId)
        .eq("user_id", user.id)
        .eq("stage_slot_id", stageSlotId)
        .maybeSingle();

      if (existing) throw new Error("Already claimed reward for this set");

      const reward = rollWatchReward(bandId);
      if (!reward) return null;

      const { data, error } = await (supabase as any)
        .from("festival_watch_rewards")
        .insert({
          festival_id: festivalId,
          user_id: user.id,
          band_id: bandId,
          stage_slot_id: stageSlotId,
          reward_type: reward.reward_type,
          reward_value: reward.reward_value,
        })
        .select()
        .single();

      if (error) throw error;

      // Apply XP if applicable
      if (reward.reward_type === "xp") {
        const xpAmount = reward.reward_value.xp_amount || 0;
        const { data: profile } = await supabase
          .from("profiles")
          .select("experience")
          .eq("user_id", user.id)
          .single();

        if (profile) {
          await supabase
            .from("profiles")
            .update({ experience: profile.experience + xpAmount })
            .eq("user_id", user.id);
        }
      }

      return { ...data, message: reward.message };
    },
    onSuccess: (data) => {
      if (data?.message) {
        toast.success(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ["festival-watch-rewards"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
};
