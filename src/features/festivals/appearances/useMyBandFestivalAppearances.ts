import { useQuery } from "@tanstack/react-query";
import { fetchMyBandFestivalAppearances } from "./bandFestivalAppearances";

/** Server resolves the active character; the key prevents cross-character cache reuse. */
export function useMyBandFestivalAppearances(profileId?: string | null) {
  return useQuery({
    queryKey: ["band-festival-appearances", profileId],
    queryFn: fetchMyBandFestivalAppearances,
    enabled: Boolean(profileId),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
