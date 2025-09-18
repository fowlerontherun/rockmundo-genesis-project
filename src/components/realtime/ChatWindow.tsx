import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { MessageSquare, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/sonner-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { DEFAULT_CITY_CHANNEL } from "@/utils/chat";

interface ChatMessage {
  id: string;
  message: string;
  user_id: string;
  channel?: string | null;
  created_at?: string | null;
  username?: string | null;
}

export interface ChatWindowProps {
  channel: string;
  title?: string;
  hideHeader?: boolean;
  className?: string;
  messagePlaceholder?: string;
  onOnlineCountChange?: (count: number) => void;
  onConnectionStatusChange?: (connected: boolean) => void;
}

const sanitizeChannel = (channel: string) => {
  const trimmed = channel.trim();
  return trimmed.length > 0 ? trimmed : "general";
};

const ChatWindow: React.FC<ChatWindowProps> = ({
  channel,
  title = "Chat",
  hideHeader = false,
  className,
  messagePlaceholder = "Type your message...",
  onOnlineCountChange,
  onConnectionStatusChange
}) => {
  const { user } = useAuth();
  const { profile } = useGameData();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  const effectiveChannel = useMemo(() => sanitizeChannel(channel), [channel]);

  useEffect(() => {
    onOnlineCountChange?.(onlineCount);
  }, [onlineCount, onOnlineCountChange]);

  useEffect(() => {
    onConnectionStatusChange?.(isConnected);
  }, [isConnected, onConnectionStatusChange]);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      setOnlineCount(0);
      setIsConnected(false);
      onOnlineCountChange?.(0);
      onConnectionStatusChange?.(false);
      return;
    }

    let isMounted = true;
    const realtimeChannel = supabase.channel(`chat-${effectiveChannel}`);

    setMessages([]);
    setCurrentMessage("");
    setOnlineCount(0);
    setIsConnected(false);
    onOnlineCountChange?.(0);
    onConnectionStatusChange?.(false);

    const refreshPresence = async () => {
      const { count, error } = await supabase
        .from("chat_participants")
        .select("id", { count: "exact", head: true })
        .eq("channel", effectiveChannel);

      if (error) {
        console.error("Error refreshing presence:", error);
        return;
      }

      if (isMounted) {
        setOnlineCount(count ?? 0);
      }
    };

    const loadInitialMessages = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("channel", effectiveChannel)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) {
        console.error("Error loading messages:", error);
        toast.error("Failed to load chat history.");
        return;
      }

      if (data && isMounted) {
        setMessages(data as ChatMessage[]);
      }
    };

    const registerPresence = async () => {
      const { error } = await supabase
        .from("chat_participants")
        .upsert(
          {
            user_id: user.id,
            channel: effectiveChannel,
            status: "online"
          },
          { onConflict: "user_id" }
        );

      if (error) {
        console.error("Error registering presence:", error);
      }
    };

    void (async () => {
      await Promise.all([loadInitialMessages(), registerPresence()]);
      await refreshPresence();
    })();

    realtimeChannel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `channel=eq.${effectiveChannel}`
      },
      payload => {
        if (!isMounted) {
          return;
        }

        const newMessage = payload.new as ChatMessage;
        setMessages(previous => [...previous, newMessage]);
      }
    );

    realtimeChannel.on(
      "postgres_changes",
      {
        schema: "public",
        table: "chat_participants",
        filter: `channel=eq.${effectiveChannel}`
      },
      () => {
        if (!isMounted) {
          return;
        }

        void refreshPresence();
      }
    );

    void realtimeChannel.subscribe(status => {
      if (!isMounted) {
        return;
      }

      if (status === "SUBSCRIBED") {
        setIsConnected(true);
      }

      if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setIsConnected(false);
      }
    });

    return () => {
      isMounted = false;
      onOnlineCountChange?.(0);
      onConnectionStatusChange?.(false);

      void realtimeChannel.unsubscribe();

      void supabase
        .from("chat_participants")
        .delete()
        .eq("user_id", user.id)
        .eq("channel", effectiveChannel)
        .catch(error => {
          console.error("Error unregistering presence:", error);
        });
    };
  }, [effectiveChannel, onConnectionStatusChange, onOnlineCountChange, user]);

  const resolvedDisplayName = useMemo(() => {
    if (profile?.display_name && profile.display_name.trim().length > 0) {
      return profile.display_name;
    }

    if (profile?.username && profile.username.trim().length > 0) {
      return profile.username;
    }

    return "You";
  }, [profile?.display_name, profile?.username]);

  const sendMessage = useCallback(async () => {
    if (!currentMessage.trim() || !user) {
      return;
    }

    try {
      const { error } = await supabase
        .from("chat_messages")
        .insert({
          user_id: user.id,
          message: currentMessage.trim(),
          channel: effectiveChannel
        });

      if (error) throw error;

      setCurrentMessage("");
      toast.success("Message sent!");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message.");
    }
  }, [currentMessage, effectiveChannel, user]);

  return (
    <div className={cn("space-y-4", className)}>
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <span className="font-semibold">{title}</span>
          </div>
          <Badge variant="secondary">{onlineCount}</Badge>
        </div>
      )}

      <ScrollArea className="h-80">
        <div className="space-y-3 p-1">
          {messages.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 text-sm">
              No messages yet. Be the first to start the conversation!
            </p>
          ) : (
            messages.map(message => {
              const displayName = message.username && message.username.trim().length > 0
                ? message.username
                : message.user_id === user?.id
                  ? resolvedDisplayName
                  : "User";

              return (
                <div
                  key={message.id}
                  className="flex gap-3 p-3 rounded-lg bg-muted"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{displayName}</span>
                    </div>
                    <p className="text-sm">{message.message}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="flex gap-2">
        <Input
          value={currentMessage}
          onChange={event => setCurrentMessage(event.target.value)}
          placeholder={messagePlaceholder}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
          className="flex-1"
          disabled={!user}
        />
        <Button
          onClick={() => void sendMessage()}
          disabled={!currentMessage.trim() || !user}
          size="sm"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatWindow;
