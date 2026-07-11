import { useQuery } from "@tanstack/react-query";
import { getGigExperience } from "./services/GigExperienceService";

export function useGigExperience(gigId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["gig-experience", gigId],
    enabled: enabled && !!gigId,
    queryFn: () => getGigExperience(gigId as string),
    staleTime: 30_000,
  });
}
