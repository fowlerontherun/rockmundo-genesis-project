import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export const useDikCokChallenges = (bandId?: string | null) => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  // Ensure challenges exist (call rotation if none active)
  const { data: challenges, isLoading } = useQuery({
    queryKey: ["dikcok-challenges"],
    queryFn: async () => {
      const now = new Date().toISOString();
      let { data, error } = await supabase
        .from("dikcok_challenges")
        .select("*")
        .eq("is_active", true)
        .gte("ends_at", now)
        .order("starts_at", { ascending: true });

      if (error) throw error;

      // If no active challenges, trigger rotation
      if (!data || data.length === 0) {
        await supabase.rpc("rotate_weekly_challenges");
        const res = await supabase
          .from("dikcok_challenges")
          .select("*")
          .eq("is_active", true)
          .gte("ends_at", now)
          .order("starts_at", { ascending: true });
        if (res.error) throw res.error;
        data = res.data;
      }

      return data;
    },
  });

  // Past challenges (ended)
  const { data: pastChallenges } = useQuery({
    queryKey: ["dikcok-past-challenges"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("dikcok_challenges")
        .select("*")
        .or(`is_active.eq.false,ends_at.lt.${now}`)
        .order("ends_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  // Check which challenges user's band has entered
  const { data: myEntries } = useQuery({
    queryKey: ["dikcok-my-entries", bandId],
    queryFn: async () => {
      if (!bandId) return [];
      const { data, error } = await supabase
        .from("dikcok_challenge_entries")
        .select("*")
        .eq("band_id", bandId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId,
  });

  // Enter a challenge
  const enterChallenge = useMutation({
    mutationFn: async ({ challengeId, videoId }: { challengeId: string; videoId?: string }) => {
      if (!bandId) throw new Error("No band selected");
      const { error } = await supabase.from("dikcok_challenge_entries").insert({
        challenge_id: challengeId,
        band_id: bandId,
        video_id: videoId || null,
        score: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Challenge entered! 🏆");
      queryClient.invalidateQueries({ queryKey: ["dikcok-my-entries"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to enter challenge");
    },
  });

  // Get leaderboard for a challenge
  const useLeaderboard = (challengeId: string) => {
    return useQuery({
      queryKey: ["dikcok-challenge-leaderboard", challengeId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("dikcok_challenge_entries")
          .select("*, bands!dikcok_challenge_entries_band_id_fkey(name, logo_url)")
          .eq("challenge_id", challengeId)
          .order("score", { ascending: false })
          .limit(10);
        if (error) throw error;
        return data || [];
      },
    });
  };

  const enteredChallengeIds = new Set(myEntries?.map((e) => e.challenge_id) || []);

  return {
    challenges,
    pastChallenges,
    isLoading,
    enterChallenge,
    enteredChallengeIds,
    useLeaderboard,
  };
};
