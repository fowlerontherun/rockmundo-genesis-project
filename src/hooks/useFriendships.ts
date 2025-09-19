import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchFriendshipsForProfile,
  fetchPresenceByUserIds,
  fetchPrimaryProfileForUser,
  fetchProfilesByIds,
  updateFriendshipStatus,
  type FriendPresenceStatus,
  type FriendProfileRow,
  type FriendshipRow,
  type FriendshipStatus,
} from "@/integrations/supabase/friends";

export type FriendProfileSummary = {
  profileId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  level: number | null;
  fame: number | null;
};

export type FriendshipSummary = {
  friendshipId: string;
  friendProfileId: string;
  friendUserId: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
  profile?: FriendProfileSummary;
};

export interface UseFriendshipsResult {
  loading: boolean;
  error: string | null;
  incomingRequests: FriendshipSummary[];
  outgoingRequests: FriendshipSummary[];
  acceptedFriends: FriendshipSummary[];
  presenceByUserId: Record<string, FriendPresenceStatus | undefined>;
  activeProfileId: string | null;
  refresh: () => Promise<void>;
  acceptFriendship: (friendshipId: string) => Promise<void>;
  declineFriendship: (friendshipId: string) => Promise<void>;
}

const toProfileSummary = (row: FriendProfileRow): FriendProfileSummary => ({
  profileId: row.id,
  userId: row.user_id,
  username: row.username,
  displayName: row.display_name,
  avatarUrl: row.avatar_url,
  bio: row.bio,
  level: typeof row.level === "number" ? row.level : row.level ? Number(row.level) : null,
  fame: typeof row.fame === "number" ? row.fame : row.fame ? Number(row.fame) : null,
});

const categorizeFriendships = (
  activeProfileId: string,
  friendships: FriendshipRow[],
  profilesById: Record<string, FriendProfileRow>,
) => {
  const incoming: FriendshipSummary[] = [];
  const outgoing: FriendshipSummary[] = [];
  const accepted: FriendshipSummary[] = [];

  friendships.forEach((friendship) => {
    const isRequester = friendship.requester_id === activeProfileId;
    const friendProfileId = isRequester ? friendship.addressee_id : friendship.requester_id;
    const friendProfile = profilesById[friendProfileId];
    const friendUserId = friendProfile?.user_id ?? "";
    const summary: FriendshipSummary = {
      friendshipId: friendship.id,
      friendProfileId,
      friendUserId,
      status: friendship.status,
      createdAt: friendship.created_at,
      updatedAt: friendship.updated_at,
      respondedAt: friendship.responded_at,
      profile: friendProfile ? toProfileSummary(friendProfile) : undefined,
    };

    if (friendship.status === "pending") {
      if (isRequester) {
        outgoing.push(summary);
      } else {
        incoming.push(summary);
      }
      return;
    }

    if (friendship.status === "accepted") {
      accepted.push(summary);
    }
  });

  return { incoming, outgoing, accepted };
};

export const useFriendships = (userId?: string | null): UseFriendshipsResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<FriendshipSummary[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendshipSummary[]>([]);
  const [acceptedFriends, setAcceptedFriends] = useState<FriendshipSummary[]>([]);
  const [presenceByUserId, setPresenceByUserId] = useState<
    Record<string, FriendPresenceStatus | undefined>
  >({});
  const [trackedFriendUserIds, setTrackedFriendUserIds] = useState<string[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      if (!mountedRef.current) {
        return;
      }

      setLoading(false);
      setError(null);
      setActiveProfileId(null);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setAcceptedFriends([]);
      setPresenceByUserId({});
      setTrackedFriendUserIds([]);
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const activeProfile = await fetchPrimaryProfileForUser(userId);

      if (!mountedRef.current) {
        return;
      }

      if (!activeProfile) {
        setActiveProfileId(null);
        setIncomingRequests([]);
        setOutgoingRequests([]);
        setAcceptedFriends([]);
        setPresenceByUserId({});
        setTrackedFriendUserIds([]);
        return;
      }

      const friendships = await fetchFriendshipsForProfile(activeProfile.id);

      if (!mountedRef.current) {
        return;
      }

      if (friendships.length === 0) {
        setActiveProfileId(activeProfile.id);
        setIncomingRequests([]);
        setOutgoingRequests([]);
        setAcceptedFriends([]);
        setPresenceByUserId({});
        setTrackedFriendUserIds([]);
        return;
      }

      const relatedProfileIds = Array.from(
        new Set(
          friendships.map((friendship) =>
            friendship.requester_id === activeProfile.id
              ? friendship.addressee_id
              : friendship.requester_id,
          ),
        ),
      );

      const profilesById = await fetchProfilesByIds(relatedProfileIds);

      if (!mountedRef.current) {
        return;
      }

      const { incoming, outgoing, accepted } = categorizeFriendships(
        activeProfile.id,
        friendships,
        profilesById,
      );

      const nextFriendUserIds = Array.from(
        new Set(
          Object.values(profilesById)
            .map((profile) => profile.user_id)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort();

      const presenceMap = await fetchPresenceByUserIds(nextFriendUserIds);

      if (!mountedRef.current) {
        return;
      }

      setActiveProfileId(activeProfile.id);
      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
      setAcceptedFriends(accepted);
      setPresenceByUserId(presenceMap);
      setTrackedFriendUserIds(nextFriendUserIds);
    } catch (refreshError) {
      if (!mountedRef.current) {
        return;
      }

      console.error("Failed to load friendships", refreshError);
      const message =
        refreshError instanceof Error && refreshError.message
          ? refreshError.message
          : "Unable to load friendships.";
      setError(message);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setAcceptedFriends([]);
      setPresenceByUserId({});
      setTrackedFriendUserIds([]);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!activeProfileId) {
      return;
    }

    const channel = supabase
      .channel(`friendships-${activeProfileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships", filter: `requester_id=eq.${activeProfileId}` },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${activeProfileId}` },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeProfileId, refresh]);

  useEffect(() => {
    if (trackedFriendUserIds.length === 0) {
      return;
    }

    const watched = new Set(trackedFriendUserIds);
    const channel = supabase
      .channel(`friend-presence-${trackedFriendUserIds.join("-")}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_participants" },
        (payload) => {
          const row = payload.new as { user_id?: string; status?: string } | null;
          const userIdValue = row?.user_id;
          if (!userIdValue || !watched.has(userIdValue)) {
            return;
          }

          const nextStatus = row?.status;
          if (nextStatus === "online" || nextStatus === "typing" || nextStatus === "muted") {
            setPresenceByUserId((current) => ({ ...current, [userIdValue]: nextStatus }));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trackedFriendUserIds]);

  const acceptFriendship = useCallback(
    async (friendshipId: string) => {
      await updateFriendshipStatus(friendshipId, "accepted");
      await refresh();
    },
    [refresh],
  );

  const declineFriendship = useCallback(
    async (friendshipId: string) => {
      await updateFriendshipStatus(friendshipId, "declined");
      await refresh();
    },
    [refresh],
  );

  return useMemo(
    () => ({
      loading,
      error,
      incomingRequests,
      outgoingRequests,
      acceptedFriends,
      presenceByUserId,
      activeProfileId,
      refresh,
      acceptFriendship,
      declineFriendship,
    }),
    [
      loading,
      error,
      incomingRequests,
      outgoingRequests,
      acceptedFriends,
      presenceByUserId,
      activeProfileId,
      refresh,
      acceptFriendship,
      declineFriendship,
    ],
  );
};
