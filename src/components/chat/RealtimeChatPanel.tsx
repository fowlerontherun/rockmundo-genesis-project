import React, { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SupabaseMessage {
  id: string;
  user_id: string;
  channel: string;
  message: string;
  created_at: string;
}

interface Message extends SupabaseMessage {
  displayName: string;
}

interface ProfileRecord {
  user_id: string;
  display_name: string | null;
  username: string | null;
}

interface RealtimeChatPanelProps {
  channelKey?: string;
  className?: string;
  title?: string;
  onConnectionStatusChange?: (connected: boolean) => void;
  onParticipantCountChange?: (count: number) => void;
}

export const RealtimeChatPanel: React.FC<RealtimeChatPanelProps> = ({
  channelKey = 'general',
  className = '',
  title = 'Chat',
  onConnectionStatusChange,
  onParticipantCountChange
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const profileCacheRef = useRef<Record<string, string>>({});
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!user) return;

    try {
      const { data: messageData, error: messageError } = await supabase
        .from('global_chat')
        .select(`
          id,
          user_id,
          channel,
          message,
          created_at
        `)
        .eq('channel', channelKey)
        .order('created_at', { ascending: true })
        .limit(100);

      if (messageError) throw messageError;

      const typedMessageData = (messageData || []) as SupabaseMessage[];

      const uniqueUserIds = Array.from(
        new Set(typedMessageData.map((msg) => msg.user_id))
      );

      const missingUserIds = uniqueUserIds.filter(
        (id) => !profileCacheRef.current[id]
      );

      if (missingUserIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, display_name, username')
          .in('user_id', missingUserIds);

        if (profileError) {
          console.error('Error fetching profiles:', profileError);
        }

        const newCacheEntries: Record<string, string> = {};

        const typedProfileData = (profileData || []) as ProfileRecord[];

        typedProfileData.forEach((profile) => {
          if (!profile?.user_id) return;

          const displayName =
            (typeof profile.display_name === 'string' && profile.display_name.trim()) ||
            (typeof profile.username === 'string' && profile.username.trim()) ||
            profile.user_id.slice(0, 8);

          newCacheEntries[profile.user_id] = displayName;
        });

        missingUserIds.forEach((id) => {
          if (!newCacheEntries[id]) {
            newCacheEntries[id] = id.slice(0, 8);
          }
        });

        if (Object.keys(newCacheEntries).length > 0) {
          profileCacheRef.current = {
            ...profileCacheRef.current,
            ...newCacheEntries
          };
        }
      }

      const hydratedMessages: Message[] = typedMessageData.map((msg) => {
        const cachedDisplayName = profileCacheRef.current[msg.user_id];
        const displayName = cachedDisplayName || msg.user_id.slice(0, 8);

        if (!cachedDisplayName) {
          profileCacheRef.current[msg.user_id] = displayName;
        }

        return {
          ...msg,
          displayName
        };
      });

      setMessages(hydratedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }
  }, [user, channelKey]);

  const sendMessage = useCallback(async () => {
    if (!user || !message.trim()) return;

    try {
      const { error } = await supabase
        .from('global_chat')
        .insert({
          user_id: user.id,
          channel: channelKey,
          message: message.trim()
        });

      if (error) throw error;
      
      setMessage('');
      await fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  }, [channelKey, fetchMessages, message, user]);

  useEffect(() => {
    if (user) {
      void fetchMessages();
    }
  }, [user, channelKey, fetchMessages]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLDivElement | null;

    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!user) {
      setIsConnected(false);
      setParticipantCount(0);
      onConnectionStatusChange?.(false);
      onParticipantCountChange?.(0);
      return;
    }

    let isMounted = true;
    const channelName = `global-chat-${channelKey}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: user.id }
      }
    });

    const updatePresence = () => {
      if (!isMounted) return;
      const presenceState = channel.presenceState<{ user_id: string }>();
      const participantIds = new Set<string>();

      Object.values(presenceState).forEach((entries) => {
        entries.forEach((entry) => {
          if (entry?.user_id) {
            participantIds.add(entry.user_id);
          }
        });
      });

      const count = participantIds.size;
      setParticipantCount(count);
      onParticipantCountChange?.(count);
    };

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'global_chat',
          filter: `channel=eq.${channelKey}`
        },
        () => {
          void fetchMessages();
        }
      )
      .on('presence', { event: 'sync' }, updatePresence)
      .on('presence', { event: 'join' }, updatePresence)
      .on('presence', { event: 'leave' }, updatePresence)
      .subscribe((status) => {
        if (!isMounted) return;

        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          onConnectionStatusChange?.(true);
          void channel
            .track({ user_id: user.id })
            .then(() => {
              if (isMounted) {
                updatePresence();
              }
            })
            .catch((presenceError) => {
              console.error('Error updating presence:', presenceError);
            });
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          setIsConnected(false);
          onConnectionStatusChange?.(false);
        }
      });

    return () => {
      isMounted = false;
      setIsConnected(false);
      setParticipantCount(0);
      onConnectionStatusChange?.(false);
      onParticipantCountChange?.(0);
      supabase.removeChannel(channel);
    };
  }, [user, channelKey, fetchMessages, onConnectionStatusChange, onParticipantCountChange]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const renderHeaderMeta = () => (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1",
          isConnected ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
        )}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            isConnected ? "bg-emerald-500" : "bg-amber-500"
          )}
        />
        {isConnected ? "Connected" : "Connecting"}
      </div>
      <Badge variant="secondary" className="border-border/40 bg-muted/50 text-foreground/70">
        {participantCount} online
      </Badge>
    </div>
  );

  if (!user) {
    return (
      <Card className={cn("flex h-full flex-col", className)}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center p-6">
          <p className="text-center text-muted-foreground">
            Please log in to use the chat
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          {renderHeaderMeta()}
        </div>
        <p className="text-xs text-muted-foreground">Channel: {channelKey}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 p-4">
        <ScrollArea
          ref={scrollAreaRef}
          className="flex-1 max-h-64 rounded-md border border-border/50 bg-muted/20 p-3"
        >
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className="rounded-md bg-muted/60 p-2">
                <div className="text-xs font-semibold text-muted-foreground">
                  {msg.displayName}
                </div>
                <div className="text-sm text-foreground">{msg.message}</div>
                <div className="text-[10px] text-muted-foreground/80">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-center text-xs text-muted-foreground">
                No messages yet. Start the conversation!
              </p>
            )}
          </div>
        </ScrollArea>
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={!message.trim()}>
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RealtimeChatPanel;