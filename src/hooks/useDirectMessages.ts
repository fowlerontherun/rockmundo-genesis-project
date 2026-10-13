import { useEffect, useRef } from "react";
import { useQuery, useInfiniteQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { getActiveProfile } from "@/services/profileService";
import { countUnreadConversations } from "@/features/direct-messages/services/unreadConversations";
import { mergeMessagePages, nextMessageCursor } from "@/features/direct-messages/services/messageHistory";
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
  const retryIdentity = useRef<{ key: string; id: string } | null>(null);
  const groupConversationId = otherProfileId?.startsWith("group-")
    ? otherProfileId.slice("group-".length)
    : null;
  const directOtherProfileId = groupConversationId ? null : otherProfileId;
  const directChannelId =
    myProfileId && directOtherProfileId ? buildChannelId(myProfileId, directOtherProfileId) : null;
  const channelId = groupConversationId ? `group:${groupConversationId}` : directChannelId;

  const conversationQuery = useQuery({
    queryKey: ["direct-conversation", myProfileId, directOtherProfileId],
    enabled: !!myProfileId && !!directOtherProfileId,
    queryFn: async () => {
      if (!directOtherProfileId) return null;
      return startDirectConversation(directOtherProfileId);
    },
  });

  const conversationId = groupConversationId ?? conversationQuery.data?.conversation_id ?? null;

  const messagesQuery = useInfiniteQuery({
    queryKey: ["direct-messages", myProfileId, conversationId ?? channelId],
    enabled: !!myProfileId && !!channelId && (!!groupConversationId || !!conversationId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<DirectMessageRow[]> => {
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
      if (pageParam) query = query.lt("created_at", pageParam);
      // Include older idempotent-fallback rows alongside the established thread.
      // Those rows have the same pair channel_id but no conversation_id.
      query = conversationId
        ? query.or(`conversation_id.eq.${conversationId},and(conversation_id.is.null,channel_id.eq.${directChannelId})`)
        : query.eq("channel_id", directChannelId);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as DirectMessageRow[]).reverse();
    },
    getNextPageParam: (lastPage) => nextMessageCursor(lastPage, 100),
  });

  useEffect(() => {
    if (!channelId) return;
    const filter = groupConversationId
      ? `conversation_id=eq.${groupConversationId}`
      : conversationId ? `conversation_id=eq.${conversationId}` : `channel_id=eq.${directChannelId}`;
    const channel = supabase
      .channel(`dm-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
          filter,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["direct-messages", myProfileId, conversationId ?? channelId] });
          queryClient.invalidateQueries({ queryKey: ["direct-conversation", myProfileId, directOtherProfileId] });
          queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
          queryClient.invalidateQueries({ queryKey: ["mobile-conversations", myProfileId] });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void queryClient.invalidateQueries({ queryKey: ["direct-messages", myProfileId, conversationId ?? channelId] });
          void queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
        }
      });
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
      void supabase.removeChannel(channel);
    };
  }, [channelId, conversationId, directChannelId, directOtherProfileId, groupConversationId, queryClient, myProfileId]);

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!myProfileId) throw new Error("Missing active character");
      if (conversationId) {
        const identity = `${conversationId}:${body}`;
        if (retryIdentity.current?.key !== identity) retryIdentity.current = { key: identity, id: crypto.randomUUID() };
        await sendConversationMessage(conversationId, body, retryIdentity.current.id);
      } else if (directOtherProfileId) {
        const identity = `fallback:${myProfileId}:${directOtherProfileId}:${body}`;
        if (retryIdentity.current?.key !== identity) {
          retryIdentity.current = { key: identity, id: crypto.randomUUID() };
        }
        await sendDirectMessageService(directOtherProfileId, body, retryIdentity.current.id);
      } else {
        throw new Error("Missing conversation");
      }
    },
    onSuccess: () => {
      retryIdentity.current = null;
      queryClient.invalidateQueries({ queryKey: ["direct-messages", myProfileId, conversationId ?? channelId] });
      queryClient.invalidateQueries({ queryKey: ["mobile-conversations", myProfileId] });
    },
  });

  const markRead = useMutation({
    mutationFn: async () => {
      if (!myProfileId) return;
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
    messages: mergeMessagePages(messagesQuery.data?.pages ?? []),
    hasOlderMessages: Boolean(messagesQuery.hasNextPage),
    isLoadingOlderMessages: messagesQuery.isFetchingNextPage,
    loadOlderMessages: () => messagesQuery.fetchNextPage(),
    conversationId,
    isGroupConversation: Boolean(groupConversationId),
    isLoading: messagesQuery.isLoading || conversationQuery.isLoading,
    error: messagesQuery.error ?? conversationQuery.error,
    isError: messagesQuery.isError || conversationQuery.isError,
    retry: () => Promise.all([messagesQuery.refetch(), conversationQuery.refetch()]),
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
