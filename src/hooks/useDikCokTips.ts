import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const tipRpc = supabase as unknown as {
  rpc(
    name: "send_dikcok_tip",
    args: { p_video_id: string; p_amount: number; p_request_id: string },
  ): Promise<{ error: Error | null }>;
};

export const useDikCokTips = (videoId?: string) => {
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
    mutationFn: async ({ videoId, amount, requestId }: {
      videoId: string;
      amount: number;
      requestId: string;
    }) => {
      const { error } = await tipRpc.rpc("send_dikcok_tip", {
        p_video_id: videoId,
        p_amount: amount,
        p_request_id: requestId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tip sent! 💰");
      queryClient.invalidateQueries({ queryKey: ["dikcok-tip-total"] });
      queryClient.invalidateQueries({ queryKey: ["active-profile"] });
    },
    onError: (err) => {
      toast.error(err.message === "insufficient_personal_funds" ? "Not enough cash" : err.message || "Failed to send tip");
    },
  });

  return { tipTotal: tipTotal || 0, sendTip };
};
