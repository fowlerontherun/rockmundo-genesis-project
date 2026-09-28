import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addFestivalCanonicalBrandProspect,
  getFestivalCanonicalBrandDirectory,
  type FestivalBrandSort,
} from "../data/festivalCanonicalBrands";

export const festivalCanonicalBrandsKey = (
  festivalCompanyId?: string, search = "", initial = "", sort: FestivalBrandSort = "asc", page = 0,
) => ["festival-canonical-brands", festivalCompanyId, search.trim(), initial, sort, page] as const;

export function useFestivalCanonicalBrands(
  festivalCompanyId?: string, search = "", initial = "", sort: FestivalBrandSort = "asc", page = 0,
) {
  return useQuery({
    queryKey: festivalCanonicalBrandsKey(festivalCompanyId, search, initial, sort, page),
    enabled: Boolean(festivalCompanyId),
    retry: false,
    queryFn: () => getFestivalCanonicalBrandDirectory(festivalCompanyId!, { search, initial, sort, page }),
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
