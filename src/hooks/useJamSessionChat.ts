import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

export interface ChatMessage {
  id: string;
  session_id: string;
  profile_id: string;
  message: string;
  message_type: string;
  created_at: string;
  profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface ChatPresence {
  profile_id: string;
  display_name: string;
  avatar_url?: string;
  online_at: string;
}

export const useJamSessionChat = (sessionId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [presence, setPresence] = useState<ChatPresence[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Fetch chat messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["jam-session-chat", sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      
      const { data, error } = await supabase
        .from("jam_session_chat")
        .select(`
          *,
          profile:profiles!jam_session_chat_profile_id_fkey(display_name, username, avatar_url)
        `)
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as ChatMessage[];
    },
    enabled: !!sessionId,
  });

  // Get current user's profile
  const { data: myProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Subscribe to real-time chat updates
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`jam-chat-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "jam_session_chat",
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["jam-session-chat", sessionId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);

  // Presence tracking
  useEffect(() => {
    if (!sessionId || !myProfile) return;

    const presenceChannel = supabase.channel(`jam-presence-${sessionId}`, {
      config: { presence: { key: myProfile.id } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const onlineUsers: ChatPresence[] = [];
        
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          if (presences.length > 0) {
            onlineUsers.push({
              profile_id: key,
              display_name: presences[0].display_name || "Unknown",
              avatar_url: presences[0].avatar_url,
              online_at: presences[0].online_at,
            });
          }
        });
        
        setPresence(onlineUsers);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            display_name: myProfile.display_name || myProfile.username,
            avatar_url: myProfile.avatar_url,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [sessionId, myProfile]);

  const sendMessage = useCallback(async (message: string) => {
    if (!sessionId || !myProfile || !message.trim()) return;

    setIsSending(true);
    try {
      await supabase
        .from("jam_session_chat")
        .insert({
          session_id: sessionId,
          profile_id: myProfile.id,
          message: message.trim(),
          message_type: "chat",
        });
    } finally {
      setIsSending(false);
    }
  }, [sessionId, myProfile]);

  return {
    messages,
    presence,
    isLoading,
    isSending,
    sendMessage,
    myProfileId: myProfile?.id,
  };
};
