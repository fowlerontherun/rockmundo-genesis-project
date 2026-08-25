import { supabase } from "@/integrations/supabase/client";
import { parseFestivalMomentFeed, parseFestivalMomentMutationResult, type FestivalMomentFeed, type FestivalMomentMutationResult } from "./festivalMoments";

type UntypedRpc = (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
const festivalRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;

export const getMyFestivalMoments = async (attendanceId: string): Promise<FestivalMomentFeed> => {
  const { data, error } = await festivalRpc("get_my_festival_moments", { p_attendance_id: attendanceId });
  if (error) throw new Error(error.message || "festival_moments_unavailable");
  return parseFestivalMomentFeed(data);
};

export const triggerMyFestivalMoment = async (attendanceId: string, idempotencyKey: string): Promise<FestivalMomentMutationResult> => {
  const { data, error } = await festivalRpc("trigger_my_festival_moment", { p_attendance_id: attendanceId, p_idempotency_key: idempotencyKey });
  if (error) throw new Error(error.message || "festival_moment_trigger_failed");
  return parseFestivalMomentMutationResult(data);
};

export const chooseFestivalMomentOption = async (momentId: string, optionId: string): Promise<FestivalMomentMutationResult> => {
  const { data, error } = await festivalRpc("choose_festival_moment_option", { p_moment_id: momentId, p_option_id: optionId });
  if (error) throw new Error(error.message || "festival_moment_choice_failed");
  return parseFestivalMomentMutationResult(data);
};

export const resolveFestivalMomentOutcome = async (momentId: string): Promise<FestivalMomentMutationResult> => {
  const { data, error } = await festivalRpc("resolve_festival_moment_outcome", { p_moment_id: momentId });
  if (error) throw new Error(error.message || "festival_moment_resolution_failed");
  return parseFestivalMomentMutationResult(data);
};
