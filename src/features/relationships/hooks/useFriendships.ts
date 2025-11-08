import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loadFriendships, respondToFriendship, cancelFriendship, createFriendRequest } from "../api";
import type { DecoratedFriendship } from "../types";

export function useFriendships(profileId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<DecoratedFriendship[]>({
    queryKey: ["friendships", profileId],
    queryFn: () => {
      if (!profileId) {
        return Promise.resolve([]);
      }
      return loadFriendships(profileId);
    },
    staleTime: 60_000,
    enabled: Boolean(profileId),
  });

  const refresh = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: ["friendships", profileId] });
  }, [queryClient, profileId]);

  const acceptRequest = useCallback(
    async (friendshipId: string) => {
      await respondToFriendship(friendshipId, "accepted");
      await refresh();
    },
    [refresh],
  );

  const declineRequest = useCallback(
    async (friendshipId: string) => {
      await respondToFriendship(friendshipId, "declined");
      await refresh();
    },
    [refresh],
  );

  const removeFriend = useCallback(
    async (friendshipId: string) => {
      await cancelFriendship(friendshipId);
      await refresh();
    },
    [refresh],
  );

  const sendRequest = useCallback(
    async (targetProfileId: string) => {
      if (!profileId) {
        throw new Error("Profile is required to send a friend request");
      }
      await createFriendRequest(profileId, targetProfileId);
      await refresh();
    },
    [profileId, refresh],
  );

  return {
    friendships: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refresh,
    acceptRequest,
    declineRequest,
    removeFriend,
    sendRequest,
  };
}

