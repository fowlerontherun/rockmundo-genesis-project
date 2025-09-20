import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type FriendProfileSummary = {
  profileId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type ProfilesRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileSummaryRow = Pick<ProfilesRow, "id" | "user_id" | "username" | "display_name" | "avatar_url">;
type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];
type FriendshipStatus = Database["public"]["Enums"]["friendship_status"];
type FriendPresenceStatus = Database["public"]["Enums"]["chat_participant_status"];
type ChatParticipantRow = Database["public"]["Tables"]["chat_participants"]["Row"];

type FriendRelationship = {
  friendshipId: string;
  friendUserId: string;
  friendProfileId: string | null;
  status: FriendshipStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
  profile?: FriendProfileSummary;
};

const ONLINE_STATUSES: FriendPresenceStatus[] = ["online", "typing"];

const DEFAULT_RELATIONSHIPS: FriendRelationship[] = [];

const normalizeProfile = (row: ProfileSummaryRow): FriendProfileSummary => ({
  profileId: row.id,
  userId: row.user_id,
  username: row.username,
  displayName: row.display_name,
  avatarUrl: row.avatar_url,
});

const toRelationship = (
  row: FriendshipRow,
  currentUserId: string,
  profileLookup: Record<string, FriendProfileSummary | undefined>,
): FriendRelationship => {
  const isOutgoing = row.user_id === currentUserId;
  const friendProfileId = isOutgoing ? row.friend_profile_id : row.user_profile_id;
  const friendUserId = isOutgoing ? row.friend_user_id : row.user_id;
  const profile = friendProfileId ? profileLookup[friendProfileId] : undefined;

  return {
    friendshipId: row.id,
    friendUserId,
    friendProfileId: friendProfileId ?? null,
    status: row.status ?? "pending",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    profile,
  };
};

const isPresenceOnline = (status?: FriendPresenceStatus) =>
  status ? ONLINE_STATUSES.includes(status) : false;

export interface UseFriendshipsReturn {
  loading: boolean;
  error: string | null;
  incomingRequests: FriendRelationship[];
  outgoingRequests: FriendRelationship[];
  acceptedFriends: FriendRelationship[];
  presenceByUserId: Record<string, FriendPresenceStatus>;
  acceptFriendship: (friendshipId: string) => Promise<void>;
  declineFriendship: (friendshipId: string) => Promise<void>;
  refresh: () => Promise<void>;
  friends: FriendRelationship[];
  pendingRequests: FriendRelationship[];
  sentRequests: FriendRelationship[];
  onlineFriends: FriendRelationship[];
}

export const useFriendships = (userId?: string): UseFriendshipsReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState(DEFAULT_RELATIONSHIPS);
  const [outgoingRequests, setOutgoingRequests] = useState(DEFAULT_RELATIONSHIPS);
  const [acceptedFriends, setAcceptedFriends] = useState(DEFAULT_RELATIONSHIPS);
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, FriendPresenceStatus>>({});

  const fetchProfiles = useCallback(async (profileIds: string[]) => {
    const lookup: Record<string, FriendProfileSummary> = {};

    if (profileIds.length === 0) {
      return lookup;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select<ProfileSummaryRow>(
        "id, user_id, username, display_name, avatar_url",
      )
      .in("id", profileIds);

    if (profileError) {
      throw profileError;
    }

    (data ?? []).forEach((row) => {
      lookup[row.id] = normalizeProfile(row);
    });
    return lookup;
  }, []);

  const fetchPresence = useCallback(async (userIds: string[]) => {
    const presenceMap: Record<string, FriendPresenceStatus> = {};

    if (userIds.length === 0) {
      return presenceMap;
    }

    const { data, error } = await supabase
      .from("chat_participants")
      .select<Pick<ChatParticipantRow, "user_id" | "status">>("user_id, status")
      .in("user_id", userIds);

    if (error) {
      throw error;
    }

    (data ?? []).forEach((row) => {
      presenceMap[row.user_id] = row.status;
    });
    return presenceMap;
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setIncomingRequests(DEFAULT_RELATIONSHIPS);
      setOutgoingRequests(DEFAULT_RELATIONSHIPS);
      setAcceptedFriends(DEFAULT_RELATIONSHIPS);
      setPresenceByUserId({});
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [outgoingResult, incomingResult] = await Promise.all([
        supabase.from("friendships").select<FriendshipRow>("*").eq("user_id", userId),
        supabase
          .from("friendships")
          .select<FriendshipRow>("*")
          .eq("friend_user_id", userId),
      ]);

      const outgoingRows = outgoingResult.data ?? [];
      const incomingRows = incomingResult.data ?? [];

      if (outgoingResult.error) {
        throw outgoingResult.error;
      }

      if (incomingResult.error) {
        throw incomingResult.error;
      }

      const allRows = [...outgoingRows, ...incomingRows];
      const profileIds = new Set<string>();
      const friendUserIds = new Set<string>();

      allRows.forEach((row) => {
        const isOutgoing = row.user_id === userId;
        const profileId = isOutgoing ? row.friend_profile_id : row.user_profile_id;
        const targetUserId = isOutgoing ? row.friend_user_id : row.user_id;
        if (profileId) {
          profileIds.add(profileId);
        }
        if (targetUserId) {
          friendUserIds.add(targetUserId);
        }
      });

      const profileLookup = await fetchProfiles(Array.from(profileIds));
      const presence = await fetchPresence(Array.from(friendUserIds));

      const mappedOutgoing = outgoingRows.map((row) => toRelationship(row, userId, profileLookup));
      const mappedIncoming = incomingRows.map((row) => toRelationship(row, userId, profileLookup));

      const accepted = [...mappedOutgoing, ...mappedIncoming].filter(
        (entry) => entry.status === "accepted",
      );
      const pendingIncoming = mappedIncoming.filter((entry) => entry.status === "pending");
      const pendingOutgoing = mappedOutgoing.filter((entry) => entry.status === "pending");

      setIncomingRequests(pendingIncoming);
      setOutgoingRequests(pendingOutgoing);
      setAcceptedFriends(accepted);
      setPresenceByUserId(presence);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load friendships";
      setError(message);
      console.error("Failed to load friendships:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchPresence, fetchProfiles, userId]);

  const acceptFriendship = useCallback(
    async (friendshipId: string) => {
      if (!userId) {
        throw new Error("You need to be logged in to accept friendships");
      }

      const { error: updateError } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId)
        .eq("friend_user_id", userId);

      if (updateError) {
        throw updateError;
      }

      await refresh();
    },
    [refresh, userId],
 
  );

  const declineFriendship = useCallback(
    async (friendshipId: string) => {
      if (!userId) {
        throw new Error("You need to be logged in to update friendships");
      }

      const { error: updateError } = await supabase
        .from("friendships")
        .update({ status: "declined" })
        .eq("id", friendshipId)
        .or(`user_id.eq.${userId},friend_user_id.eq.${userId}`);

      if (updateError) {
        throw updateError;
      }

      await refresh();
    },
    [refresh, userId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onlineFriends = useMemo(
    () => acceptedFriends.filter((friend) => isPresenceOnline(presenceByUserId[friend.friendUserId])),
    [acceptedFriends, presenceByUserId],
  );

  return {
    loading,
    error,
    incomingRequests,
    outgoingRequests,
    acceptedFriends,
    presenceByUserId,
    acceptFriendship,
    declineFriendship,
    refresh,
    friends: acceptedFriends,
    pendingRequests: incomingRequests,
    sentRequests: outgoingRequests,
    onlineFriends,
  };
};
