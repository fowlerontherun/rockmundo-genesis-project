import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export interface ChatRoomMessage {
  id: string;
  user_id: string;
  profile_id: string | null;
  channel: string;
  message: string;
  created_at: string;
  displayName: string;
}

const MESSAGE_LIMIT = 80;

/**
 * Realtime room chat backed by public.global_chat.
 * Channel keys: "world" | "help" | "recruit" | `band:${bandId}`.
 */
export function useChatRoom(channelKey: string | null) {
  const { user } = useAuth();
  const { profileId } = useActiveProfile();
  const userId = user?.id ?? null;
  const [messages, setMessages] = useState<ChatRoomMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const nameCacheRef = useRef<Record<string, string>>({});

  const fetchMessages = useCallback(async () => {
    if (!channelKey) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("global_chat")
        .select("id, user_id, profile_id, channel, message, created_at")
        .eq("channel", channelKey)
        .order("created_at", { ascending: false })
        .limit(MESSAGE_LIMIT);

      if (error) throw error;

      const rows = ((data ?? []) as any[]).slice().reverse();

      const missingProfileIds = Array.from(
        new Set(
          rows
            .map((row) => row.profile_id as string | null)
            .filter((id): id is string => Boolean(id) && !nameCacheRef.current[id]),
        ),
      );
      const missingUserIds = Array.from(
        new Set(
          rows
            .filter((row) => !row.profile_id)
            .map((row) => row.user_id as string)
            .filter((id) => !nameCacheRef.current[id]),
        ),
      );

      if (missingProfileIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", missingProfileIds);
        (profiles ?? []).forEach((p: any) => {
          nameCacheRef.current[p.id] =
            p.display_name?.trim() || p.username?.trim() || String(p.id).slice(0, 8);
        });
      }

      if (missingUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, username")
          .in("user_id", missingUserIds);
        (profiles ?? []).forEach((p: any) => {
          if (!p?.user_id) return;
          nameCacheRef.current[p.user_id] =
            p.display_name?.trim() || p.username?.trim() || String(p.user_id).slice(0, 8);
        });
      }

      setMessages(
        rows.map((row) => {
          const key = (row.profile_id as string | null) ?? (row.user_id as string);
          return {
            ...row,
            displayName: nameCacheRef.current[key] ?? String(key).slice(0, 8),
          } as ChatRoomMessage;
        }),
      );
    } catch (error) {
      console.error("Failed to load room messages", error);
    } finally {
      setLoading(false);
    }
  }, [channelKey]);

  useEffect(() => {
    setLoading(true);
    void fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!channelKey) return;

    const channel = supabase
      .channel(`room-chat-${channelKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "global_chat",
          filter: `channel=eq.${channelKey}`,
        },
        () => {
          void fetchMessages();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelKey, fetchMessages]);

  const sendMessage = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || !channelKey || !userId) return false;

      setSending(true);
      try {
        const { error } = await supabase.from("global_chat").insert({
          user_id: userId,
          profile_id: profileId,
          channel: channelKey,
          message: body.slice(0, 500),
        } as any);

        if (error) throw error;
        await fetchMessages();
        return true;
      } catch (error) {
        console.error("Failed to send message", error);
        toast.error("Message could not be sent");
        return false;
      } finally {
        setSending(false);
      }
    },
    [channelKey, fetchMessages, profileId, userId],
  );

  return { messages, loading, sending, sendMessage, canPost: Boolean(userId && channelKey) };
}
