import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFestivalSitePlan,
  saveFestivalSitePlan,
} from "../data/festivalCompanyRepository";
import { getFestivalEditionSitePlan } from "@/features/festivals/projections/repository";
import type { FestivalSitePlanDraft } from "../domain/festivalSitePlan";

export const festivalSitePlanQueryKey = (
  festivalCompanyId?: string,
  festivalEditionId?: string,
) => ["festival-site-plan", festivalCompanyId, festivalEditionId ?? "company"] as const;

export const useFestivalSitePlan = (
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
    queryKey: festivalSitePlanQueryKey(festivalCompanyId, festivalEditionId),
    enabled: queryEnabled && Boolean(festivalCompanyId),
    retry: false,
    queryFn: () =>
      festivalEditionId
        ? getFestivalEditionSitePlan(festivalCompanyId!, festivalEditionId)
        : getFestivalSitePlan(festivalCompanyId!),
  });
};

export const useSaveFestivalSitePlan = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      festivalCompanyId: string;
      expectedVersion: number;
      draft: FestivalSitePlanDraft;
      idempotencyKey: string;
      complete?: boolean;
    }) => saveFestivalSitePlan(input),
    onSuccess: (data) => {
      client.setQueryData(
        festivalSitePlanQueryKey(data.festivalCompanyId),
        data,
      );
      void Promise.all(
        [
          ["festival-company-setup"],
          ["owned-festival-companies"],
          ["festival-configuration", data.festivalCompanyId],
          ["festival-company-editions", data.festivalCompanyId],
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
    },
  });
};
