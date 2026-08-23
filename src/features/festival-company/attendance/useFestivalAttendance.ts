import { useQuery } from "@tanstack/react-query";
import { getMyFestivalAttendance } from "./festivalAttendanceRepository";

export const festivalPlayerAttendanceKey = ["festival-player-attendance"] as const;

export const useMyFestivalAttendance = (enabled = true) =>
  useQuery({
    queryKey: festivalPlayerAttendanceKey,
    queryFn: getMyFestivalAttendance,
    enabled,
    staleTime: 30_000,
  });
