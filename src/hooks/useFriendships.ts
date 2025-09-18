import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type FriendshipStatus = Database["public"]["Enums"]["friendship_status"];
type PresenceStatus = Database["public"]["Enums"]["chat_participant_status"];
type FriendshipRow = Tables<"friendships">;
type ChatParticipantRow = Tables<"chat_participants">;
type ProfileRow = Tables<"profiles">;

export type FriendProfileSummary = {
  userId: string;
  profileId: string;
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  isActive: boolean;
};

export type FriendRequestSummary = {
  friendshipId: string;
  friendUserId: string;
  createdAt: string | null;
  status: FriendshipStatus;
  profile?: FriendProfileSummary;
};

export type AcceptedFriendSummary = {
  friendshipId: string;
  friendUserId: string;
  acceptedAt: string | null;
  status: FriendshipStatus;
  profile?: FriendProfileSummary;
};

const toTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

export const useFriendships = (userId?: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestSummary[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestSummary[]>([]);
  const [acceptedFriends, setAcceptedFriends] = useState<AcceptedFriendSummary[]>([]);
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, PresenceStatus>>({});
  const [trackedFriendIds, setTrackedFriendIds] = useState<string[]>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshPresence = useCallback(async (friendIds: string[]) => {
    if (!friendIds.length) {
      if (!isMountedRef.current) {
        return;
      }
      setPresenceByUserId({});
      return;
    }

    const { data, error: presenceError } = await supabase
      .from("chat_participants")
      .select("user_id, status")
      .in("user_id", friendIds);

    if (presenceError) {
      console.error("Error loading presence:", presenceError);
      return;
    }

    if (!isMountedRef.current) {
      return;
    }

    const nextPresence: Record<string, PresenceStatus> = {};
    for (const row of (data ?? []) as ChatParticipantRow[]) {
      if (row.user_id) {
        nextPresence[row.user_id] = row.status;
      }
    }

    setPresenceByUserId(nextPresence);
  }, []);

  const fetchFriendships = useCallback(async () => {
    if (!isMountedRef.current) {
      return;
    }

    if (!userId) {
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setAcceptedFriends([]);
      setTrackedFriendIds([]);
      setPresenceByUserId({});
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: friendshipsError } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status, created_at, updated_at")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (friendshipsError) {
        throw friendshipsError;
      }

      if (!isMountedRef.current) {
        return;
      }

      const friendships = (data ?? []) as FriendshipRow[];
      const allFriendIds = new Set<string>();
      const acceptedFriendIds = new Set<string>();

      friendships.forEach((row) => {
        const friendUserId = row.requester_id === userId ? row.addressee_id : row.requester_id;
        if (!friendUserId) {
          return;
        }

        allFriendIds.add(friendUserId);
        if (row.status === "accepted") {
          acceptedFriendIds.add(friendUserId);
        }
      });

      const friendIdList = Array.from(allFriendIds);
      const profileMap: Record<string, FriendProfileSummary> = {};

      if (friendIdList.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id, user_id, display_name, username, avatar_url, is_active")
          .in("user_id", friendIdList);

        if (profileError) {
          throw profileError;
        }

        for (const row of (profileRows ?? []) as ProfileRow[]) {
          const summary: FriendProfileSummary = {
            userId: row.user_id,
            profileId: row.id,
            displayName: row.display_name,
            username: row.username,
            avatarUrl: row.avatar_url,
            isActive: Boolean(row.is_active),
          };

          const existing = profileMap[row.user_id];
          if (!existing || (!existing.isActive && summary.isActive)) {
            profileMap[row.user_id] = summary;
          }
        }
      }

      if (!isMountedRef.current) {
        return;
      }

      const nextIncoming: FriendRequestSummary[] = [];
      const nextOutgoing: FriendRequestSummary[] = [];
      const nextAccepted: AcceptedFriendSummary[] = [];

      friendships.forEach((row) => {
        const friendUserId = row.requester_id === userId ? row.addressee_id : row.requester_id;
        if (!friendUserId) {
          return;
        }

        if (row.status === "pending") {
          const entry: FriendRequestSummary = {
            friendshipId: row.id,
            friendUserId,
            createdAt: row.created_at,
            status: row.status,
            profile: profileMap[friendUserId],
          };

          if (row.addressee_id === userId) {
            nextIncoming.push(entry);
          } else if (row.requester_id === userId) {
            nextOutgoing.push(entry);
          }
        } else if (row.status === "accepted") {
          nextAccepted.push({
            friendshipId: row.id,
            friendUserId,
            acceptedAt: row.updated_at ?? row.created_at,
            status: row.status,
            profile: profileMap[friendUserId],
          });
        }
      });

      nextIncoming.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
      nextOutgoing.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
      nextAccepted.sort((a, b) => toTimestamp(b.acceptedAt) - toTimestamp(a.acceptedAt));

      setIncomingRequests(nextIncoming);
      setOutgoingRequests(nextOutgoing);
      setAcceptedFriends(nextAccepted);

      const acceptedIds = Array.from(acceptedFriendIds).filter(Boolean).sort();
      setTrackedFriendIds((previous) => {
        const previousKey = previous.join(",");
        const nextKey = acceptedIds.join(",");
        if (previousKey === nextKey) {
          return previous;
        }
        return acceptedIds;
      });
      setPresenceByUserId((previous) => {
        const next: Record<string, PresenceStatus> = {};
        acceptedIds.forEach((id) => {
          if (previous[id]) {
            next[id] = previous[id];
          }
        });
        return next;
      });
    } catch (caughtError) {
      const fallback = "Unable to load friendships";
      const message =
        caughtError instanceof Error ? caughtError.message : typeof caughtError === "string" ? caughtError : fallback;

      console.error("Error fetching friendships:", caughtError);
      if (isMountedRef.current) {
        setError(message || fallback);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    void fetchFriendships();
  }, [fetchFriendships]);

  useEffect(() => {
    if (!trackedFriendIds.length) {
      return;
    }

    void refreshPresence(trackedFriendIds);
  }, [refreshPresence, trackedFriendIds]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`friendships-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships", filter: `requester_id=eq.${userId}` },
        () => {
          void fetchFriendships();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${userId}` },
        () => {
          void fetchFriendships();
        }
      );

    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, fetchFriendships]);

  const trackedFriendIdsKey = useMemo(() => trackedFriendIds.join(","), [trackedFriendIds]);

  useEffect(() => {
    if (!trackedFriendIds.length) {
      return;
    }

    const filter =
      trackedFriendIds.length === 1
        ? `user_id=eq.${trackedFriendIds[0]}`
        : `user_id=in.(${trackedFriendIds.join(",")})`;

    const channel = supabase
      .channel(`friend-presence-${userId ?? "anonymous"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_participants", filter },
        (payload: RealtimePostgresChangesPayload<ChatParticipantRow>) => {
          if (!isMountedRef.current) {
            return;
          }

          setPresenceByUserId((previous) => {
            const next = { ...previous };
            const newParticipant = payload.new as ChatParticipantRow | null;
            const oldParticipant = payload.old as ChatParticipantRow | null;

            if (payload.eventType === "DELETE" || !newParticipant) {
              const userKey = oldParticipant?.user_id ?? newParticipant?.user_id;
              if (userKey) {
                delete next[userKey];
              }
            } else if (newParticipant.user_id) {
              next[newParticipant.user_id] = newParticipant.status;
            }

            return next;
          });
        }
      );

    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [trackedFriendIdsKey, trackedFriendIds, userId]);

  const acceptFriendship = useCallback(
    async (friendshipId: string) => {
      if (!friendshipId) {
        return;
      }

      const { error: acceptError } = await supabase
        .from("friendships")
        .update({ status: "accepted" satisfies FriendshipStatus })
        .eq("id", friendshipId);

      if (acceptError) {
        throw acceptError;
      }

      await fetchFriendships();
    },
    [fetchFriendships]
  );

  const declineFriendship = useCallback(
    async (friendshipId: string) => {
      if (!friendshipId) {
        return;
      }

      const { error: declineError } = await supabase
        .from("friendships")
        .update({ status: "declined" satisfies FriendshipStatus })
        .eq("id", friendshipId);

      if (declineError) {
        throw declineError;
      }

      await fetchFriendships();
    },
    [fetchFriendships]
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
    refresh: fetchFriendships,
  };
};
