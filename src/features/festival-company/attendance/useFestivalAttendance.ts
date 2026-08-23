import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  checkInToFestival,
  getMyFestivalAttendance,
  getMyFestivalCheckInEligibility,
  getMyFestivalMemorabilia,
  leaveFestivalEarly,
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

const useInvalidateFestivalAttendeeState = () => {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: festivalPlayerAttendanceKey }),
    queryClient.invalidateQueries({ queryKey: festivalCheckInEligibilityKey }),
    queryClient.invalidateQueries({ queryKey: festivalMemorabiliaKey }),
    queryClient.invalidateQueries({ queryKey: ["festival-ticket-wallet"] }),
  ]);
};

export const useFestivalCheckIn = () => {
  const invalidate = useInvalidateFestivalAttendeeState();
  return useMutation({
    mutationFn: checkInToFestival,
    onSuccess: invalidate,
  });
};

export const useLeaveFestivalEarly = () => {
  const invalidate = useInvalidateFestivalAttendeeState();
  return useMutation({
    mutationFn: leaveFestivalEarly,
    onSuccess: invalidate,
  });
};
