import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

  const messagesQuery = useQuery({
    queryKey: ["direct-messages", conversationId ?? channelId],
    enabled: !!myProfileId && !!channelId,
    queryFn: async (): Promise<DirectMessageRow[]> => {
      if (groupConversationId) {
        const messages = await getConversationMessages(groupConversationId, { limit: 100 });
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
        .order("created_at", { ascending: true })
        .limit(100);
      query = conversationId ? query.eq("conversation_id", conversationId) : query.eq("channel_id", directChannelId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DirectMessageRow[];
    },
  });

  useEffect(() => {
    if (!channelId) return;
    const filter = groupConversationId
      ? `conversation_id=eq.${groupConversationId}`
      : `channel_id=eq.${directChannelId}`;
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
          queryClient.invalidateQueries({ queryKey: ["direct-messages", conversationId ?? channelId] });
          queryClient.invalidateQueries({ queryKey: ["direct-conversation", myProfileId, directOtherProfileId] });
          queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
          queryClient.invalidateQueries({ queryKey: ["mobile-conversations", myProfileId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, conversationId, directChannelId, directOtherProfileId, groupConversationId, queryClient, myProfileId]);

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!myProfileId) throw new Error("Missing active character");
      if (conversationId) {
        await sendConversationMessage(conversationId, body, crypto.randomUUID());
      } else if (directOtherProfileId) {
        await sendDirectMessageService(directOtherProfileId, body);
      } else {
        throw new Error("Missing conversation");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["direct-messages", conversationId ?? channelId] });
      queryClient.invalidateQueries({ queryKey: ["mobile-conversations", myProfileId] });
    },
  });

  const markRead = useMutation({
    mutationFn: async () => {
      if (!myProfileId) return;
      if (conversationId) {
        await (supabase as any).rpc("mark_conversation_read", { conversation_id: conversationId, read_message_id: null });
      } else if (directChannelId) {
        await (supabase as any)
          .from("direct_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("channel_id", directChannelId)
          .eq("recipient_profile_id", myProfileId)
          .is("read_at", null);
      }
      queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
      queryClient.invalidateQueries({ queryKey: ["mobile-conversations", myProfileId] });
    },
  });

  return {
    channelId,
    messages: messagesQuery.data ?? [],
    conversationId,
    isGroupConversation: Boolean(groupConversationId),
    isLoading: messagesQuery.isLoading || conversationQuery.isLoading,
    sendMessage,
    markRead,
  };
}

export function useUnreadDirectMessageCount(myProfileId?: string | null) {
  return useQuery({
    queryKey: ["dm-unread", myProfileId],
    enabled: !!myProfileId,
    queryFn: async () => {
      if (!myProfileId) return 0;
      const conversations = await listConversations({ limit: 100 });
      return conversations.reduce((total, conversation) => total + conversation.unread_count, 0);
    },
  });
}
