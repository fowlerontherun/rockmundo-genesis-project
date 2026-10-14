import { useEffect, useRef } from "react";
import { useQuery, useInfiniteQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { getActiveProfile } from "@/services/profileService";
import { countUnreadConversations } from "@/features/direct-messages/services/unreadConversations";
import { mergeMessagePages, nextMessageCursor, nextDirectMessageCursor, directMessageHistoryPredicate, type DirectMessageCursor } from "@/features/direct-messages/services/messageHistory";
import {
  getConversationMessages,
  listConversations,
  sendConversationMessage,
  startDirectConversation,
} from "@/features/direct-messages/services/conversations";

export interface DirectMessageRow {
  id: string;
  channel_id: string;
  sender_profile_id: string;
  recipient_profile_id: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
}

export function buildChannelId(a: string, b: string) {
  return [a, b].sort().join(":");
}

export function useDirectMessages(myProfileId?: string | null, otherProfileId?: string | null) {
  const queryClient = useQueryClient();
  const retryIdentities = useRef(new Map<string, string>());
  const { profileId: activeProfileId, userId } = useActiveProfile();
  const isActiveCharacter = Boolean(userId && myProfileId && activeProfileId === myProfileId);
  const activeIdentityRef = useRef({ userId, activeProfileId });
  activeIdentityRef.current = { userId, activeProfileId };

  // Old mounted thread components must never write/read as the new character.
  const verifyActiveCharacter = async () => {
    if (!userId || !myProfileId || activeIdentityRef.current.userId !== userId ||
        activeIdentityRef.current.activeProfileId !== myProfileId) {
      throw new Error("Active character changed. Reopen this conversation.");
    }
    const activeProfile = await getActiveProfile(userId);
    if (activeProfile?.id !== myProfileId ||
        activeIdentityRef.current.userId !== userId ||
        activeIdentityRef.current.activeProfileId !== myProfileId) {
      throw new Error("Active character changed. Reopen this conversation.");
    }
  };

  const groupConversationId = otherProfileId?.startsWith("group-")
    ? otherProfileId.slice("group-".length)
    : null;
  const directOtherProfileId = groupConversationId ? null : otherProfileId;
  const directChannelId =
    isActiveCharacter && myProfileId && directOtherProfileId ? buildChannelId(myProfileId, directOtherProfileId) : null;
  const channelId = groupConversationId ? `group:${groupConversationId}` : directChannelId;

  const conversationQuery = useQuery({
    queryKey: ["direct-conversation", myProfileId, directOtherProfileId, activeProfileId],
    enabled: isActiveCharacter && !!directOtherProfileId,
    queryFn: async () => {
      if (!directOtherProfileId) return null;
      await verifyActiveCharacter();
      const conversation = await startDirectConversation(directOtherProfileId);
      await verifyActiveCharacter();
      return conversation;
    },
  });

  const conversationId = isActiveCharacter
    ? (groupConversationId ?? conversationQuery.data?.conversation_id ?? null)
    : null;
  const canSendMessage = isActiveCharacter && !!conversationId &&
    (Boolean(groupConversationId) || conversationQuery.isSuccess);

  const messagesQuery = useInfiniteQuery({
    queryKey: ["direct-messages", myProfileId, conversationId ?? channelId, activeProfileId],
    enabled: isActiveCharacter && !!channelId && !!conversationId,
    initialPageParam: null as string | DirectMessageCursor | null,
    queryFn: async ({ pageParam }): Promise<DirectMessageRow[]> => {
      await verifyActiveCharacter();
      if (groupConversationId) {
        const messages = await getConversationMessages(groupConversationId, {
          limit: 100, cursor: pageParam as string | null,
        });
        await verifyActiveCharacter();
        return messages.map((message) => ({
          id: message.id,
          channel_id: `group:${groupConversationId}`,
          sender_profile_id: message.sender_profile_id,
          recipient_profile_id: null,
          body: message.body,
          read_at: message.read_at,
          created_at: message.created_at,
        }));
      }
      if (!directChannelId) return [];
      let query = (supabase as any)
        .from("direct_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);
      // Apply the SAME keyset predicate to canonical and legacy rows in
      // one PostgREST OR: (created_at,id) < (cursor.created_at,cursor.id).
      query = conversationId
        ? query.or(directMessageHistoryPredicate(
            conversationId, directChannelId, pageParam as DirectMessageCursor | null,
          ))
        : query.eq("channel_id", directChannelId);
      const { data, error } = await query;
      if (error) throw error;
      await verifyActiveCharacter();
      return ((data ?? []) as DirectMessageRow[]).reverse();
    },
    getNextPageParam: (lastPage) => groupConversationId
      ? nextMessageCursor(lastPage, 100)
      : nextDirectMessageCursor(lastPage, 100),
  });

  useEffect(() => {
    if (!isActiveCharacter || !channelId || !myProfileId || !conversationId) return;

    const invalidateThread = () => {
      if (activeIdentityRef.current.activeProfileId !== myProfileId) return;
      void queryClient.invalidateQueries({ queryKey: ["direct-messages", myProfileId, conversationId, activeProfileId] });
      void queryClient.invalidateQueries({ queryKey: ["direct-conversation", myProfileId, directOtherProfileId] });
      void queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
      void queryClient.invalidateQueries({ queryKey: ["mobile-conversations", myProfileId] });
    };

    const listen = (name: string, filter: string) => supabase
      .channel(name)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "direct_messages",
        filter,
      }, invalidateThread)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") invalidateThread();
      });

    const channels = groupConversationId
      ? [listen(`dm-group-${groupConversationId}-${myProfileId}`,
          `conversation_id=eq.${groupConversationId}`)]
      : [
          listen(`dm-conversation-${conversationId}-${myProfileId}`,
            `conversation_id=eq.${conversationId}`),
          // Legacy idempotent direct messages may have no conversation_id.
          // Listening to the pair channel also wakes an established thread.
          listen(`dm-pair-${directChannelId}-${myProfileId}`,
            `channel_id=eq.${directChannelId}`),
        ];

    const timer = window.setInterval(invalidateThread, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") invalidateThread();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [isActiveCharacter, channelId, conversationId, directChannelId,
      directOtherProfileId, groupConversationId, queryClient, myProfileId, activeProfileId]);

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      await verifyActiveCharacter();
      if (!conversationId || !canSendMessage) {
        throw new Error("Conversation is still loading or unavailable. Try again once it opens.");
      }
      const identity = [myProfileId, conversationId, directOtherProfileId ?? "", body].join(":");
      // One retry token per *in-flight intent*. A completing request must
      // never clear a separate pending message's idempotency token.
      let id = retryIdentities.current.get(identity);
      if (!id) {
        id = crypto.randomUUID();
        retryIdentities.current.set(identity, id);
      }
      await verifyActiveCharacter();
      await sendConversationMessage(conversationId, body, id);
      return { identity, id };
    },
    onSuccess: ({ identity, id }) => {
      if (retryIdentities.current.get(identity) === id) {
        retryIdentities.current.delete(identity);
      }
      if (!isActiveCharacter) return;
      void queryClient.invalidateQueries({ queryKey: ["direct-messages", myProfileId, conversationId ?? channelId] });
      void queryClient.invalidateQueries({ queryKey: ["mobile-conversations", myProfileId] });
    },
  });

  const markRead = useMutation({
    mutationFn: async () => {
      await verifyActiveCharacter();
      if (!conversationId || !canSendMessage) return;
      const { error } = await (supabase as any).rpc("mark_conversation_read", {
        conversation_id: conversationId, read_message_id: null,
      });
      if (error) throw error;
      await verifyActiveCharacter();
      if (directChannelId) {
        // Canonical read RPC does not cover old fallback messages.
        const { error: fallbackError } = await (supabase as any)
          .from("direct_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("channel_id", directChannelId)
          .is("conversation_id", null)
          .eq("recipient_profile_id", myProfileId)
          .is("read_at", null);
        if (fallbackError) throw fallbackError;
      }
      await verifyActiveCharacter();
      void queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
      void queryClient.invalidateQueries({ queryKey: ["mobile-conversations", myProfileId] });
    },
  });

  return {
    channelId,
    messages: isActiveCharacter ? mergeMessagePages(messagesQuery.data?.pages ?? []) : [],
    canSendMessage,
    hasOlderMessages: isActiveCharacter && Boolean(messagesQuery.hasNextPage),
    isLoadingOlderMessages: messagesQuery.isFetchingNextPage,
    loadOlderMessages: () => isActiveCharacter
      ? messagesQuery.fetchNextPage()
      : Promise.reject(new Error("Active character changed")),
    conversationId,
    isGroupConversation: Boolean(groupConversationId),
    isLoading: isActiveCharacter && (messagesQuery.isLoading || conversationQuery.isLoading),
    error: messagesQuery.error ?? conversationQuery.error,
    isError: messagesQuery.isError || conversationQuery.isError,
    retry: () => isActiveCharacter
      ? Promise.all([messagesQuery.refetch(), conversationQuery.refetch()])
      : Promise.reject(new Error("Active character changed")),
    sendMessage,
    markRead,
  };
}

