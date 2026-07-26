import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFestivalSitePlan,
  saveFestivalSitePlan,
} from "../data/festivalCompanyRepository";
import type { FestivalSitePlanDraft } from "../domain/festivalSitePlan";
export const festivalSitePlanQueryKey = (id?: string) =>
  ["festival-site-plan", id] as const;
export const useFestivalSitePlan = (id?: string, enabled = true) =>
  useQuery({
    queryKey: festivalSitePlanQueryKey(id),
    enabled: enabled && Boolean(id),
    retry: false,
    queryFn: () => getFestivalSitePlan(id!),
  });
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
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
    },
  });
};
