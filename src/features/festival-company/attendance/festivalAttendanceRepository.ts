import { supabase } from "@/integrations/supabase/client";
import {
  parseFestivalPlayerAttendanceList,
  type FestivalPlayerAttendance,
} from "./festivalAttendance";
import {
  parseFestivalCheckInEligibilityList,
  parseFestivalMemorabiliaList,
  type FestivalCheckInEligibility,
  type FestivalMemorabiliaItem,
} from "./festivalAttendeeExtras";

type UntypedRpc = (
  name: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

const attendanceRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;

export const getMyFestivalAttendance = async (): Promise<FestivalPlayerAttendance[]> => {
  const { data, error } = await attendanceRpc("get_my_festival_attendance");
  if (error) throw new Error(error.message || "festival_attendance_unavailable");
  return parseFestivalPlayerAttendanceList(data);
};

export const getMyFestivalCheckInEligibility = async (): Promise<FestivalCheckInEligibility[]> => {
  const { data, error } = await attendanceRpc("get_my_festival_check_in_eligibility");
  if (error) throw new Error(error.message || "festival_check_in_eligibility_unavailable");
  return parseFestivalCheckInEligibilityList(data);
};

export const getMyFestivalMemorabilia = async (): Promise<FestivalMemorabiliaItem[]> => {
  const { data, error } = await attendanceRpc("get_my_festival_memorabilia");
  if (error) throw new Error(error.message || "festival_memorabilia_unavailable");
  return parseFestivalMemorabiliaList(data);
};
