import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { calculateRelationshipSummary, fetchRelationshipEvents } from "../api";
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

      const events = await fetchRelationshipEvents({
        profileId,
        otherProfileId,
        userIds: filteredUserIds,
      });

      return {
        events,
        summary: calculateRelationshipSummary(events),
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

