import { supabase } from "@/integrations/supabase/client";
import { parseFestivalRewardSummary, type FestivalRewardSummary } from "./festivalRewards";

type UntypedRpc = (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
const festivalRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;

export const getMyFestivalRewardSummary = async (attendanceId: string): Promise<FestivalRewardSummary> => {
  const { data, error } = await festivalRpc("get_my_festival_reward_summary", { p_attendance_id: attendanceId });
  if (error) throw new Error(error.message || "festival_reward_summary_unavailable");
  return parseFestivalRewardSummary(data);
};
