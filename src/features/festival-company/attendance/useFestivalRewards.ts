import { useQuery } from "@tanstack/react-query";
import { getMyFestivalRewardSummary } from "./festivalRewardsRepository";

export const festivalRewardsKey = (attendanceId?: string) => ["festival-rewards", attendanceId] as const;

export const useMyFestivalRewardSummary = (attendanceId?: string, enabled = true) =>
  useQuery({
    queryKey: festivalRewardsKey(attendanceId),
    queryFn: () => getMyFestivalRewardSummary(attendanceId!),
    enabled: Boolean(enabled && attendanceId),
    staleTime: 20_000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: (query) => query.state.data?.settled ? false : 45_000,
    refetchIntervalInBackground: false,
  });
