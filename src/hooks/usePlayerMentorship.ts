import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface PlayerMentorship {
  id: string;
  mentor_profile_id: string;
  mentee_profile_id: string;
  focus_skill: string;
  status: string;
  xp_granted: number;
  sessions_completed: number;
  created_at: string;
  updated_at: string;
  mentor_profile?: { display_name: string | null; username: string | null; level: number | null } | null;
  mentee_profile?: { display_name: string | null; username: string | null; level: number | null } | null;
}

export const usePlayerMentorships = () => {
  const { profileId } = useActiveProfile();

  return useQuery<PlayerMentorship[]>({
    queryKey: ["player-mentorships", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("player_mentorships")
        .select(`
          *,
          mentor_profile:profiles!mentor_profile_id(display_name, username, level),
          mentee_profile:profiles!mentee_profile_id(display_name, username, level)
        `)
        .or(`mentor_profile_id.eq.${profileId},mentee_profile_id.eq.${profileId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlayerMentorship[];
    },
    enabled: !!profileId,
  });
};

export const useOfferMentorship = () => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menteeProfileId, focusSkill }: { menteeProfileId: string; focusSkill: string }) => {
      if (!profileId) throw new Error("Not signed in");
      const { error } = await (supabase as any)
        .from("player_mentorships")
        .insert({
          mentor_profile_id: profileId,
          mentee_profile_id: menteeProfileId,
          focus_skill: focusSkill,
          status: "pending",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-mentorships", profileId] });
      toast.success("Mentorship offer sent!");
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

export const useRespondMentorship = () => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mentorshipId, accept }: { mentorshipId: string; accept: boolean }) => {
      const newStatus = accept ? "active" : "cancelled";
      const { error } = await (supabase as any)
        .from("player_mentorships")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", mentorshipId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["player-mentorships", profileId] });
      toast.success(vars.accept ? "Mentorship accepted!" : "Mentorship declined");
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

export const useRunMentorSession = () => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mentorshipId }: { mentorshipId: string }) => {
      // Fetch current mentorship
      const { data: m, error: fetchErr } = await (supabase as any)
        .from("player_mentorships")
        .select("*")
        .eq("id", mentorshipId)
        .single();
      if (fetchErr || !m) throw fetchErr ?? new Error("Mentorship not found");

      const xpAward = 15 + Math.floor(Math.random() * 20);
      const { error } = await (supabase as any)
        .from("player_mentorships")
        .update({
          sessions_completed: (m.sessions_completed ?? 0) + 1,
          xp_granted: (m.xp_granted ?? 0) + xpAward,
          updated_at: new Date().toISOString(),
        })
        .eq("id", mentorshipId);
      if (error) throw error;
      return { xpAwarded: xpAward, sessionsCompleted: (m.sessions_completed ?? 0) + 1 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["player-mentorships", profileId] });
      toast.success(`Session complete! +${result.xpAwarded} XP awarded (${result.sessionsCompleted} total sessions)`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
};
