
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useGameData } from '@/hooks/useGameData';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Database } from '@/integrations/supabase/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';
import {
  MessageSquare,
  Users,
  Send,
  Music, 
  Volume2, 
  Mic, 
  Play, 
  Pause,
  Radio,
  Headphones,
  Heart,
  Share2,
  Bell,
  Settings,
  Globe,
  Lock,
  Crown,
  Loader2
} from 'lucide-react';

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  message: string;
  timestamp: string;
  channel: string;
  user_level?: number;
  user_badge?: string;
}

type NotificationType =
  | 'gig_invite'
  | 'band_request'
  | 'fan_milestone'
  | 'achievement'
  | 'system';

interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType | null;
  message: string;
  timestamp: string;
  read: boolean;
}

interface ChatProfileSummary {
  username: string | null;
  display_name: string | null;
  level: number | null;
}

interface ChatMessageRow {
  id: string;
  user_id: string;
  message: string;
  channel: string | null;
  created_at: string | null;
  username?: string | null;
  user_level?: number | null;
  user_badge?: string | null;
  profiles?: ChatProfileSummary | null;
  profile?: ChatProfileSummary | null;
}

type JamSessionRow = Tables<'jam_sessions'>;

type JamSessionRecord = JamSessionRow & {
  host_profile?: {
    display_name: string | null;
    username: string | null;
  } | null;
};

interface JamSession {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  genre: string;
  tempo: number;
  maxParticipants: number;
  currentParticipants: number;
  participantIds: string[];
  skillRequirement: number;
  isPrivate: boolean;
}

type NewSessionState = {
  name: string;
  genre: string;
  tempo: number;
  maxParticipants: number;
  skillRequirement: number;
};

const createDefaultSessionState = (): NewSessionState => ({
  name: '',
  genre: '',
  tempo: 120,
  maxParticipants: 4,
  skillRequirement: 0,
});

const mapJamSession = (
  record: JamSessionRecord,
  hostOverride?: JamSessionRecord['host_profile']
): JamSession => {
  const hostProfile = hostOverride ?? record.host_profile;

  return {
    id: record.id,
    name: record.name,
    hostId: record.host_id,
    hostName: hostProfile?.display_name || hostProfile?.username || 'Unknown Host',
    genre: record.genre,
    tempo: record.tempo,
    maxParticipants: record.max_participants,
    currentParticipants: record.current_participants,
    participantIds: record.participant_ids ?? [],
    skillRequirement: record.skill_requirement,
    isPrivate: record.is_private,
  };
};

interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
}

const DEFAULT_NOTIFICATION_TYPE: NotificationType = 'system';

const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  gig_invite: 'Gig Invitation',
  band_request: 'Band Request',
  fan_milestone: 'Fan Milestone',
  achievement: 'Achievement Unlocked',
  system: 'System Alert'
};

const NOTIFICATION_PRIORITIES: Record<NotificationType, 'low' | 'medium' | 'high'> = {
  gig_invite: 'high',
  band_request: 'medium',
  fan_milestone: 'low',
  achievement: 'medium',
  system: 'low'
};

