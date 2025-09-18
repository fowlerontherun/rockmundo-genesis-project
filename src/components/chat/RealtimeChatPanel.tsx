import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner-toast";
import { cn } from "@/lib/utils";

interface AudioMeterHandle {
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  rafId: number;
}

export type ChatMessage = {
  id: string;
  message: string;
  user_id: string;
  channel?: string | null;
  created_at?: string | null;
  username?: string | null;
};

interface RealtimeChatPanelProps {
  channelKey: string;
  className?: string;
  title?: string;
}

export const RealtimeChatPanel: React.FC<RealtimeChatPanelProps> = ({
  channelKey,
  className,
  title = "Chat",
}) => {
  const { user } = useAuth();
  const { profile } = useGameData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const audioMetersRef = useRef<Record<string, AudioMeterHandle>>({});

  const destroyAudioMeter = useCallback((participantId: string) => {
    const meter = audioMetersRef.current[participantId];
    if (!meter) {
      return;
    }

    cancelAnimationFrame(meter.rafId);
    meter.source.disconnect();
    meter.analyser.disconnect();
    delete audioMetersRef.current[participantId];
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;
    const channel = supabase.channel(`realtime-communication-${channelKey}`);

    const refreshPresence = async () => {
      const { count, error } = await supabase
        .from("chat_participants")
        .select("id", { count: "exact", head: true })
        .eq("channel", channelKey);

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
        .eq("channel", channelKey)
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
            channel: channelKey,
            status: "online",
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

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel=eq.${channelKey}` },
      (payload) => {
        if (!isMounted) {
          return;
        }

        const newMessage = payload.new as ChatMessage;
        setMessages((previous) => [...previous, newMessage]);
      }
    );

    channel.on(
      "postgres_changes",
      { schema: "public", table: "chat_participants", filter: `channel=eq.${channelKey}` },
      () => {
        if (!isMounted) {
          return;
        }

        void refreshPresence();
      }
    );

    void channel.subscribe((status) => {
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
      if (isMounted) {
        setIsConnected(false);
      }
      isMounted = false;
      void channel.unsubscribe();

      void (async () => {
        const { error } = await supabase
          .from("chat_participants")
          .delete()
          .eq("user_id", user.id)
          .eq("channel", channelKey);

        if (error) {
          console.error("Error unregistering presence:", error);
        }
      })();
    };
  }, [channelKey, user]);

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
          channel: channelKey,
        });

      if (error) throw error;

      setCurrentMessage("");
      toast.success("Message sent!");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message.");
    }
  }, [channelKey, currentMessage, user]);

  useEffect(() => {
    const audioMeters = audioMetersRef.current;

    return () => {
      Object.keys(audioMeters).forEach((participantId) => {
        destroyAudioMeter(participantId);
      });
    };
  }, [destroyAudioMeter]);

  const getDisplayName = useCallback(
    (message: ChatMessage) => {
      if (message.username && message.username.trim().length > 0) {
        return message.username;
      }

      if (message.user_id === user?.id) {
        return profile?.display_name || profile?.username || "You";
      }

      return "User";
    },
    [profile?.display_name, profile?.username, user?.id]
  );

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="w-5 h-5" />
          <span>{title}</span>
          <Badge variant="secondary">{onlineCount}</Badge>
        </CardTitle>
        <div
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
            isConnected ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", isConnected ? "bg-emerald-500" : "bg-red-500")} />
          {isConnected ? "Connected" : "Connecting..."}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-80">
          <div className="space-y-3 pr-2">
            {messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No messages yet. Be the first to start the conversation!
              </p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex gap-3 rounded-lg bg-muted p-3">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-medium">{getDisplayName(message)}</span>
                    </div>
                    <p className="text-sm">{message.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            value={currentMessage}
            onChange={(event) => setCurrentMessage(event.target.value)}
            placeholder="Type your message..."
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            className="flex-1"
          />
          <Button onClick={() => void sendMessage()} disabled={!currentMessage.trim()} size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RealtimeChatPanel;
