import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send } from 'lucide-react';
import { format } from 'date-fns';

interface BandChatProps {
  bandId: string;
}

interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  profile?: {
    display_name: string;
    username: string;
  };
}

export function BandChat({ bandId }: BandChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    subscribeToMessages();
  }, [bandId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('band_chat_messages')
        .select(`
          id,
          user_id,
          message,
          created_at
        `)
        .eq('band_id', bandId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      // Load profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(m => m.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, username')
          .in('user_id', userIds);

        const messagesWithProfiles = data.map(msg => ({
          ...msg,
          profile: profiles?.find(p => p.user_id === msg.user_id),
        }));

        setMessages(messagesWithProfiles as ChatMessage[]);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`band_chat_${bandId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'band_chat_messages',
          filter: `band_id=eq.${bandId}`,
        },
        async (payload) => {
          // Load the profile for the new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id, display_name, username')
            .eq('user_id', payload.new.user_id)
            .single();

          const newMsg = {
            ...(payload.new as any),
            profile,
          };

          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !user) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('band_chat_messages')
        .insert({
          band_id: bandId,
          user_id: user.id,
          message: newMessage.trim(),
        });

      if (error) throw error;

      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const isOwnMessage = (userId: string) => userId === user?.id;

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <div>
            <CardTitle>Band Chat</CardTitle>
            <CardDescription>Communicate with your band members in real-time</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${isOwnMessage(msg.user_id) ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isOwnMessage(msg.user_id)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold">
                        {msg.profile?.display_name || 'Unknown'}
                      </span>
                      <span className="text-xs opacity-70">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
            maxLength={500}
          />
          <Button type="submit" size="icon" disabled={sending || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
