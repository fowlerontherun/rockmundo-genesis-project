import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sendDirectMessage as sendDirectMessageService } from "@/features/direct-messages/services/directMessages";

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

  const messagesQuery = useQuery({
    queryKey: ["direct-messages", channelId],
    enabled: !!channelId,
    queryFn: async (): Promise<DirectMessageRow[]> => {
      if (!channelId) return [];
      const { data, error } = await (supabase as any)
        .from("direct_messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(500);
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
          queryClient.invalidateQueries({ queryKey: ["direct-messages", channelId] });
          queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, queryClient, myProfileId]);

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!channelId || !myProfileId || !otherProfileId) {
        throw new Error("Missing channel");
      }
      await sendDirectMessageService(otherProfileId, body);
    },
  });

  const markRead = useMutation({
    mutationFn: async () => {
      if (!channelId || !myProfileId) return;
      await (supabase as any)
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("channel_id", channelId)
        .eq("recipient_profile_id", myProfileId)
        .is("read_at", null);
      queryClient.invalidateQueries({ queryKey: ["dm-unread", myProfileId] });
    },
  });

  return {
    channelId,
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
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
