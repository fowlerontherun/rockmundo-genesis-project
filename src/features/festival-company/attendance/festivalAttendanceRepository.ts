import { supabase } from "@/integrations/supabase/client";
import {
  parseFestivalPlayerAttendanceList,
  type FestivalPlayerAttendance,
} from "./festivalAttendance";

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
