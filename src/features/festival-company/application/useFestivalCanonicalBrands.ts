import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addFestivalCanonicalBrandProspect,
  getFestivalCanonicalBrandCandidates,
} from "../data/festivalCanonicalBrands";

export const festivalCanonicalBrandsKey = (festivalCompanyId?: string, search = "") =>
  ["festival-canonical-brands", festivalCompanyId, search.trim()] as const;

export function useFestivalCanonicalBrands(festivalCompanyId?: string, search = "") {
  return useQuery({
    queryKey: festivalCanonicalBrandsKey(festivalCompanyId, search),
    enabled: Boolean(festivalCompanyId),
    retry: false,
    queryFn: () => getFestivalCanonicalBrandCandidates(festivalCompanyId!, search),
  });
}

export function useAddFestivalCanonicalBrandProspect() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ festivalCompanyId, brandId }: { festivalCompanyId: string; brandId: string }) =>
      addFestivalCanonicalBrandProspect(festivalCompanyId, brandId),
    onSuccess: (_data, { festivalCompanyId }) => {
      void Promise.all([
        client.invalidateQueries({ queryKey: ["festival-canonical-brands", festivalCompanyId] }),
        client.invalidateQueries({ queryKey: ["festival-sponsorship", festivalCompanyId] }),
      ]);
    },
  });
}
