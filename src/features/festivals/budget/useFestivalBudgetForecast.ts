import { useQuery } from "@tanstack/react-query";
import { getFestivalBudgetForecast } from "./repository";

export const festivalBudgetForecastQueryKey = (
  festivalCompanyId?: string,
  festivalEditionId?: string,
) => ["festival-edition-budget", festivalCompanyId, festivalEditionId] as const;

export const useFestivalBudgetForecast = (
  festivalCompanyId?: string,
  festivalEditionId?: string,
  enabled = true,
) =>
  useQuery({
    queryKey: festivalBudgetForecastQueryKey(
      festivalCompanyId,
      festivalEditionId,
    ),
    enabled: enabled && Boolean(festivalCompanyId && festivalEditionId),
    retry: false,
    queryFn: () =>
      getFestivalBudgetForecast(festivalCompanyId!, festivalEditionId!),
  });
