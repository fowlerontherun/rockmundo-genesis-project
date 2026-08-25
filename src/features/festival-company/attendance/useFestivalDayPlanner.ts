import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addFestivalStagePerformanceToDayPlan,
  cancelFestivalDayPlanItem,
  createFestivalDayPlanItem,
  getMyFestivalConditions,
  getMyFestivalDayPlan,
  getMyFestivalStageSchedule,
  previewFestivalDayPlanItem,
  previewFestivalStagePlanItem,
  resolveFestivalPlanActivity,
} from "./festivalDayPlannerRepository";
import type {
  CreateFestivalPlanItemInput,
  PreviewFestivalPlanItemInput,
} from "./festivalDayPlanner";

export const festivalDayPlanKey = (attendanceId?: string) => ["festival-day-plan", attendanceId] as const;
export const festivalConditionsKey = (attendanceId?: string) => ["festival-conditions", attendanceId] as const;
export const festivalStageScheduleKey = (attendanceId?: string) => ["festival-stage-schedule", attendanceId] as const;

export const useMyFestivalDayPlan = (attendanceId?: string, enabled = true) =>
  useQuery({
    queryKey: festivalDayPlanKey(attendanceId),
    queryFn: () => getMyFestivalDayPlan(attendanceId!),
    enabled: Boolean(enabled && attendanceId),
    staleTime: 15_000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

export const useMyFestivalStageSchedule = (attendanceId?: string, enabled = true) =>
  useQuery({
    queryKey: festivalStageScheduleKey(attendanceId),
    queryFn: () => getMyFestivalStageSchedule(attendanceId!),
    enabled: Boolean(enabled && attendanceId),
    staleTime: 15_000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

export const useMyFestivalConditions = (attendanceId?: string, enabled = true) =>
  useQuery({
    queryKey: festivalConditionsKey(attendanceId),
    queryFn: () => getMyFestivalConditions(attendanceId!),
    enabled: Boolean(enabled && attendanceId),
    staleTime: 15_000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

export const usePreviewFestivalDayPlanItem = () =>
  useMutation({ mutationFn: (input: PreviewFestivalPlanItemInput) => previewFestivalDayPlanItem(input) });

export const useCreateFestivalDayPlanItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFestivalPlanItemInput) => createFestivalDayPlanItem(input),
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: festivalDayPlanKey(input.attendanceId) });
      void queryClient.invalidateQueries({ queryKey: festivalStageScheduleKey(input.attendanceId) });
    },
  });
};

export const useCancelFestivalDayPlanItem = (attendanceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId }: { itemId: string }) => cancelFestivalDayPlanItem(itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: festivalDayPlanKey(attendanceId) });
      void queryClient.invalidateQueries({ queryKey: festivalStageScheduleKey(attendanceId) });
    },
  });
};

export const usePreviewFestivalStagePlanItem = (attendanceId: string) =>
  useMutation({
    mutationFn: ({ scheduleItemId }: { scheduleItemId: string }) =>
      previewFestivalStagePlanItem(attendanceId, scheduleItemId),
  });

export const useAddFestivalStagePerformanceToDayPlan = (attendanceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scheduleItemId, idempotencyKey }: { scheduleItemId: string; idempotencyKey: string }) =>
      addFestivalStagePerformanceToDayPlan(attendanceId, scheduleItemId, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: festivalDayPlanKey(attendanceId) });
      void queryClient.invalidateQueries({ queryKey: festivalStageScheduleKey(attendanceId) });
    },
  });
};

export const useResolveFestivalPlanActivity = (attendanceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planItemId }: { planItemId: string }) => resolveFestivalPlanActivity(planItemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: festivalDayPlanKey(attendanceId) });
      void queryClient.invalidateQueries({ queryKey: festivalConditionsKey(attendanceId) });
    },
  });
};
