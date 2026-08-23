import { useQuery } from "@tanstack/react-query";
import { getMyFestivalAttendance } from "./festivalAttendanceRepository";

export const festivalPlayerAttendanceKey = ["festival-player-attendance"] as const;

export const useMyFestivalAttendance = () =>
  useQuery({
    queryKey: festivalPlayerAttendanceKey,
    queryFn: getMyFestivalAttendance,
    staleTime: 30_000,
  });
