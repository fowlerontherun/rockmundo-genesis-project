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
const festivalTicketWalletKey = ["festival-ticket-wallet"] as const;

export const useMyFestivalAttendance = (enabled = true) =>
  useQuery({
    queryKey: festivalPlayerAttendanceKey,
    queryFn: getMyFestivalAttendance,
    enabled,
    staleTime: 5 * 60_000,
    // This hook is mounted by the shared Layout on every authenticated route.
    // A one-minute polling loop caused the whole app shell to re-render even for
    // players who were nowhere near a festival. Attendance mutations explicitly
    // invalidate this query, so keep only a low-frequency safety refresh here.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
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

const useAttendanceMutationInvalidation = () => {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: festivalPlayerAttendanceKey }),
    queryClient.invalidateQueries({ queryKey: festivalCheckInEligibilityKey }),
    queryClient.invalidateQueries({ queryKey: festivalMemorabiliaKey }),
    queryClient.invalidateQueries({ queryKey: festivalTicketWalletKey }),
  ]);
};

export const useCheckInToFestival = () => {
  const invalidate = useAttendanceMutationInvalidation();
  return useMutation({
    mutationFn: ({ attendanceId }: { attendanceId: string }) => checkInToFestival(attendanceId),
    onSuccess: () => {
      void invalidate();
    },
  });
};

export const useLeaveFestivalEarly = () => {
  const invalidate = useAttendanceMutationInvalidation();
  return useMutation({
    mutationFn: ({ attendanceId }: { attendanceId: string }) => leaveFestivalEarly(attendanceId),
    onSuccess: () => {
      void invalidate();
    },
  });
};
