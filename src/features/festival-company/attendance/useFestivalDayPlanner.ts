import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelFestivalDayPlanItem,
  createFestivalDayPlanItem,
  getMyFestivalDayPlan,
} from "./festivalDayPlannerRepository";
import type { CreateFestivalPlanItemInput } from "./festivalDayPlanner";

export const festivalDayPlanKey = (attendanceId?: string) => ["festival-day-plan", attendanceId] as const;

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

export const useCreateFestivalDayPlanItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFestivalPlanItemInput) => createFestivalDayPlanItem(input),
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: festivalDayPlanKey(input.attendanceId) });
    },
  });
};

export const useCancelFestivalDayPlanItem = (attendanceId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId }: { itemId: string }) => cancelFestivalDayPlanItem(itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: festivalDayPlanKey(attendanceId) });
    },
  });
};