const sortNotificationsByTimestamp = (items: Notification[]) =>
  [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

const mapNotificationRow = (notification: NotificationRow): Notification => {
  const type = notification.type ?? DEFAULT_NOTIFICATION_TYPE;
  const resolvedType = (type in NOTIFICATION_TITLES ? type : DEFAULT_NOTIFICATION_TYPE) as NotificationType;

  const title = NOTIFICATION_TITLES[resolvedType] ?? NOTIFICATION_TITLES[DEFAULT_NOTIFICATION_TYPE];
  const priority = NOTIFICATION_PRIORITIES[resolvedType] ?? NOTIFICATION_PRIORITIES[DEFAULT_NOTIFICATION_TYPE];

  return {
    id: notification.id,
    user_id: notification.user_id,
    type: resolvedType,
    title,
    message: notification.message,
    timestamp: notification.timestamp,
    read: notification.read,
    priority
  };
};

const mapChatMessageRow = (row: ChatMessageRow): ChatMessage => {
  const relatedProfile = row.profiles ?? row.profile ?? null;

  const resolvedUsername =
    row.username ??
    relatedProfile?.display_name ??
    relatedProfile?.username ??
    'Unknown Player';

  const potentialLevel = row.user_level ?? relatedProfile?.level ?? undefined;
  const resolvedLevel = typeof potentialLevel === 'number' ? potentialLevel : undefined;

  const resolvedBadge =
    row.user_badge ??
    (typeof resolvedLevel === 'number' && resolvedLevel > 20 ? 'Pro' : undefined);

  return {
    id: row.id,
    user_id: row.user_id,
    username: resolvedUsername || 'Unknown Player',
    message: row.message,
    timestamp: row.created_at ?? new Date().toISOString(),
    channel: row.channel ?? 'general',
    user_level: resolvedLevel ?? 1,
    user_badge: resolvedBadge ?? undefined,
  };
};

const RealtimeCommunication: React.FC = () => {
  const { user } = useAuth();
  const { profile } = useGameData();
  const userId = user?.id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [jamSessions, setJamSessions] = useState<JamSession[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('general');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasConnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activeJam, setActiveJam] = useState<JamSession | null>(null);
  const [jamTempo, setJamTempo] = useState(120);
  const [newSession, setNewSession] = useState<NewSessionState>(createDefaultSessionState());
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const activeJamId = activeJam?.id;
  const currentUserId = user?.id;

  const channels = [
    { id: 'general', name: 'General Chat', icon: MessageSquare, public: true },
    { id: 'gigs', name: 'Gig Talk', icon: Music, public: true },
    { id: 'trading', name: 'Equipment Trade', icon: Share2, public: true },
    { id: 'beginners', name: 'Beginners Help', icon: Heart, public: true },
    { id: 'vip', name: 'VIP Lounge', icon: Crown, public: false, requirement: 'Level 10+' },
  ];

  const unreadCount = notifications.filter(notification => !notification.read).length;

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadJamSessions();
  }, [user, loadJamSessions]);

  useEffect(() => {
    if (!userId) {
      setMessages([]);
      setIsConnected(false);
      hasConnectedRef.current = false;

      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      return;
    }

    let isActive = true;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from<ChatMessageRow>('chat_messages' as unknown as keyof Database['public']['Tables'])
          .select(`
            id,
            user_id,
            message,
            channel,
            created_at
          `)
          .eq('channel', selectedChannel)
          .order('created_at', { ascending: true })
          .limit(100);

        if (error) {
          throw error;
        }

        const rows = (data ?? []) as ChatMessageRow[];
        const userIds = Array.from(new Set(rows.map(row => row.user_id).filter(Boolean)));

        let profileMap: Record<string, ChatProfileSummary> = {};

        if (userIds.length > 0) {
          const { data: profileRows, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, level')
            .in('user_id', userIds);

          if (!profileError && profileRows) {
            profileMap = Object.fromEntries(
              profileRows.map(profile => [
                profile.user_id,
                {
                  username: profile.username,
                  display_name: profile.display_name,
                  level: profile.level,
                } satisfies ChatProfileSummary,
              ])
            );
          }
        }

        if (!isActive) {
          return;
        }

        const mapped = rows.map(row =>
          mapChatMessageRow({
            ...row,
            channel: row.channel ?? selectedChannel,
            created_at: row.created_at ?? new Date().toISOString(),
            profiles: profileMap[row.user_id] ?? null,
          })
        );
        setMessages(mapped);
      } catch (err) {
        console.error('Error loading chat messages:', err);
        if (isActive) {
          toast.error('Failed to load chat messages.');
        }
      }
    };

    void fetchMessages();

    return () => {
      isActive = false;
    };
  }, [selectedChannel, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`chat-room:${selectedChannel}`, {
      config: {
        broadcast: {
          self: true,
        },
      },
    });

    setIsConnected(false);

    channel
      .on('broadcast', { event: 'new-message' }, payload => {
        const incoming = payload.payload as ChatMessage | undefined;

        if (!incoming || incoming.channel !== selectedChannel) {
          return;
        }

        setMessages(prev => {
          if (prev.some(message => message.id === incoming.id)) {
            return prev;
          }
          return [...prev, incoming];
        });
      });

    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);

        if (!hasConnectedRef.current) {
          toast.success('Connected to RockMundo Live!');
          hasConnectedRef.current = true;
        }
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setIsConnected(false);
      }
    });

    channelRef.current = channel;

    return () => {
      setIsConnected(false);
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [selectedChannel, userId]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    let isActive = true;

    const fetchNotifications = async () => {
        try {
          const { data, error } = await supabase
            .from<NotificationRow>('notifications' as unknown as keyof Database['public']['Tables'])
            .select('*')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false });

        if (error) {
          throw error;
        }

        if (!isActive) {
          return;
        }

        const mapped = (data ?? []).map(item => mapNotificationRow(item as NotificationRow));
        setNotifications(sortNotificationsByTimestamp(mapped));
      } catch (err) {
        console.error('Error loading notifications:', err);
        if (isActive) {
          toast.error('Failed to load notifications.');
        }
      }
    };

    void fetchNotifications();

    return () => {
      isActive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`public:notifications:user:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, payload => {
        const newNotification = mapNotificationRow(payload.new as NotificationRow);
        setNotifications(prev => {
          if (prev.some(notification => notification.id === newNotification.id)) {
            return prev;
          }
          const updated = [newNotification, ...prev];
          return sortNotificationsByTimestamp(updated);
        });
        toast(newNotification.title, {
          description: newNotification.message
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, payload => {
        const updatedNotification = mapNotificationRow(payload.new as NotificationRow);
        setNotifications(prev =>
          prev.map(notification =>
            notification.id === updatedNotification.id ? updatedNotification : notification
          )
        );
      });

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadJamSessions = useCallback(async (): Promise<JamSession[]> => {
    setIsLoadingSessions(true);

    try {
      const { data, error } = await supabase
        .from('jam_sessions')
        .select(`
          *,
          host_profile:profiles!jam_sessions_host_id_fkey(username, display_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const records = (data as JamSessionRecord[] | null) ?? [];
      const mappedSessions = records.map((record) => mapJamSession(record));

      setJamSessions(mappedSessions);

      if (activeJamId) {
        const updatedActive = mappedSessions.find((session) => session.id === activeJamId);

        if (updatedActive) {
          setActiveJam(updatedActive);
          setJamTempo(updatedActive.tempo);
        } else {
          setActiveJam(null);
          setJamTempo(120);
        }
      }
      return mappedSessions;
    } catch (err) {
      console.error('Error loading jam sessions:', err);
      toast.error('Failed to load jam sessions');
      return [];
    } finally {
      setIsLoadingSessions(false);
    }
  }, [activeJamId]);

  const sendMessage = async () => {
    if (!currentMessage.trim() || !user) {
      return;
    }

    const trimmedMessage = currentMessage.trim();

    try {
      const { data, error } = await supabase
        .from<ChatMessageRow>('chat_messages' as unknown as keyof Database['public']['Tables'])
        .insert({
          user_id: user.id,
          channel: selectedChannel,
          message: trimmedMessage,
        })
        .select(`
          id,
          user_id,
          message,
          channel,
          created_at
        `)
        .single();

      if (error || !data) {
        throw error ?? new Error('Failed to send message');
      }

      const insertedRow = data as ChatMessageRow;
      const messagePayload = mapChatMessageRow({
        ...insertedRow,
        channel: insertedRow.channel ?? selectedChannel,
        created_at: insertedRow.created_at ?? new Date().toISOString(),
        username: profile?.username ?? 'You',
        user_level: profile?.level ?? 1,
        user_badge: profile?.level && profile.level > 20 ? 'Pro' : undefined,
      });

      setMessages(prev => {
        if (prev.some(existing => existing.id === messagePayload.id)) {
          return prev;
        }
        return [...prev, messagePayload];
      });

      if (channelRef.current) {
        const status = await channelRef.current.send({
          type: 'broadcast',
          event: 'new-message',
          payload: messagePayload,
        });

        if (status !== 'ok') {
          console.warn('Broadcast failed with status:', status);
        }
      }

      setCurrentMessage('');
      toast.success('Message sent!');
    } catch (err) {
      console.error('Error sending chat message:', err);
      toast.error('Failed to send message.');
    }
  };

  const createSession = async () => {
    if (!profile || !currentUserId) {
      toast.error('You need a player profile to create jam sessions');
      return;
    }

    const trimmedName = newSession.name.trim();
    const trimmedGenre = newSession.genre.trim();
    const tempo = Number.isFinite(newSession.tempo) ? Math.max(1, Math.round(newSession.tempo)) : 120;
    const maxParticipants = Number.isFinite(newSession.maxParticipants)
      ? Math.max(1, Math.round(newSession.maxParticipants))
      : 4;
    const skillRequirement = Number.isFinite(newSession.skillRequirement)
      ? Math.max(0, Math.round(newSession.skillRequirement))
      : 0;

    if (!trimmedName || !trimmedGenre) {
      toast.error('Session name and genre are required');
      return;
    }

    if (maxParticipants < 1) {
      toast.error('Jam sessions must allow at least one participant');
      return;
    }

    try {
      setCreatingSession(true);

      const { data: sessionIdData, error: createError } = await supabase
        .from('jam_sessions')
        .insert({
          host_id: currentUserId,
          name: trimmedName,
          genre: trimmedGenre,
          tempo,
          max_participants: maxParticipants,
          skill_requirement: skillRequirement,
          is_private: false,
        })
        .select('id')
        .single();

      if (createError) throw createError;
      if (!sessionIdData) {
        throw new Error('Unable to create jam session');
      }

      const { data: joinedData, error: joinError } = await supabase
        .rpc('join_jam_session', { p_session_id: sessionIdData.id });

      if (joinError) throw joinError;

      const hostProfile = {
        display_name: profile.display_name,
        username: profile.username,
      };

      let createdSession: JamSession | null = null;

      if (joinedData) {
        createdSession = mapJamSession(joinedData as JamSessionRecord, hostProfile);
        setActiveJam(createdSession);
        setJamTempo(createdSession.tempo);
      }

      const sessions = await loadJamSessions();

      if (!createdSession && joinedData) {
        const fallback = sessions.find((session) => session.id === (joinedData as JamSessionRow).id);
        if (fallback) {
          setActiveJam(fallback);
          setJamTempo(fallback.tempo);
        }
      }

      setNewSession(createDefaultSessionState());
      toast.success('Jam session created!');
    } catch (error) {
      console.error('Error creating jam session:', error);
      const message = error instanceof Error ? error.message : 'Failed to create jam session';
      toast.error(message);
    } finally {
      setCreatingSession(false);
    }
  };

  const joinSession = async (session: JamSession) => {
    if (!profile || !currentUserId) {
      toast.error('You need a player profile to join jam sessions');
      return;
    }

    if (session.isPrivate) {
      toast.error('This jam session is private and cannot be joined right now');
      return;
    }

    if (session.currentParticipants >= session.maxParticipants) {
      toast.error('This jam session is already full');
      return;
    }

    const avgSkill = profile.level * 2;
    if (avgSkill < session.skillRequirement) {
      toast.error('Your skill level is too low for this jam session');
      return;
    }

    if (session.participantIds.includes(currentUserId)) {
      setActiveJam(session);
      setJamTempo(session.tempo);
      toast.info('You are already part of this jam session');
      return;
    }

    try {
      setJoiningSessionId(session.id);

      const { data, error } = await supabase
        .rpc('join_jam_session', { p_session_id: session.id });

      if (error) throw error;
      if (!data) {
        throw new Error('Unable to join jam session');
      }

      const hostOverride = {
        display_name: session.hostName,
        username: session.hostName,
      };

      const updatedSession = mapJamSession(data as JamSessionRecord, hostOverride);

      setJamSessions((prev) => {
        const exists = prev.some((item) => item.id === updatedSession.id);
        if (exists) {
          return prev.map((item) => (item.id === updatedSession.id ? updatedSession : item));
        }
        return [updatedSession, ...prev];
      });

      setActiveJam(updatedSession);
      setJamTempo(updatedSession.tempo);
      toast.success(`Joined ${updatedSession.name}! Get ready to jam!`);
    } catch (error) {
      console.error('Error joining jam session:', error);
      const message = error instanceof Error ? error.message : 'Failed to join jam session';
      toast.error(message);
    } finally {
      setJoiningSessionId(null);
    }
  };

  const leaveJamSession = () => {
    setActiveJam(null);
    setJamTempo(120);
    toast.info('Left jam session');
  };

  const markNotificationRead = async (notificationId: string) => {
    if (!userId) return;

    const existing = notifications.find(notification => notification.id === notificationId);
    if (!existing || existing.read) return;

    const previousNotifications = notifications.map(notification => ({ ...notification }));

    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      )
    );

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error marking notification as read:', error);
      setNotifications(previousNotifications);
      toast.error('Failed to update notification status.');
    }
  };

  const getPriorityColor = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const getUserBadgeColor = (badge?: string) => {
    switch (badge) {
      case 'Premium': return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white';
      case 'Pro': return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RockMundo Live</h1>
          <p className="text-muted-foreground">Real-time communication and collaboration</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
            isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-6 h-6" />
                Global Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Channel Selector */}
              <div className="flex flex-wrap gap-2">
                {channels.map((channel) => (
                  <Button
                    key={channel.id}
                    variant={selectedChannel === channel.id ? "default" : "outline"}
                    size="sm"
                    className="gap-2"
                    onClick={() => setSelectedChannel(channel.id)}
                    disabled={!channel.public && (!profile || profile.level < 10)}
                  >
                    <channel.icon className="w-4 h-4" />
                    {channel.name}
                    {!channel.public && <Lock className="w-3 h-3" />}
                  </Button>
                ))}
              </div>

              {/* Messages */}
              <ScrollArea className="h-80 border rounded-lg p-4">
                <div className="space-y-3">
                  {messages
                    .filter(msg => msg.channel === selectedChannel)
                    .map((message) => (
                      <div key={message.id} className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{message.username}</span>
                            {message.user_badge && (
                              <Badge className={`text-xs ${getUserBadgeColor(message.user_badge)}`}>
                                {message.user_badge}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              Lv.{message.user_level}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm">{message.message}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="flex gap-2">
                <Input
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder="Type your message..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      void sendMessage();
                    }
                  }}
                  disabled={!isConnected}
                />
                <Button
                  onClick={() => {
                    void sendMessage();
                  }}
                  disabled={!isConnected || !currentMessage.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notifications */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-6 h-6" />
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="destructive">
                    {unreadCount}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        !notification.read ? 'bg-blue-50 border-blue-200' : 'hover:bg-muted'
                      }`}
                      onClick={() => void markNotificationRead(notification.id)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{notification.title}</span>
                        <Badge className={`text-xs ${getPriorityColor(notification.priority)}`}>
                          {notification.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{notification.message}</p>
                      <span className="text-xs text-muted-foreground">
                        {new Date(notification.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Jam Sessions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="w-6 h-6" />
                Live Jam Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {profile && (
                  <div className="p-3 border rounded-lg space-y-3">
                    <div>
                      <h3 className="font-medium">Start a Jam Session</h3>
                      <p className="text-xs text-muted-foreground">
                        Launch a new collaborative session with your preferred style and tempo.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="jam-session-name">Session Name</Label>
                        <Input
                          id="jam-session-name"
                          value={newSession.name}
                          onChange={(e) => setNewSession(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Midnight Groove"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="jam-session-genre">Genre</Label>
                        <Input
                          id="jam-session-genre"
                          value={newSession.genre}
                          onChange={(e) => setNewSession(prev => ({ ...prev, genre: e.target.value }))}
                          placeholder="Funk / Rock"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="jam-session-tempo">Tempo (BPM)</Label>
                        <Input
                          id="jam-session-tempo"
                          type="number"
                          min={40}
                          max={260}
                          value={newSession.tempo}
                          onChange={(e) => setNewSession(prev => ({ ...prev, tempo: Number(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="jam-session-max">Max Participants</Label>
                        <Input
                          id="jam-session-max"
                          type="number"
                          min={1}
                          max={12}
                          value={newSession.maxParticipants}
                          onChange={(e) => setNewSession(prev => ({ ...prev, maxParticipants: Number(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="jam-session-skill">Skill Requirement</Label>
                        <Input
                          id="jam-session-skill"
                          type="number"
                          min={0}
                          max={100}
                          value={newSession.skillRequirement}
                          onChange={(e) => setNewSession(prev => ({ ...prev, skillRequirement: Number(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                    <Button onClick={createSession} disabled={creatingSession} className="w-full sm:w-auto">
                      {creatingSession ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Radio className="w-4 h-4 mr-2" />
                          Create Session
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {activeJam ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h3 className="font-medium text-green-800">Currently Jamming</h3>
                      <p className="text-sm text-green-600">{activeJam.name}</p>
                      <p className="text-xs text-green-600">Hosted by {activeJam.hostName}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-4 h-4" />
                          <span className="text-sm">Tempo: {jamTempo} BPM</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span className="text-sm">{activeJam.currentParticipants}/{activeJam.maxParticipants}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline">
                          <Mic className="w-4 h-4 mr-1" />
                          Record
                        </Button>
                        <Button size="sm" variant="destructive" onClick={leaveJamSession}>
                          Leave
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="h-64">
                    {isLoadingSessions ? (
                      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                        Loading jam sessions...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {jamSessions.length === 0 ? (
                          <div className="text-sm text-muted-foreground text-center py-6">
                            No jam sessions available yet. Be the first to start one!
                          </div>
                        ) : (
                          jamSessions.map((session) => {
                            const isMember = currentUserId ? session.participantIds.includes(currentUserId) : false;
                            const isJoining = joiningSessionId === session.id;
                            const isFull = session.currentParticipants >= session.maxParticipants;
                            const isDisabled = isJoining || isMember || isFull || session.isPrivate;

                            return (
                              <div key={session.id} className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="font-medium">{session.name}</h3>
                                  {session.isPrivate && <Lock className="w-4 h-4 text-muted-foreground" />}
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <div>Host: {session.hostName}</div>
                                  <div>Genre: {session.genre}</div>
                                  <div>Tempo: {session.tempo} BPM</div>
                                  <div>Skill Required: {session.skillRequirement}+</div>
                                  <div>Players: {session.currentParticipants}/{session.maxParticipants}</div>
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full mt-2"
                                  onClick={() => joinSession(session)}
                                  disabled={isDisabled}
                                  variant={isMember ? 'secondary' : 'default'}
                                >
                                  {isJoining ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                      Joining...
                                    </>
                                  ) : isMember ? (
                                    'Joined'
                                  ) : (
                                    <>
                                      <Play className="w-4 h-4 mr-1" />
                                      Join Jam
                                    </>
                                  )}
                                </Button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </ScrollArea>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RealtimeCommunication;