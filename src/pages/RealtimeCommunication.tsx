import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth-context';
import { useGameData } from '@/hooks/useGameData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner-toast';
import { MessageSquare, Send, Music } from 'lucide-react';

interface AudioMeterHandle {
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  rafId: number;
}

const RealtimeCommunication: React.FC = () => {
  const { user } = useAuth();
  const { profile } = useGameData();

  type ChatMessage = {
    id: string;
    message: string;
    user_id: string;
    channel?: string | null;
    created_at?: string | null;
    username?: string | null;
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [bandId, setBandId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'band'>('general');
  const channelKey = useMemo(() => {
    if (activeTab === 'band') {
      return bandId ? `band:${bandId}` : null;
    }

    return 'general';
  }, [activeTab, bandId]);
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

    return;
  }, []);

  useEffect(() => {
    if (!user) {
      setBandId(null);
      return;
    }

    let isMounted = true;

    const fetchBandMembership = async () => {
      const { data, error } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching band membership:', error);
        return;
      }

      if (isMounted) {
        setBandId(data?.band_id ?? null);
      }
    };

    void fetchBandMembership();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!bandId && activeTab === 'band') {
      setActiveTab('general');
    }
  }, [bandId, activeTab]);

  useEffect(() => {
    if (!user || !channelKey) {
      setIsConnected(false);
      setMessages([]);
      setOnlineCount(0);
      return;
    }

    let isMounted = true;
    const currentChannelKey = channelKey;
    const realtimeChannel = supabase.channel(`chat:${currentChannelKey}`);

    setMessages([]);
    setOnlineCount(0);
    setIsConnected(false);

    const refreshPresence = async () => {
      const { count, error } = await supabase
        .from('chat_participants')
        .select('id', { count: 'exact', head: true })
        .eq('channel', currentChannelKey);

      if (error) {
        console.error('Error refreshing presence:', error);
        return;
      }

      if (isMounted) {
        setOnlineCount(count ?? 0);
      }
    };

    const loadInitialMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel', currentChannelKey)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Error loading messages:', error);
        toast.error('Failed to load chat history.');
        return;
      }

      if (data && isMounted) {
        setMessages(data as ChatMessage[]);
      }
    };

    const registerPresence = async () => {
      const { error } = await supabase
        .from('chat_participants')
        .upsert(
          {
            user_id: user.id,
            channel: currentChannelKey,
            status: 'online'
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('Error registering presence:', error);
      }
    };

    void (async () => {
      await Promise.all([loadInitialMessages(), registerPresence()]);
      await refreshPresence();
    })();

    realtimeChannel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel=eq.${currentChannelKey}` },
      payload => {
        if (!isMounted) {
          return;
        }

        const newMessage = payload.new as ChatMessage;
        setMessages(previous => [...previous, newMessage]);
      }
    );

    realtimeChannel.on(
      'postgres_changes',
      { schema: 'public', table: 'chat_participants', filter: `channel=eq.${currentChannelKey}` },
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

      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
      }

      if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setIsConnected(false);
      }
    });

    return () => {
      if (isMounted) {
        setIsConnected(false);
      }
      isMounted = false;
      void realtimeChannel.unsubscribe();

      void supabase
        .from('chat_participants')
        .delete()
        .eq('user_id', user.id)
        .eq('channel', currentChannelKey);
    };
  }, [user, channelKey]);

  const sendMessage = useCallback(async () => {
    if (!currentMessage.trim() || !user || !channelKey) {
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          message: currentMessage.trim(),
          channel: channelKey
        });

      if (error) throw error;

      setCurrentMessage('');
      toast.success(`Message sent to ${activeTab === 'band' ? 'your band' : 'general'} chat!`);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message.');
    }
  }, [currentMessage, user, channelKey, activeTab]);

  useEffect(() => {
    const audioMeters = audioMetersRef.current;

    return () => {
      Object.keys(audioMeters).forEach((participantId) => {
        destroyAudioMeter(participantId);
      });
    };
  }, [destroyAudioMeter]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RockMundo Live</h1>
          <p className="text-muted-foreground">
            Real-time communication and collaboration
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <span>Chat</span>
              <Badge variant="secondary">
                {`${activeTab === 'band' ? 'Band' : 'Global'}: ${onlineCount}`}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'general' | 'band')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="general">Global Chat</TabsTrigger>
                <TabsTrigger value="band" disabled={!bandId}>
                  Band Chat
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4">
                <ScrollArea className="h-80">
                  <div className="space-y-3">
                    {messages.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No messages yet. Be the first to start the conversation!
                      </p>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className="flex gap-3 p-3 rounded-lg bg-muted"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {message.username && message.username.trim().length > 0
                                  ? message.username
                                  : message.user_id === user?.id
                                  ? profile?.display_name || profile?.username || 'You'
                                  : 'User'}
                              </span>
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
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    placeholder="Type your message..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => void sendMessage()}
                    disabled={!currentMessage.trim() || !channelKey}
                    size="sm"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="band" className="space-y-4">
                {bandId ? (
                  <>
                    <ScrollArea className="h-80">
                      <div className="space-y-3">
                        {messages.length === 0 ? (
                          <p className="text-muted-foreground text-center py-8">
                            Coordinate with your bandmates here. Start the conversation!
                          </p>
                        ) : (
                          messages.map((message) => (
                            <div
                              key={message.id}
                              className="flex gap-3 p-3 rounded-lg bg-muted"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">
                                    {message.username && message.username.trim().length > 0
                                      ? message.username
                                      : message.user_id === user?.id
                                      ? profile?.display_name || profile?.username || 'You'
                                      : 'User'}
                                  </span>
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
                        onChange={(e) => setCurrentMessage(e.target.value)}
                        placeholder="Share something with your band..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void sendMessage();
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        onClick={() => void sendMessage()}
                        disabled={!currentMessage.trim() || !channelKey}
                        size="sm"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    Join a band to unlock your private band chat!
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              <span>Jam Sessions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Jam session features will be available soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RealtimeCommunication;