export function useUnreadDirectMessageCount(myProfileId?: string | null) {
  const queryClient = useQueryClient();
  const { userId, profileId: activeProfileId } = useActiveProfile();
  const query = useQuery({
    // The RPC determines its viewer from the active character. Never cache a
    // different character's unread messages under an old profile's key.
    queryKey: ["dm-unread", myProfileId, activeProfileId],
    enabled: !!userId && !!myProfileId && activeProfileId === myProfileId,
    queryFn: async () => {
      if (!myProfileId || !userId || activeProfileId !== myProfileId) return 0;
      const verifyActiveProfile = async () => {
        const activeProfile = await getActiveProfile(userId);
        if (activeProfile?.id !== myProfileId) {
          throw new Error("Active character changed while loading unread conversations");
        }
      };
      const conversationUnread = await countUnreadConversations(
        (options) => listConversations(options),
        verifyActiveProfile,
      );
      // Idempotent direct-send fallback may write outside an established
      // conversation; these incoming rows do not appear in RPC unread_count.
      await verifyActiveProfile();
      const { count, error } = await (supabase as any)
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_profile_id", myProfileId)
        .is("conversation_id", null)
        .is("read_at", null);
      if (error) throw error;
      await verifyActiveProfile();
      return conversationUnread + (count ?? 0);
    },
  });

  useEffect(() => {
    if (!myProfileId) return;
    const channel = supabase
      .channel(`dm-unread-${myProfileId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, (payload) => {
        const row = (payload.new ?? payload.old) as Partial<DirectMessageRow>;
        if (row.sender_profile_id === myProfileId || row.recipient_profile_id === myProfileId) {
          void queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
      });
    const timer = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
    }, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [myProfileId, queryClient]);

  return query;
}
