import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chooseFestivalMomentOption, getMyFestivalMoments, resolveFestivalMomentOutcome, triggerMyFestivalMoment } from "./festivalMomentsRepository";
import { festivalConditionsKey } from "./useFestivalDayPlanner";

export const festivalMomentsKey = (attendanceId?: string) => ["festival-moments", attendanceId] as const;

export const useMyFestivalMoments = (attendanceId?: string, enabled = true) =>
  useQuery({
    queryKey: festivalMomentsKey(attendanceId),
    queryFn: () => getMyFestivalMoments(attendanceId!),
    enabled: Boolean(enabled && attendanceId),
    staleTime: 15_000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

export const useTriggerFestivalMoment = (attendanceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey }: { idempotencyKey: string }) => triggerMyFestivalMoment(attendanceId, idempotencyKey),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: festivalMomentsKey(attendanceId) }),
  });
};

export const useChooseFestivalMomentOption = (attendanceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ momentId, optionId }: { momentId: string; optionId: string }) => chooseFestivalMomentOption(momentId, optionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: festivalMomentsKey(attendanceId) });
      void queryClient.invalidateQueries({ queryKey: festivalConditionsKey(attendanceId) });
    },
  });
};

export const useResolveFestivalMomentOutcome = (attendanceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ momentId }: { momentId: string }) => resolveFestivalMomentOutcome(momentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: festivalMomentsKey(attendanceId) });
      void queryClient.invalidateQueries({ queryKey: festivalConditionsKey(attendanceId) });
    },
  });
};
