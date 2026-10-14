import { useEffect, useRef } from "react";
import { useQuery, useInfiniteQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { getActiveProfile } from "@/services/profileService";
import { countUnreadConversations } from "@/features/direct-messages/services/unreadConversations";
import { mergeMessagePages, nextMessageCursor } from "@/features/direct-messages/services/messageHistory";
import { directMessageHistoryFilter, nextDirectMessageCursor } from "@/features/direct-messages/services/directMessageKeyset";
import { MessageRetryIdentities } from "@/features/direct-messages/services/messageRetryIdentity";
import { sendDirectMessage as sendDirectMessageService } from "@/features/direct-messages/services/directMessages";
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
  const retryIdentities = useRef(new MessageRetryIdentities());
  const { profileId: activeProfileId } = useActiveProfile();
  const isCurrentCharacter = Boolean(myProfileId && activeProfileId === myProfileId);
  const groupConversationId = otherProfileId?.startsWith("group-")
    ? otherProfileId.slice("group-".length)
    : null;
  const directOtherProfileId = groupConversationId ? null : otherProfileId;
  const directChannelId =
    myProfileId && directOtherProfileId ? buildChannelId(myProfileId, directOtherProfileId) : null;
  const channelId = groupConversationId ? `group:${groupConversationId}` : directChannelId;

  const conversationQuery = useQuery({
    queryKey: ["direct-conversation", myProfileId, directOtherProfileId, activeProfileId],
    enabled: isCurrentCharacter && !!directOtherProfileId,
    queryFn: async () => {
      if (!directOtherProfileId) return null;
      return startDirectConversation(directOtherProfileId);
    },
  });

  const conversationId = groupConversationId ?? conversationQuery.data?.conversation_id ?? null;

  const messagesQuery = useInfiniteQuery({
    queryKey: ["direct-messages", myProfileId, conversationId ?? channelId, activeProfileId],
    enabled: isCurrentCharacter && !!channelId &&
      (!!groupConversationId || !!conversationId || conversationQuery.isError),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<DirectMessageRow[]> => {
      if (!isCurrentCharacter) throw new Error("Active character changed during message loading.");
      if (groupConversationId) {
        const messages = await getConversationMessages(groupConversationId, { limit: 100, cursor: pageParam });
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
      // Scope the conversation and the full (created_at,id) cursor in a
      // single OR predicate. A separate .or() would overwrite the scope.
      query = query.or(directMessageHistoryFilter(conversationId, directChannelId, pageParam));
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as DirectMessageRow[]).reverse();
    },
    getNextPageParam: (lastPage) => groupConversationId
      ? nextMessageCursor(lastPage, 100)
      : nextDirectMessageCursor(lastPage, 100),
  });

  useEffect(() => {
    if (!channelId || !isCurrentCharacter) return;
    const targets = groupConversationId
      ? [{ name: "group", filter: `conversation_id=eq.${groupConversationId}`, fallback: false }]
      : conversationId
        ? [
            { name: "canonical", filter: `conversation_id=eq.${conversationId}`, fallback: false },
            { name: "fallback", filter: `channel_id=eq.${directChannelId}`, fallback: true },
          ]
        : [{ name: "pair", filter: `channel_id=eq.${directChannelId}`, fallback: false }];

    const invalidateThread = () => {
      void queryClient.invalidateQueries({ queryKey: ["direct-messages", myProfileId] });
      void queryClient.invalidateQueries({ queryKey: ["direct-conversation", myProfileId] });
      void queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
      void queryClient.invalidateQueries({ queryKey: ["mobile-conversations", myProfileId] });
    };
    const channels = targets.map((target) => supabase
      .channel(`dm-${channelId}-${target.name}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
          filter: target.filter,
        },
        (payload) => {
          // The channel_id filter also matches canonical rows; their own
          // listener handles those, so process only unlinked fallback events.
          const row = (payload.new ?? payload.old) as Partial<DirectMessageRow> & { conversation_id?: string | null };
          if (target.fallback && row.conversation_id != null) return;
          invalidateThread();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void queryClient.invalidateQueries({ queryKey: ["direct-messages", myProfileId] });
          void queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
        }
      }));

    const timer = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["direct-messages", myProfileId, conversationId ?? channelId] });
    }, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void queryClient.invalidateQueries({ queryKey: ["direct-messages", myProfileId, conversationId ?? channelId] });
        void queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      channels.forEach((channel) => void supabase.removeChannel(channel));
    };
  }, [channelId, conversationId, directChannelId, directOtherProfileId, groupConversationId, queryClient, myProfileId, isCurrentCharacter]);

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!isCurrentCharacter || !myProfileId) {
        throw new Error("Active character changed. Reopen this conversation before sending.");
      }
      if (directOtherProfileId && !conversationId && !conversationQuery.isError) {
        // A pending canonical thread lookup is not evidence that we should
        // persist a separate legacy fallback message.
        throw new Error("Conversation is still opening. Try sending again shortly.");
      }
      const trimmed = body.trim();
      let identity: string;
      if (conversationId) {
        identity = `canonical:${myProfileId}:${conversationId}:${trimmed}`;
        const messageId = retryIdentities.current.getOrCreate(identity, () => crypto.randomUUID());
        await sendConversationMessage(conversationId, body, messageId);
        return { identity, messageId };
      }
      if (directOtherProfileId && conversationQuery.isError) {
        // Use legacy idempotent sending only after an explicit failed lookup.
        identity = `fallback:${myProfileId}:${directOtherProfileId}:${trimmed}`;
        const messageId = retryIdentities.current.getOrCreate(identity, () => crypto.randomUUID());
        await sendDirectMessageService(directOtherProfileId, body, messageId);
        return { identity, messageId };
      }
      throw new Error("Conversation is not available for sending.");
    },
    onSuccess: ({ identity, messageId }) => {
      retryIdentities.current.confirm(identity, messageId);
      void queryClient.invalidateQueries({ queryKey: ["direct-messages", myProfileId] });
      void queryClient.invalidateQueries({ queryKey: ["mobile-conversations", myProfileId] });
    },
  });

  const markRead = useMutation({
    mutationFn: async () => {
      if (!isCurrentCharacter || !myProfileId) throw new Error("Active character changed during read.");
      if (conversationId) {
        const { error } = await (supabase as any).rpc("mark_conversation_read", { conversation_id: conversationId, read_message_id: null });
        if (error) throw error;
      }
      if (directChannelId) {
        // The conversation RPC does not cover previously sent fallback rows.
        const { error } = await (supabase as any)
          .from("direct_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("channel_id", directChannelId)
          .is("conversation_id", null)
          .eq("recipient_profile_id", myProfileId)
          .is("read_at", null);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
      queryClient.invalidateQueries({ queryKey: ["mobile-conversations", myProfileId] });
    },
  });

  return {
    channelId,
    messages: isCurrentCharacter ? mergeMessagePages(messagesQuery.data?.pages ?? []) : [],
    hasOlderMessages: isCurrentCharacter && Boolean(messagesQuery.hasNextPage),
    isLoadingOlderMessages: messagesQuery.isFetchingNextPage,
    loadOlderMessages: () => isCurrentCharacter
      ? messagesQuery.fetchNextPage()
      : Promise.reject(new Error("Active character changed during message paging.")),
    conversationId: isCurrentCharacter ? conversationId : null,
    isGroupConversation: Boolean(groupConversationId),
    isLoading: isCurrentCharacter && (messagesQuery.isLoading || conversationQuery.isLoading),
    error: messagesQuery.error ?? conversationQuery.error,
    isError: messagesQuery.isError || conversationQuery.isError,
    retry: () => isCurrentCharacter
      ? Promise.all([messagesQuery.refetch(), conversationQuery.refetch()])
      : Promise.reject(new Error("Active character changed during message retrieval.")),
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
