import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getConnectionState, getFriendRequestCounts, listFriendships, listFriendSuggestions, respondToFriendship, sendConnectionRequest, type FriendListKind } from "@/integrations/supabase/playerConnections";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export function usePlayerConnection(targetProfileId?: string | null) {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const queryKey = ["player-connection", profileId, targetProfileId];
  const state = useQuery({ queryKey, queryFn: () => getConnectionState(targetProfileId!), enabled: !!profileId && !!targetProfileId });
  const invalidate = () => { queryClient.invalidateQueries({ queryKey }); queryClient.invalidateQueries({ queryKey: ["friendships"] }); queryClient.invalidateQueries({ queryKey: ["friend-request-counts"] }); };
  const send = useMutation({ mutationFn: () => sendConnectionRequest(targetProfileId!), onSuccess: () => { toast.success("Friend request sent"); invalidate(); }, onError: (e: Error) => toast.error(e.message) });
  return { ...state, send, isSelf: profileId === targetProfileId };
}

export function useFriendRequests() {
  const { profileId } = useActiveProfile();
  const counts = useQuery({ queryKey: ["friend-request-counts", profileId], queryFn: getFriendRequestCounts, enabled: !!profileId });
  return { counts };
}

export function useFriends(kind: FriendListKind, search = "") {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["friendships", profileId, kind, search], queryFn: () => listFriendships(profileId!, kind, search), enabled: !!profileId });
  const suggestions = useQuery({ queryKey: ["friend-suggestions", profileId], queryFn: () => listFriendSuggestions(profileId!), enabled: !!profileId && kind === "friends" });
  const act = useMutation({ mutationFn: ({ friendshipId, status }: { friendshipId: string; status: "accepted" | "declined" | "cancelled" | "removed" }) => respondToFriendship(friendshipId, status), onSuccess: () => { toast.success("Friendship updated"); queryClient.invalidateQueries({ queryKey: ["friendships"] }); queryClient.invalidateQueries({ queryKey: ["friend-request-counts"] }); queryClient.invalidateQueries({ queryKey: ["player-connection"] }); }, onError: (e: Error) => toast.error(e.message) });
  return { ...query, suggestions, act };
}
