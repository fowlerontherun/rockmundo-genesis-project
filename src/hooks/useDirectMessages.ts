import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sendDirectMessage as sendDirectMessageService } from "@/features/direct-messages/services/directMessages";
import { sendConversationMessage, startDirectConversation } from "@/features/direct-messages/services/conversations";

export interface DirectMessageRow {
  id: string;
  channel_id: string;
  sender_profile_id: string;
  recipient_profile_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export function buildChannelId(a: string, b: string) {
  return [a, b].sort().join(":");
}

export function useDirectMessages(myProfileId?: string | null, otherProfileId?: string | null) {
  const queryClient = useQueryClient();
  const channelId =
    myProfileId && otherProfileId ? buildChannelId(myProfileId, otherProfileId) : null;

  const conversationQuery = useQuery({
    queryKey: ["direct-conversation", myProfileId, otherProfileId],
    enabled: !!myProfileId && !!otherProfileId,
    queryFn: async () => {
      if (!otherProfileId) return null;
      return startDirectConversation(otherProfileId);
    },
  });

  const conversationId = conversationQuery.data?.conversation_id ?? null;

  const messagesQuery = useQuery({
    queryKey: ["direct-messages", conversationId ?? channelId],
    enabled: !!channelId,
    queryFn: async (): Promise<DirectMessageRow[]> => {
      if (!channelId) return [];
      let query = (supabase as any)
        .from("direct_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100);
      query = conversationId ? query.eq("conversation_id", conversationId) : query.eq("channel_id", channelId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DirectMessageRow[];
    },
  });

  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`dm-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["direct-messages", conversationId ?? channelId] });
          queryClient.invalidateQueries({ queryKey: ["direct-conversation", myProfileId, otherProfileId] });
          queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, conversationId, queryClient, myProfileId, otherProfileId]);

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!channelId || !myProfileId || !otherProfileId) {
        throw new Error("Missing channel");
      }
      if (conversationId) {
        await sendConversationMessage(conversationId, body, crypto.randomUUID());
      } else {
        await sendDirectMessageService(otherProfileId, body);
      }
    },
  });

  const markRead = useMutation({
    mutationFn: async () => {
      if (!channelId || !myProfileId) return;
      if (conversationId) {
        await (supabase as any).rpc("mark_conversation_read", { conversation_id: conversationId, read_message_id: null });
      } else {
        await (supabase as any)
          .from("direct_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("channel_id", channelId)
          .eq("recipient_profile_id", myProfileId)
          .is("read_at", null);
      }
      queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
    },
  });

  return {
    channelId,
    messages: messagesQuery.data ?? [],
    conversationId,
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
      const { count, error } = await (supabase as any)
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_profile_id", myProfileId)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
