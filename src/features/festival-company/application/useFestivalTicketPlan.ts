import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFestivalTicketPlan,
  saveFestivalTicketPlan,
} from "../data/festivalCompanyRepository";
import {
  getFestivalEditionTicketPlan,
  saveFestivalEditionTicketPlan,
} from "@/features/festivals/projections/repository";
import { festivalBudgetForecastQueryKey } from "@/features/festivals/budget/useFestivalBudgetForecast";
import type { FestivalTicketPlanDraft } from "../domain/festivalTicketPlan";

export const festivalTicketPlanQueryKey = (
  festivalCompanyId?: string,
  festivalEditionId?: string,
) => ["festival-ticket-plan", festivalCompanyId, festivalEditionId ?? "company"] as const;

export const useFestivalTicketPlan = (
  festivalCompanyId?: string,
  festivalEditionIdOrEnabled?: string | boolean,
  enabled = true,
) => {
  const festivalEditionId =
    typeof festivalEditionIdOrEnabled === "string"
      ? festivalEditionIdOrEnabled
      : undefined;
  const queryEnabled =
    typeof festivalEditionIdOrEnabled === "boolean"
      ? festivalEditionIdOrEnabled
      : enabled;

  return useQuery({
    queryKey: festivalTicketPlanQueryKey(festivalCompanyId, festivalEditionId),
    enabled: queryEnabled && Boolean(festivalCompanyId),
    retry: false,
    queryFn: () =>
      festivalEditionId
        ? getFestivalEditionTicketPlan(festivalCompanyId!, festivalEditionId)
        : getFestivalTicketPlan(festivalCompanyId!),
  });
};

export const useSaveFestivalTicketPlan = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      festivalCompanyId: string;
      festivalEditionId?: string;
      expectedVersion: number;
      draft: FestivalTicketPlanDraft;
      idempotencyKey: string;
      complete?: boolean;
    }) =>
      input.festivalEditionId
        ? saveFestivalEditionTicketPlan({
            ...input,
            festivalEditionId: input.festivalEditionId,
          })
        : saveFestivalTicketPlan(input),
    onSuccess: (data, input) => {
      client.setQueryData(
        festivalTicketPlanQueryKey(
          data.festivalCompanyId,
          input.festivalEditionId,
        ),
        data,
      );
      void Promise.all(
        [
          ["festival-company-setup"],
          ["owned-festival-companies"],
          [
            "festival-site-plan",
            data.festivalCompanyId,
            input.festivalEditionId ?? "company",
          ],
          ["festival-company-editions", data.festivalCompanyId],
          [
            "festival-artist-programme",
            data.festivalCompanyId,
            input.festivalEditionId ?? "company",
          ],
          ...(input.festivalEditionId
            ? [
                festivalBudgetForecastQueryKey(
                  data.festivalCompanyId,
                  input.festivalEditionId,
                ),
              ]
            : []),
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
    },
  });
};
