import { supabase } from "@/integrations/supabase/client";
import {
  parseFestivalAttendanceReconciliation,
  type FestivalPlayerAttendance,
} from "./festivalAttendance";
import {
  parseFestivalCheckInEligibilityList,
  parseFestivalCheckInResult,
  parseFestivalLeaveEarlyResult,
  parseFestivalMemorabiliaList,
  type FestivalCheckInEligibility,
  type FestivalCheckInResult,
  type FestivalLeaveEarlyResult,
  type FestivalMemorabiliaItem,
} from "./festivalAttendeeExtras";

type UntypedRpc = (
  name: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

const attendanceRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;

const syncMyFestivalAttendanceLifecycle = async (): Promise<void> => {
  const { error } = await attendanceRpc("sync_my_festival_attendance_lifecycle");
  if (error) throw new Error(error.message || "festival_attendance_sync_failed");
};

export const getMyFestivalAttendance = async (): Promise<FestivalPlayerAttendance[]> => {
  await syncMyFestivalAttendanceLifecycle();
  const { data, error } = await attendanceRpc("reconcile_my_festival_attendance");
  if (error) throw new Error(error.message || "festival_attendance_unavailable");
  return parseFestivalAttendanceReconciliation(data).attendance;
};

export const getMyFestivalCheckInEligibility = async (): Promise<FestivalCheckInEligibility[]> => {
  await syncMyFestivalAttendanceLifecycle();
  const { data, error } = await attendanceRpc("get_my_festival_check_in_eligibility");
  if (error) throw new Error(error.message || "festival_check_in_eligibility_unavailable");
  return parseFestivalCheckInEligibilityList(data);
};

export const getMyFestivalMemorabilia = async (): Promise<FestivalMemorabiliaItem[]> => {
  const { data, error } = await attendanceRpc("get_my_festival_memorabilia");
  if (error) throw new Error(error.message || "festival_memorabilia_unavailable");
  return parseFestivalMemorabiliaList(data);
};

export const checkInToFestival = async (attendanceId: string): Promise<FestivalCheckInResult> => {
  await syncMyFestivalAttendanceLifecycle();
  const { data, error } = await attendanceRpc("check_in_to_festival", {
    p_attendance_id: attendanceId,
  });
  if (error) throw new Error(error.message || "festival_check_in_failed");
  return parseFestivalCheckInResult(data);
};

export const leaveFestivalEarly = async (attendanceId: string): Promise<FestivalLeaveEarlyResult> => {
  const { data, error } = await attendanceRpc("leave_festival_early", {
    p_attendance_id: attendanceId,
  });
  if (error) throw new Error(error.message || "festival_leave_failed");
  return parseFestivalLeaveEarlyResult(data);
};
