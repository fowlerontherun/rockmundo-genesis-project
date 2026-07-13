import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteSavedPlayerSearch, getPlayerDiscoveryFilterOptions, getRecommendedPlayers, listSavedPlayerSearches, savePlayerSearch, searchPlayers, updateSavedPlayerSearch, type PlayerDiscoveryQuery, type SavedPlayerSearch } from "../services/playerDiscovery";

export function usePlayerDiscovery(query: Partial<PlayerDiscoveryQuery>, viewerProfileId?: string | null) {
  return useQuery({ queryKey: ["player-discovery", viewerProfileId, query], queryFn: () => searchPlayers(query, viewerProfileId), staleTime: 30_000 });
}
export function useRecommendedPlayers(query: Partial<PlayerDiscoveryQuery>, viewerProfileId?: string | null) {
  return useQuery({ queryKey: ["player-recommendations", viewerProfileId, query], queryFn: () => getRecommendedPlayers(query, viewerProfileId), staleTime: 60_000 });
}
export function usePlayerDiscoveryFilterOptions() {
  return useQuery({ queryKey: ["player-discovery-filter-options"], queryFn: getPlayerDiscoveryFilterOptions, staleTime: 5 * 60_000 });
}
export function useSavedPlayerSearches(viewerProfileId?: string | null) {
  const qc = useQueryClient();
  const key = ["saved-player-searches", viewerProfileId];
  const saved = useQuery({ queryKey: key, queryFn: () => listSavedPlayerSearches(viewerProfileId), enabled: Boolean(viewerProfileId) });
  return { ...saved,
    saveSearch: useMutation({ mutationFn: (input: Omit<SavedPlayerSearch, "id" | "userId" | "createdAt" | "updatedAt" | "lastUsedAt">) => savePlayerSearch(input, viewerProfileId), onSuccess: () => qc.invalidateQueries({ queryKey: key }) }),
    updateSearch: useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<SavedPlayerSearch> }) => updateSavedPlayerSearch(id, patch, viewerProfileId), onSuccess: () => qc.invalidateQueries({ queryKey: key }) }),
    deleteSearch: useMutation({ mutationFn: (id: string) => deleteSavedPlayerSearch(id, viewerProfileId), onSuccess: () => qc.invalidateQueries({ queryKey: key }) }),
  };
}
