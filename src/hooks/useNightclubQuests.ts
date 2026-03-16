import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface NightclubQuest {
  id: string;
  club_id: string;
  npc_id: string;
  title: string;
  description: string;
  quest_type: string;
  energy_cost: number;
  rewards: Record<string, any>;
  requirements: Record<string, any> | null;
  dialogue: DialogueNode[];
  chain_id: string | null;
  chain_position: number | null;
  cooldown_hours: number | null;
  is_active: boolean;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  choices?: DialogueChoice[];
}

export interface DialogueChoice {
  id: string;
  text: string;
  next_node_id: string | null;
  effects?: Record<string, any>;
  requirement?: Record<string, any>;
}

export interface QuestProgress {
  id: string;
  quest_id: string;
  profile_id: string;
  status: string;
  dialogue_state: { current_node_id: string } | null;
  started_at: string | null;
  completed_at: string | null;
  rewards_claimed: boolean;
}

export function useNightclubQuests(clubId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch quests for this club
  const { data: quests, isLoading: questsLoading } = useQuery({
    queryKey: ["nightclub-quests", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from("nightclub_quests")
        .select("*")
        .eq("club_id", clubId)
        .eq("is_active", true)
        .order("chain_position", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((q) => ({
        ...q,
        dialogue: Array.isArray(q.dialogue) ? q.dialogue : [],
        rewards: typeof q.rewards === "object" && q.rewards ? q.rewards : {},
        requirements: typeof q.requirements === "object" ? q.requirements : null,
      })) as unknown as NightclubQuest[];
    },
    enabled: !!clubId,
  });

  // Fetch player progress for this club's quests
  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ["nightclub-quest-progress", clubId, user?.id],
    queryFn: async () => {
      if (!user?.id || !clubId) return [];
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!profile) return [];

      const questIds = quests?.map((q) => q.id) ?? [];
      if (!questIds.length) return [];

      const { data, error } = await supabase
        .from("player_nightclub_quest_progress")
        .select("*")
        .eq("profile_id", profile.id)
        .in("quest_id", questIds);
      if (error) throw error;
      return (data ?? []) as unknown as QuestProgress[];
    },
    enabled: !!user?.id && !!clubId && !!quests?.length,
  });

  // Start a quest
  const startQuest = useMutation({
    mutationFn: async (questId: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, energy")
        .eq("user_id", user.id)
        .single();
      if (!profile) throw new Error("Profile not found");

      const quest = quests?.find((q) => q.id === questId);
      if (!quest) throw new Error("Quest not found");

      if ((profile.energy ?? 100) < quest.energy_cost) {
        throw new Error(`Need ${quest.energy_cost} energy to start this quest`);
      }

      // Deduct energy
      await supabase
        .from("profiles")
        .update({ energy: Math.max(0, (profile.energy ?? 100) - quest.energy_cost) })
        .eq("user_id", user.id);

      const firstNodeId = quest.dialogue?.[0]?.id ?? null;

      const { data, error } = await supabase
        .from("player_nightclub_quest_progress")
        .insert({
          profile_id: profile.id,
          quest_id: questId,
          status: "active",
          started_at: new Date().toISOString(),
          dialogue_state: firstNodeId ? { current_node_id: firstNodeId } : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nightclub-quest-progress"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err) => toast.error(err.message),
  });

  // Advance dialogue
  const advanceDialogue = useMutation({
    mutationFn: async ({
      progressId,
      nextNodeId,
    }: {
      progressId: string;
      nextNodeId: string | null;
    }) => {
      if (!nextNodeId) {
        // Quest complete
        const { error } = await supabase
          .from("player_nightclub_quest_progress")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            dialogue_state: null,
          })
          .eq("id", progressId);
        if (error) throw error;
        return { completed: true };
      }

      const { error } = await supabase
        .from("player_nightclub_quest_progress")
        .update({ dialogue_state: { current_node_id: nextNodeId } })
        .eq("id", progressId);
      if (error) throw error;
      return { completed: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["nightclub-quest-progress"] });
      if (result.completed) {
        toast.success("Quest completed!");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Claim rewards
  const claimRewards = useMutation({
    mutationFn: async ({
      progressId,
      rewards,
    }: {
      progressId: string;
      rewards: Record<string, any>;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, cash, fame")
        .eq("user_id", user.id)
        .single();
      if (!profile) throw new Error("Profile not found");

      const cashReward = Number(rewards.cash) || 0;
      const fameReward = Number(rewards.fame) || 0;

      if (cashReward || fameReward) {
        await supabase
          .from("profiles")
          .update({
            cash: (profile.cash ?? 0) + cashReward,
            fame: (profile.fame ?? 0) + fameReward,
          })
          .eq("user_id", user.id);
      }

      await supabase
        .from("player_nightclub_quest_progress")
        .update({ rewards_claimed: true })
        .eq("id", progressId);

      return { cashReward, fameReward };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["nightclub-quest-progress"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      const parts: string[] = [];
      if (result.cashReward) parts.push(`+$${result.cashReward}`);
      if (result.fameReward) parts.push(`+${result.fameReward} fame`);
      toast.success(`Rewards claimed! ${parts.join(", ")}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const getQuestProgress = (questId: string) =>
    progress?.find((p) => p.quest_id === questId) ?? null;

  return {
    quests: quests ?? [],
    progress: progress ?? [],
    questsLoading,
    progressLoading,
    startQuest: startQuest.mutate,
    advanceDialogue: advanceDialogue.mutate,
    claimRewards: claimRewards.mutate,
    getQuestProgress,
    isStarting: startQuest.isPending,
    isAdvancing: advanceDialogue.isPending,
    isClaiming: claimRewards.isPending,
  };
}
