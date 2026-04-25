import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface CoopQuest {
  id: string;
  profile_a_id: string;
  profile_b_id: string;
  pair_key: string;
  quest_key: string;
  title: string;
  description: string;
  action_type: string;
  target_count: number;
  progress_a: number;
  progress_b: number;
  reward_xp: number;
  reward_skill_xp: number;
  reward_skill_slug: string | null;
  cadence: "daily" | "weekly";
  expires_at: string;
  completed_at: string | null;
  claimed_by_a: boolean;
  claimed_by_b: boolean;
  created_at: string;
  updated_at: string;
}

export function useCoopQuests(otherProfileId?: string | null) {
  const { profileId } = useActiveProfile();

  return useQuery<CoopQuest[]>({
    queryKey: ["coop-quests", profileId, otherProfileId ?? "all"],
    queryFn: async () => {
      if (!profileId) return [];
      let query = (supabase as any)
        .from("coop_quests")
        .select("*")
        .or(`profile_a_id.eq.${profileId},profile_b_id.eq.${profileId}`)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      let rows = (data ?? []) as CoopQuest[];
      if (otherProfileId) {
        rows = rows.filter(
          (q) => q.profile_a_id === otherProfileId || q.profile_b_id === otherProfileId,
        );
      }
      return rows;
    },
    enabled: !!profileId,
    staleTime: 30_000,
  });
}

export function useCreateCoopQuest() {
  const { profileId } = useActiveProfile();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      otherProfileId,
      cadence,
    }: {
      otherProfileId: string;
      cadence: "daily" | "weekly";
    }) => {
      if (!profileId) throw new Error("No active profile");
      const { data, error } = await (supabase.functions as any).invoke("coop-quest", {
        body: { op: "create", profile_id: profileId, other_profile_id: otherProfileId, cadence },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Failed to create quest");
      return data;
    },
    onSuccess: (data) => {
      toast.success("New co-op quest started!", {
        description: data?.quest?.title ? `${data.quest.title} — ${data.quest.description}` : undefined,
      });
      qc.invalidateQueries({ queryKey: ["coop-quests"] });
    },
    onError: (err: Error) => {
      toast.error("Could not start quest", { description: err.message });
    },
  });
}

export function useClaimCoopQuest() {
  const { profileId } = useActiveProfile();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (questId: string) => {
      if (!profileId) throw new Error("No active profile");
      const { data, error } = await (supabase.functions as any).invoke("coop-quest", {
        body: { op: "claim", profile_id: profileId, quest_id: questId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Failed to claim");
      return data;
    },
    onSuccess: (data) => {
      const skill = data.reward_skill_xp > 0 && data.reward_skill_slug
        ? ` · +${data.reward_skill_xp} ${data.reward_skill_slug} XP`
        : "";
      toast.success("Quest reward claimed!", {
        description: `+${data.reward_xp} XP${skill}`,
      });
      qc.invalidateQueries({ queryKey: ["coop-quests"] });
    },
    onError: (err: Error) => {
      toast.error("Could not claim", { description: err.message });
    },
  });
}
