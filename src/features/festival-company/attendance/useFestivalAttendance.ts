import { useQuery } from "@tanstack/react-query";
import {
  getMyFestivalAttendance,
  getMyFestivalCheckInEligibility,
  getMyFestivalMemorabilia,
} from "./festivalAttendanceRepository";

export const festivalPlayerAttendanceKey = ["festival-player-attendance"] as const;
export const festivalCheckInEligibilityKey = ["festival-check-in-eligibility"] as const;
export const festivalMemorabiliaKey = ["festival-memorabilia"] as const;

export const useMyFestivalAttendance = (enabled = true) =>
  useQuery({
    queryKey: festivalPlayerAttendanceKey,
    queryFn: getMyFestivalAttendance,
    enabled,
    staleTime: 30_000,
  });

export const useMyFestivalCheckInEligibility = (enabled = true) =>
  useQuery({
    queryKey: festivalCheckInEligibilityKey,
    queryFn: getMyFestivalCheckInEligibility,
    enabled,
    staleTime: 15_000,
  });

export const useMyFestivalMemorabilia = (enabled = true) =>
  useQuery({
    queryKey: festivalMemorabiliaKey,
    queryFn: getMyFestivalMemorabilia,
    enabled,
    staleTime: 30_000,
  });
