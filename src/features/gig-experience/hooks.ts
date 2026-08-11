import { useQuery } from "@tanstack/react-query";
import { getGigExperience } from "./services/GigExperienceService";
import { getGigViewerReplay } from "./services/GigViewerReplayService";
import { shouldRetryGigExperienceLoad } from "./diagnostics";

export function useGigExperience(gigId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["gig-experience", gigId],
    enabled: enabled && !!gigId,
    queryFn: () => getGigExperience(gigId as string),
    staleTime: 30_000,
    retry: shouldRetryGigExperienceLoad,
  });
}


export function useGigViewerReplay(gigId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["gig-viewer-replay", gigId],
    enabled: enabled && !!gigId,
    queryFn: () => getGigViewerReplay(gigId as string),
    staleTime: 30_000,
    retry: shouldRetryGigExperienceLoad,
  });
}
