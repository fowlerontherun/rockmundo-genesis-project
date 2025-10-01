import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/use-auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface Message {
  id: string;
  user_id: string;
  channel: string;
  message: string;
  created_at: string;
}

interface ChatWindowProps {
  channel?: string;
  hideHeader?: boolean;
  onOnlineCountChange?: (count: number) => void;
  onConnectionStatusChange?: (connected: boolean) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
  channel,
  hideHeader = false,
  onOnlineCountChange,
  onConnectionStatusChange,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const selectedChannel = channel ?? 'general';
  const channelRef = useRef<RealtimeChannel | null>(null);

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
        .eq('channel', selectedChannel)
        .order('created_at', { ascending: true })
        .limit(50);

      if (messageError) throw messageError;
      setMessages(messageData || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    }
  }, [user, selectedChannel]);

  const sendMessage = async () => {
    if (!user || !message.trim()) return;

    try {
      const { error } = await supabase
        .from('global_chat')
        .insert({
          user_id: user.id,
          channel: selectedChannel,
          message: message.trim()
        } as any);

      if (error) throw error;
      
      setMessage('');
      await fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  useEffect(() => {
    if (user) {
      void fetchMessages();
    }
  }, [user, fetchMessages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Please log in to use the chat
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      {!hideHeader && (
        <CardHeader>
          <CardTitle>Live Chat</CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0 h-full flex flex-col">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className="p-2 bg-muted/50 rounded">
                <div className="text-sm font-medium">User {msg.user_id.slice(0, 8)}</div>
                <div className="text-sm">{msg.message}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t">
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
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatWindow;
