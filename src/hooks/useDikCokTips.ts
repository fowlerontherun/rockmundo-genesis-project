import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export const useDikCokTips = (videoId?: string) => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  // Get total tips for a video
  const { data: tipTotal } = useQuery({
    queryKey: ["dikcok-tip-total", videoId],
    queryFn: async () => {
      if (!videoId) return 0;
      const { data, error } = await supabase
        .from("dikcok_fan_tips")
        .select("amount")
        .eq("video_id", videoId);
      if (error) throw error;
      return data?.reduce((sum, t) => sum + t.amount, 0) || 0;
    },
    enabled: !!videoId,
  });

  // Send a tip
  const sendTip = useMutation({
    mutationFn: async ({ videoId, amount, message }: { videoId: string; amount: number; message?: string }) => {
      if (!profileId) throw new Error("Not logged in");

      // Check player cash
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();
      if (pErr) throw pErr;
      if ((profile?.cash || 0) < amount) throw new Error("Not enough cash");

      // Deduct from tipper
      const { error: deductErr } = await supabase
        .from("profiles")
        .update({ cash: (profile.cash || 0) - amount })
        .eq("id", profileId);
      if (deductErr) throw deductErr;

      // Credit to band balance
      const { data: video } = await supabase
        .from("dikcok_videos")
        .select("band_id")
        .eq("id", videoId)
        .single();
      if (video?.band_id) {
        const { data: band } = await supabase
          .from("bands")
          .select("band_balance")
          .eq("id", video.band_id)
          .single();
        if (band) {
          await supabase
            .from("bands")
            .update({ band_balance: (band.band_balance || 0) + amount })
            .eq("id", video.band_id);
        }
      }

      // Record tip
      const { error } = await supabase.from("dikcok_fan_tips").insert({
        video_id: videoId,
        tipper_profile_id: profileId,
        amount,
        message: message || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tip sent! 💰");
      queryClient.invalidateQueries({ queryKey: ["dikcok-tip-total"] });
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send tip");
    },
  });

  return { tipTotal: tipTotal || 0, sendTip };
};
