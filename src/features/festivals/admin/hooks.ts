import { useQuery } from "@tanstack/react-query";
import { fetchAdminFestivalCatalogue, fetchOwnerFestivalEditions } from "./service";
import { festivalAdminQueryKeys } from "./queryKeys";

export function useAdminFestivalCatalogue() {
  return useQuery({ queryKey: festivalAdminQueryKeys.catalogue, queryFn: fetchAdminFestivalCatalogue });
}

export function useOwnerFestivalEditions(festivalId: string | undefined) {
  return useQuery({
    queryKey: festivalAdminQueryKeys.ownerEditions(festivalId ?? "missing"),
    queryFn: () => fetchOwnerFestivalEditions(festivalId as string),
    enabled: Boolean(festivalId),
  });
}
