import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { loadFriendships, createFriendRequest } from "../api";
import { respondToFriendship as respondToFriendshipRpc } from "@/integrations/supabase/playerConnections";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import type { DecoratedFriendship } from "../types";

export function useFriendships(profileId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { profileId: activeProfileId } = useActiveProfile();
  const effectiveProfileId = activeProfileId ?? profileId ?? null;

  const query = useQuery<DecoratedFriendship[]>({
    queryKey: ["friendships", effectiveProfileId],
    queryFn: () => {
      if (!effectiveProfileId) return Promise.resolve([]);
      return loadFriendships(effectiveProfileId);
    },
    staleTime: 15_000,
    enabled: Boolean(effectiveProfileId),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["friendships"] });
    queryClient.invalidateQueries({ queryKey: ["friend-request-counts"] });
    queryClient.invalidateQueries({ queryKey: ["player-connection"] });
    return queryClient.refetchQueries({ queryKey: ["friendships", effectiveProfileId] });
  }, [queryClient, effectiveProfileId]);

  const act = useCallback(async (friendshipId: string, status: "accepted" | "declined" | "cancelled" | "removed") => {
    if (!effectiveProfileId) throw new Error("Profile is required to update a friendship");
    await respondToFriendshipRpc(friendshipId, status, effectiveProfileId);
    await refresh();
  }, [effectiveProfileId, refresh]);

  const acceptRequest = useCallback(async (friendshipId: string) => {
    try {
      await act(friendshipId, "accepted");
      toast.success("Friend request accepted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to accept friend request.");
    }
  }, [act]);

  const declineRequest = useCallback(async (friendshipId: string) => {
    try {
      await act(friendshipId, "declined");
      toast.success("Friend request declined");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to decline friend request.");
    }
  }, [act]);

  const removeFriend = useCallback(async (friendshipId: string) => {
    try {
      await act(friendshipId, "removed");
      toast.success("Friend removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove friendship.");
    }
  }, [act]);

  const sendRequest = useCallback(async (targetProfileId: string) => {
    if (!effectiveProfileId) throw new Error("Profile is required to send a friend request");
    await createFriendRequest(effectiveProfileId, targetProfileId);
    await refresh();
  }, [effectiveProfileId, refresh]);

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
