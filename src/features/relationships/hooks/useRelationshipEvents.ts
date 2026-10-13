import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { calculateRelationshipSummary, fetchRelationshipEvents, fetchVerifiedRelationshipAffinityScore } from "../api";
import type { RelationshipEvent, RelationshipSummary } from "../types";

interface UseRelationshipEventsParams {
  profileId: string | null | undefined;
  otherProfileId: string | null | undefined;
  userIds: Array<string | null | undefined>;
  enabled?: boolean;
}

export function useRelationshipEvents({
  profileId,
  otherProfileId,
  userIds,
  enabled = true,
}: UseRelationshipEventsParams) {
  const filteredUserIds = useMemo(
    () => userIds.filter((id): id is string => Boolean(id)),
    [userIds],
  );

  const query = useQuery<{ events: RelationshipEvent[]; summary: RelationshipSummary }>({
    queryKey: ["relationship-events", profileId, otherProfileId],
    queryFn: async () => {
      if (!profileId || !otherProfileId || filteredUserIds.length === 0) {
        return { events: [], summary: calculateRelationshipSummary([]) };
      }

      const [events, affinityScore] = await Promise.all([
        fetchRelationshipEvents({
          profileId,
          otherProfileId,
          userIds: filteredUserIds,
        }),
        // Lifetime score is aggregated by the authoritative server ledger.
        fetchVerifiedRelationshipAffinityScore(profileId, otherProfileId),
      ]);

      return {
        events,
        summary: calculateRelationshipSummary(events, affinityScore),
      };
    },
    enabled: enabled && Boolean(profileId && otherProfileId && filteredUserIds.length > 0),
    refetchInterval: 20_000,
  });

  return {
    events: query.data?.events ?? [],
    summary: query.data?.summary ?? calculateRelationshipSummary([]),
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

