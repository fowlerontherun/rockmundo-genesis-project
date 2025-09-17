
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/use-auth-context';
import { useGameData } from '@/hooks/useGameData';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Database } from '@/integrations/supabase/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from '@/components/ui/sonner-toast';
import {
  MessageSquare,
  Users,
  Send,
  Music,
  Volume2,
  VolumeX,
  Mic,
  Play,
  Pause,
  Radio,
  Headphones,
  Heart,
  Loader2,
  Lock,
  Crown,
  Loader2,
  UserX
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

interface ChatProfileSummary {
  username: string | null;
  display_name: string | null;
  level: number | null;
}

interface ChatMessageRow {
  id: string;
  user_id: string;
  message: string | null;
  channel: string | null;
  created_at: string | null;
  username?: string | null;
  user_level?: number | null;
  user_badge?: string | null;
  profiles?: ChatProfileSummary | null;
  profile?: ChatProfileSummary | null;
}

type ChatParticipantRow = Tables<'chat_participants'>;

type ParticipantStatus = 'online' | 'typing' | 'muted';

interface ChatParticipant {
  id: string;
  user_id: string;
  channel: string;
  status: ParticipantStatus;
  updated_at: string;
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

type StreamMap = Record<string, MediaStream>;

type AudioLevelMap = Record<string, number>;

type ParticipantDetailsMap = Record<string, { name: string }>;

type PresenceData = {
  user_id: string;
  name?: string;
};

interface AudioMeterHandle {
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  rafId: number;
}

interface WebRTCPayload {
  from: string;
  to: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

const DEFAULT_NOTIFICATION_TYPE: NotificationType = 'system';

const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  gig_invite: 'Gig Invitation',
  band_request: 'Band Request',
  fan_milestone: 'Fan Milestone',
  achievement: 'Achievement Unlocked',
  system: 'System Alert',
};

const NOTIFICATION_PRIORITIES: Record<NotificationType, 'low' | 'medium' | 'high'> = {
  gig_invite: 'high',
  band_request: 'medium',
  fan_milestone: 'low',
  achievement: 'medium',
  system: 'low',
};

const CHAT_MESSAGES_TABLE =
  'chat_messages' as unknown as keyof Database['public']['Tables'];

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const sortNotificationsByTimestamp = (items: Notification[]) =>
  [...items].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

const createDefaultSessionState = (): NewSessionState => ({
  name: '',
  genre: '',
  tempo: 120,
  maxParticipants: 4,
  skillRequirement: 0,
});

const mapJamSession = (
  record: JamSessionRecord,
  hostOverride?: JamSessionRecord['host_profile'],
): JamSession => {
  const hostProfile = hostOverride ?? record.host_profile;

const CHAT_MESSAGES_TABLE = 'chat_messages' as unknown as keyof Database['public']['Tables'];
const CHAT_PARTICIPANTS_TABLE = 'chat_participants' as unknown as keyof Database['public']['Tables'];
const mapNotificationRow = (notification: NotificationRow): Notification => {
  const type = notification.type ?? DEFAULT_NOTIFICATION_TYPE;
  const resolvedType = (type in NOTIFICATION_TITLES
    ? type
    : DEFAULT_NOTIFICATION_TYPE) as NotificationType;

  const title =
    NOTIFICATION_TITLES[resolvedType] ??
    NOTIFICATION_TITLES[DEFAULT_NOTIFICATION_TYPE];
  const priority =
    NOTIFICATION_PRIORITIES[resolvedType] ??
    NOTIFICATION_PRIORITIES[DEFAULT_NOTIFICATION_TYPE];

  return {
    id: notification.id,
    user_id: notification.user_id,
    type: resolvedType,
    title,
    message: notification.message,
    timestamp: notification.timestamp,
    read: notification.read,
    priority,
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
  const resolvedLevel =
    typeof potentialLevel === 'number' ? potentialLevel : undefined;

  const resolvedBadge =
    row.user_badge ??
    (typeof resolvedLevel === 'number' && resolvedLevel > 20
      ? 'Pro'
      : undefined);

  return {
    id: row.id,
    user_id: row.user_id,
    username: resolvedUsername || 'Unknown Player',
    message: row.message ?? '',
    timestamp: row.created_at ?? new Date().toISOString(),
    channel: row.channel ?? 'general',
    user_level: resolvedLevel ?? 1,
    user_badge: resolvedBadge ?? undefined,
  };
};

const mapParticipantRow = (
  row: ChatParticipantRow,
  profileSummary?: ChatProfileSummary | null
): ChatParticipant => ({
  id: row.id,
  user_id: row.user_id,
  channel: row.channel ?? 'general',
  status: (row.status ?? 'online') as ParticipantStatus,
  updated_at: row.updated_at ?? new Date().toISOString(),
  profile: profileSummary ?? null,
});

const RealtimeCommunication: React.FC = () => {
  const { user } = useAuth();
  const { profile } = useGameData();
  const userId = user?.id ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [jamSessions, setJamSessions] = useState<JamSession[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('general');
  const [isConnected, setIsConnected] = useState(false);
  const [activeJam, setActiveJam] = useState<JamSession | null>(null);
  const [jamTempo, setJamTempo] = useState(120);
  const [newSession, setNewSession] = useState<NewSessionState>(
    createDefaultSessionState(),
  );
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const activeJamId = activeJam?.id;
  const currentUserId = user?.id;
  const { isAdmin: isAdminRole } = useUserRole();
  const isAdminUser = isAdminRole();
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [selfParticipant, setSelfParticipant] = useState<ChatParticipant | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedChannelRef = useRef(selectedChannel);

  const channels = [
    { id: 'general', name: 'General Chat', icon: MessageSquare, public: true },
    { id: 'gigs', name: 'Gig Talk', icon: Music, public: true },
    { id: 'trading', name: 'Equipment Trade', icon: Share2, public: true },
    { id: 'beginners', name: 'Beginners Help', icon: Heart, public: true },
    { id: 'vip', name: 'VIP Lounge', icon: Crown, public: false, requirement: 'Level 10+' },
  ];

  const unreadCount = notifications.filter(notification => !notification.read).length;
  const isMuted = selfParticipant?.status === 'muted';
  const typingParticipants = useMemo(
    () =>
      participants.filter(
        participant => participant.status === 'typing' && participant.user_id !== userId
      ),
    [participants, userId]
  );
  const typingNames = useMemo(
    () =>
      typingParticipants.map(participant =>
        participant.profile?.display_name ??
        participant.profile?.username ??
        'Someone'
      ),
    [typingParticipants]
  );
  const typingMessage = useMemo(() => {
    if (typingNames.length === 0) {
      return '';
    }
    if (typingNames.length === 1) {
      return `${typingNames[0]} is typing...`;
    }
    if (typingNames.length === 2) {
      return `${typingNames[0]} and ${typingNames[1]} are typing...`;
    }
    return `${typingNames[0]} and ${typingNames.length - 1} others are typing...`;
  }, [typingNames]);

  const appendMessage = useCallback((incoming: ChatMessage) => {
    setMessages(prev => {
      if (prev.some(message => message.id === incoming.id)) {
        return prev;
      }

  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasConnectedRef = useRef(false);
  const audioChannelRef = useRef<RealtimeChannel | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(
    null,
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioMetersRef = useRef<Record<string, AudioMeterHandle>>({});
  const audioElementsRef = useRef<Record<string, HTMLAudioElement | null>>({});
  const initiatedPeersRef = useRef<Set<string>>(new Set());
  const currentSessionIdRef = useRef<string | null>(null);
  const participantStreamsRef = useRef<StreamMap>({});
  const participantDetailsRef = useRef<ParticipantDetailsMap>({});
  const hasStartedRecordingRef = useRef(false);

  const channels = useMemo(
    () => [
      { id: 'general', name: 'General Chat', icon: MessageSquare, public: true },
      { id: 'gigs', name: 'Gig Talk', icon: Music, public: true },
      { id: 'trading', name: 'Equipment Trade', icon: Share2, public: true },
      { id: 'beginners', name: 'Beginners Help', icon: Heart, public: true },
      {
        id: 'vip',
        name: 'VIP Lounge',
        icon: Crown,
        public: false,
        requirement: 'Level 10+',
      },
    ],
    [],
  );

  useEffect(() => {
    selectedChannelRef.current = selectedChannel;
  }, [selectedChannel]);

  useEffect(() => () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, []);

  const loadParticipants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<ChatParticipantRow>(CHAT_PARTICIPANTS_TABLE)
        .select('id, user_id, channel, status, updated_at')
        .eq('channel', selectedChannel);

      if (error) {
        throw error;
      }

      const rows = data ?? [];
      const userIds = rows.map(row => row.user_id);
      let profileMap: Record<string, ChatProfileSummary> = {};

      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, username, display_name, level')
          .in('user_id', userIds);

        if (!profileError && profileRows) {
          profileMap = Object.fromEntries(
            profileRows.map(profileRow => [
              profileRow.user_id,
              {
                username: profileRow.username,
                display_name: profileRow.display_name,
                level: profileRow.level,
              } satisfies ChatProfileSummary,
            ])
          );
        }
      }

      const mapped = rows.map(row =>
        mapParticipantRow(row, profileMap[row.user_id] ?? null)
      );

      setParticipants(mapped);
      setOnlineCount(mapped.length);
    } catch (error) {
      console.error('Error loading chat participants:', error);
      setParticipants([]);
      setOnlineCount(0);
    }
  }, [selectedChannel]);

  const fetchSelfParticipant = useCallback(async () => {
    if (!userId) {
      setSelfParticipant(null);
      return;
    }

    const { data, error } = await supabase
      .from<ChatParticipantRow>(CHAT_PARTICIPANTS_TABLE)
      .select('id, user_id, channel, status, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error loading self participant:', error);
      return;
    }

    if (!data) {
      setSelfParticipant(null);
      return;
    }

    const profileSummary = profile
      ? {
          username: profile.username,
          display_name: profile.display_name,
          level: profile.level,
        }
      : null;

    setSelfParticipant(mapParticipantRow(data, profileSummary));
  }, [profile, userId]);

  const syncPresence = useCallback(
    async (status: ParticipantStatus, channelOverride?: string) => {
      if (!userId) {
        return { success: false as const };
      }

      const targetChannel = channelOverride ?? selectedChannelRef.current;
      if (!targetChannel) {
        return { success: false as const };
      }

      const { error } = await supabase
        .from<ChatParticipantRow>(CHAT_PARTICIPANTS_TABLE)
        .upsert(
          {
            user_id: userId,
            channel: targetChannel,
            status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('Failed to sync chat presence:', error);
        return { success: false as const, error };
      }

      await Promise.all([fetchSelfParticipant(), loadParticipants()]);
      return { success: true as const };
    },
    [fetchSelfParticipant, loadParticipants, userId]
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setCurrentMessage(value);

      if (!userId || isMuted) {
        return;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (!value.trim()) {
        if (isTyping) {
          setIsTyping(false);
          void syncPresence('online');
        }
        return;
      }

      if (!isTyping) {
        setIsTyping(true);
        void syncPresence('typing');
      }

      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        void syncPresence('online');
      }, 2000);
    },
    [isMuted, isTyping, syncPresence, userId]
  );

  const handleMuteUser = useCallback(
    async (targetUserId: string) => {
      if (!isAdminUser || !targetUserId || targetUserId === userId) {
        if (targetUserId === userId) {
          toast.error('You cannot mute yourself.');
        }
        return;
      }

      const channelId = selectedChannelRef.current ?? selectedChannel;

      try {
        const { data, error } = await supabase
          .from<ChatParticipantRow>(CHAT_PARTICIPANTS_TABLE)
          .update({
            status: 'muted',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', targetUserId)
          .eq('channel', channelId)
          .select('id')
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          toast.warning('User is not currently active in this channel.');
          return;
        }

        await loadParticipants();
        toast.success('User muted successfully.');
      } catch (error) {
        console.error('Error muting user:', error);
        toast.error('Unable to mute user.');
      }
    },
    [isAdminUser, loadParticipants, selectedChannel, userId]
  );

  const handleKickUser = useCallback(
    async (targetUserId: string) => {
      if (!isAdminUser || !targetUserId || targetUserId === userId) {
        if (targetUserId === userId) {
          toast.error('You cannot remove yourself.');
        }
        return;
      }

      const channelId = selectedChannelRef.current ?? selectedChannel;

      try {
        const { data, error } = await supabase
          .from<ChatParticipantRow>(CHAT_PARTICIPANTS_TABLE)
          .delete()
          .eq('user_id', targetUserId)
          .eq('channel', channelId)
          .select('id')
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          toast.warning('User is not currently active in this channel.');
          return;
        }

        await loadParticipants();
        toast.success('User removed from chat.');
      } catch (error) {
        console.error('Error removing user:', error);
        toast.error('Unable to remove user.');
      }
    },
    [isAdminUser, loadParticipants, selectedChannel, userId]
  );

  const handleChannelSelect = useCallback(
    (channelId: string) => {
      if (channelId === selectedChannel) {
        return;
      }

      setSelectedChannel(channelId);
      setCurrentMessage('');

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      setIsTyping(false);

      if (!userId) {
        return;
      }

      if (isMuted) {
        toast.error('You are muted and cannot change channels until an admin unmutes you.');
        return;
      }

      void (async () => {
        const result = await syncPresence('online', channelId);
        if (!result.success) {
          const errorCode = (result.error as { code?: string } | undefined)?.code;
          if (errorCode === '42501') {
            toast.error('Unable to join the channel due to permissions.');
          }
        }
      })();
    },
    [isMuted, selectedChannel, syncPresence, userId]
  );

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  useEffect(() => {
    const presenceChannel = supabase
      .channel(`chat-participants:${selectedChannel}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_participants',
        filter: `channel=eq.${selectedChannel}`,
      }, () => {
        void loadParticipants();
      });

    presenceChannel.subscribe();

    return () => {
      void supabase.removeChannel(presenceChannel);
    };
  }, [loadParticipants, selectedChannel]);

  useEffect(() => {
    if (!userId) {
      setSelfParticipant(null);
      return;
    }

    const selfChannel = supabase
      .channel(`chat-participants:self:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_participants',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        if (payload.eventType === 'DELETE') {
          setSelfParticipant(null);
          return;
        }

        const newRow = payload.new as ChatParticipantRow;
        const profileSummary = profile
          ? {
              username: profile.username,
              display_name: profile.display_name,
              level: profile.level,
            }
          : null;

        setSelfParticipant(mapParticipantRow(newRow, profileSummary));
      });

    selfChannel.subscribe();
    void fetchSelfParticipant();

    return () => {
      void supabase.removeChannel(selfChannel);
    };
  }, [fetchSelfParticipant, profile, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    void (async () => {
      const result = await syncPresence('online');
      if (!result.success) {
        const errorCode = (result.error as { code?: string } | undefined)?.code;
        if (errorCode === '42501') {
          toast.error('You are muted and cannot join the chat right now.');
        }
      }
    })();

    return () => {
      void supabase
        .from<ChatParticipantRow>(CHAT_PARTICIPANTS_TABLE)
        .delete()
        .eq('user_id', userId);
    };
  }, [syncPresence, userId]);

  useEffect(() => {
    if (!userId || isMuted) {
      return;
    }

    if (selfParticipant && selfParticipant.channel === selectedChannel) {
      return;
    }

    void syncPresence('online', selectedChannel);
  }, [isMuted, selectedChannel, selfParticipant, syncPresence, userId]);

  useEffect(() => {
    if (!user) {
      return;
    }

  useEffect(() => {
    participantStreamsRef.current = participantStreams;
  }, [participantStreams]);

  useEffect(() => {
    participantDetailsRef.current = participantDetails;
  }, [participantDetails]);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!audioContextRef.current) {
      const AudioContextConstructor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextConstructor) {
        toast.error('Your browser does not support audio streaming.');
        return null;
      }

      const context = new AudioContextConstructor();
      audioContextRef.current = context;
      mixDestinationRef.current = context.createMediaStreamDestination();
    }

    return audioContextRef.current;
  }, []);

  const destroyAudioMeter = useCallback((participantId: string) => {
    const meter = audioMetersRef.current[participantId];
    if (!meter) {
      return;
    }

    cancelAnimationFrame(meter.rafId);
    meter.source.disconnect();
    meter.analyser.disconnect();
    delete audioMetersRef.current[participantId];

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from<ChatMessageRow>(CHAT_MESSAGES_TABLE)
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

  const setupAudioMeter = useCallback(
    (participantId: string, stream: MediaStream, isLocal: boolean) => {
      const context = ensureAudioContext();
      if (!context) {
        return;
      }

      destroyAudioMeter(participantId);

      try {
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const source = context.createMediaStreamSource(stream);
        source.connect(analyser);
        if (mixDestinationRef.current) {
          source.connect(mixDestinationRef.current);
        }

        const updateLevel = () => {
          analyser.getByteTimeDomainData(dataArray);
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i += 1) {
            const value = dataArray[i] - 128;
            sumSquares += value * value;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          const normalized = Math.min(100, Math.max(0, (rms / 64) * 100));

          setAudioLevels((prev) => ({ ...prev, [participantId]: normalized }));
          const handle = audioMetersRef.current[participantId];
          if (handle) {
            handle.rafId = requestAnimationFrame(updateLevel);
          }
        };

        audioMetersRef.current[participantId] = {
          analyser,
          source,
          rafId: requestAnimationFrame(updateLevel),
        };

        if (isLocal) {
          setIsAudioReady(true);
        }
      } catch (error) {
        console.error('Failed to create audio meter:', error);
      }
    },
    [destroyAudioMeter, ensureAudioContext],
  );

  const removeParticipantStream = useCallback(
    (participantId: string) => {
      destroyAudioMeter(participantId);
      setParticipantStreams((prev) => {
        if (!(participantId in prev)) {
          return prev;
        }
        const { [participantId]: _removed, ...rest } = prev;
        return rest;
      });
      setParticipantDetails((prev) => {
        if (!(participantId in prev)) {
          return prev;
        }
        const { [participantId]: _removed, ...rest } = prev;
        return rest;
      });
    },
    [destroyAudioMeter],
  );

  const cleanupPeer = useCallback(
    (peerId: string) => {
      const connection = peerConnectionsRef.current[peerId];
      if (connection) {
        try {
          connection.ontrack = null;
          connection.onicecandidate = null;
          connection.close();
        } catch (error) {
          console.warn('Error closing peer connection', error);
        }
        delete peerConnectionsRef.current[peerId];
      }

      initiatedPeersRef.current.delete(peerId);
      removeParticipantStream(peerId);
    },
    [removeParticipantStream],
  );

  const createPeerConnection = useCallback(
    (peerId: string) => {
      if (peerConnectionsRef.current[peerId]) {
        return peerConnectionsRef.current[peerId];
      }

      const connection = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      peerConnectionsRef.current[peerId] = connection;

      const localStream = localStreamRef.current;
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          connection.addTrack(track, localStream);
        });
      }

      connection.onicecandidate = (event) => {
        if (!event.candidate || !audioChannelRef.current || !userId) {
          return;
        }

        void audioChannelRef.current.send({
          type: 'broadcast',
          event: 'webrtc-ice',
          payload: {
            from: userId,
            to: peerId,
            candidate: event.candidate,
          },
        });
      };

      connection.ontrack = (event) => {
        const [incomingStream] = event.streams;
        if (!incomingStream) {
          return;
        }

        if (participantStreamsRef.current[peerId] === incomingStream) {
          return;
        }

        setParticipantStreams((prev) => ({
          ...prev,
          [peerId]: incomingStream,
        }));
        setupAudioMeter(peerId, incomingStream, false);
      };

      connection.onconnectionstatechange = () => {
        if (
          connection.connectionState === 'disconnected' ||
          connection.connectionState === 'failed' ||
          connection.connectionState === 'closed'
        ) {
          cleanupPeer(peerId);
        }
      };

      return connection;
    },
    [cleanupPeer, setupAudioMeter, userId],
  );
  const sendOffer = useCallback(
    async (peerId: string) => {
      if (initiatedPeersRef.current.has(peerId)) {
        return;
      }

      const channel = audioChannelRef.current;
      const connection = createPeerConnection(peerId);
      if (!channel || !connection || !userId) {
        return;
      }

      try {
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);

        initiatedPeersRef.current.add(peerId);
        const status = await channel.send({
          type: 'broadcast',
          event: 'webrtc-offer',
          payload: {
            from: userId,
            to: peerId,
            sdp: offer,
          },
        });

        if (status !== 'ok') {
          console.warn('Failed to send WebRTC offer', status);
        }
      } catch (error) {
        console.error('Error creating WebRTC offer:', error);
        initiatedPeersRef.current.delete(peerId);
      }
    },
    [createPeerConnection, userId],
  );

  const handleOffer = useCallback(
    async (message: { payload: WebRTCPayload }) => {
      const data = message.payload;
      if (!data || !userId || data.to !== userId || !data.sdp) {
        return;
      }

      const channel = audioChannelRef.current;
      const connection = createPeerConnection(data.from);
      if (!channel || !connection) {
        return;
      }

      try {
        await connection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);

        const status = await channel.send({
          type: 'broadcast',
          event: 'webrtc-answer',
          payload: {
            from: userId,
            to: data.from,
            sdp: answer,
          },
        });

        if (status !== 'ok') {
          console.warn('Failed to send WebRTC answer', status);
        }
      } catch (error) {
        console.error('Error handling WebRTC offer:', error);
      }
    },
    [createPeerConnection, userId],
  );

  const handleAnswer = useCallback(
    async (message: { payload: WebRTCPayload }) => {
      const data = message.payload;
      if (!data || !userId || data.to !== userId || !data.sdp) {
        return;
      }

      const connection = peerConnectionsRef.current[data.from];
      if (!connection) {
        return;
      }

      try {
        await connection.setRemoteDescription(
          new RTCSessionDescription(data.sdp),
        );
      } catch (error) {
        console.error('Error handling WebRTC answer:', error);
      }
    },
    [userId],
  );

  const handleIce = useCallback(
    async (message: { payload: WebRTCPayload }) => {
      const data = message.payload;
      if (!data || !userId || data.to !== userId || !data.candidate) {
        return;
      }

      const connection = peerConnectionsRef.current[data.from];
      if (!connection) {
        return;
      }

      try {
        await connection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    },
    [userId],
  );

  const handleLeaveEvent = useCallback(
    (message: { payload: { from?: string } }) => {
      const peerId = message.payload?.from;
      if (!peerId || peerId === userId) {
        return;
      }
      cleanupPeer(peerId);
    },
    [cleanupPeer, userId],
  );

  const handlePresenceSync = useCallback(() => {
    const channel = audioChannelRef.current;
    if (!channel || !userId) {
      return;
    }

    const state = channel.presenceState<PresenceData>();
    const peers = Object.keys(state).filter((key) => key !== userId);

    const detailsUpdate: ParticipantDetailsMap = {};
    Object.entries(state).forEach(([key, presences]) => {
      const presenceList = presences as PresenceData[];
      const latest = presenceList[presenceList.length - 1];
      if (latest) {
        detailsUpdate[key] = { name: latest.name ?? 'Participant' };
      }
    });

    if (Object.keys(detailsUpdate).length > 0) {
      setParticipantDetails((prev) => ({ ...prev, ...detailsUpdate }));
    }

    peers.forEach((peerId) => {
      createPeerConnection(peerId);
      if (userId.localeCompare(peerId) < 0) {
        void sendOffer(peerId);
      }
    });

    Object.keys(peerConnectionsRef.current).forEach((existingId) => {
      if (existingId !== userId && !peers.includes(existingId)) {
        cleanupPeer(existingId);
      }
    });
  }, [cleanupPeer, createPeerConnection, sendOffer, userId]);

  const startAudioStreaming = useCallback(
    async (sessionId: string) => {
      if (!userId) {
        return;
      }

      if (
        currentSessionIdRef.current === sessionId &&
        audioChannelRef.current
      ) {
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Audio streaming requires microphone access.');
        return;
      }

      try {
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          localStreamRef.current = stream;
          setParticipantStreams((prev) => ({ ...prev, [userId]: stream }));
          const profileName =
            profile?.display_name ?? profile?.username ?? 'You';
          setParticipantDetails((prev) => ({
            ...prev,
            [userId]: { name: profileName },
          }));
          setupAudioMeter(userId, stream, true);
        }
      } catch (error) {
        console.error('Error accessing microphone:', error);
        toast.error('Unable to access your microphone for the jam session.');
        return;
      }

      currentSessionIdRef.current = sessionId;

      const channel = supabase.channel(`jam-audio:${sessionId}`, {
        config: {
          presence: { key: userId },
          broadcast: { self: false },
        },
      });

      audioChannelRef.current = channel;

      channel
        .on('presence', { event: 'sync' }, handlePresenceSync)
        .on('presence', { event: 'join' }, (payload) => {
          const joined = (payload.newPresences ?? []) as PresenceData[];
          if (joined.length > 0) {
            const update: ParticipantDetailsMap = {};
            joined.forEach((presence) => {
              if (presence.user_id) {
                update[presence.user_id] = {
                  name: presence.name ?? 'Participant',
                };
              }
            });
            if (Object.keys(update).length > 0) {
              setParticipantDetails((prev) => ({ ...prev, ...update }));
            }
          }
        })
        .on('presence', { event: 'leave' }, (payload) => {
          const left = (payload.leftPresences ?? []) as PresenceData[];
          left.forEach((presence) => {
            if (presence.user_id) {
              cleanupPeer(presence.user_id);
            }
          });
        })
        .on('broadcast', { event: 'webrtc-offer' }, handleOffer)
        .on('broadcast', { event: 'webrtc-answer' }, handleAnswer)
        .on('broadcast', { event: 'webrtc-ice' }, handleIce)
        .on('broadcast', { event: 'leave' }, handleLeaveEvent);

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              user_id: userId,
              name:
                profile?.display_name ??
                profile?.username ??
                'RockMundo Musician',
            });
          } catch (error) {
            console.error('Failed to join jam audio channel:', error);
          }
        }
      });
    },
    [cleanupPeer, handleAnswer, handleIce, handleLeaveEvent, handleOffer, handlePresenceSync, profile, setupAudioMeter, userId],
  );

  const stopAudioStreaming = useCallback(async () => {
    if (audioChannelRef.current) {
      try {
        if (userId) {
          await audioChannelRef.current.send({
            type: 'broadcast',
            event: 'leave',
            payload: { from: userId },
          });
        }
      } catch (error) {
        console.warn('Error notifying peers about leaving:', error);
      }

      try {
        await supabase.removeChannel(audioChannelRef.current);
      } catch (error) {
        console.warn('Error removing audio channel:', error);
      }

      audioChannelRef.current = null;
    }

    Object.keys(peerConnectionsRef.current).forEach((peerId) => {
      try {
        peerConnectionsRef.current[peerId].close();
      } catch (error) {
        console.warn('Error closing peer connection:', error);
      }
      delete peerConnectionsRef.current[peerId];
    });
    initiatedPeersRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    Object.keys(audioMetersRef.current).forEach((participantId) => {
      destroyAudioMeter(participantId);
    });
    audioMetersRef.current = {};

    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch (error) {
        console.warn('Error closing audio context:', error);
      }
      audioContextRef.current = null;
    }

    mixDestinationRef.current = null;
    currentSessionIdRef.current = null;
    participantStreamsRef.current = {};
    participantDetailsRef.current = {};
    setParticipantStreams({});
    setParticipantDetails({});
    setAudioLevels({});
    setIsAudioReady(false);
    hasStartedRecordingRef.current = false;

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    setIsRecording(false);
  }, [destroyAudioMeter, userId]);

  const startRecordingIfHost = useCallback(() => {
    if (!activeJam || !userId || userId !== activeJam.hostId) {
      return;
    }

    if (!mixDestinationRef.current) {
      return;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      return;
    }

    try {
      const recorder = new MediaRecorder(mixDestinationRef.current.stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start session recording:', error);
      toast.error('Unable to start session recording.');
    }
  }, [activeJam, userId]);

  const stopRecordingAndUpload = useCallback(
    async (sessionId: string): Promise<boolean> => {
      const uploadBlob = async (blob: Blob) => {
        if (blob.size === 0) {
          return false;
        }

        const filePath = `sessions/${sessionId}-${Date.now()}.webm`;
        const { error } = await supabase.storage
          .from('session-recordings')
          .upload(filePath, blob, {
            contentType: 'audio/webm',
            upsert: false,
          });

        if (error) {
          console.error('Failed to upload session recording:', error);
          toast.error('Failed to upload session recording to Supabase.');
          return false;
        }

        toast.success('Session recording saved to Supabase storage.');
        return true;
      };

      const finalize = async () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: 'audio/webm',
        });
        recordedChunksRef.current = [];
        setIsRecording(false);
        mediaRecorderRef.current = null;
        return uploadBlob(blob);
      };

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        return await new Promise<boolean>((resolve) => {
          const recorder = mediaRecorderRef.current;
          if (!recorder) {
            resolve(false);
            return;
          }

          recorder.onstop = async () => {
            const success = await finalize();
            resolve(success);
          };

          recorder.stop();
        });
      }

      if (recordedChunksRef.current.length === 0) {
        return false;
      }

      return finalize();
    },
    [],
  );
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

      if (error) {
        throw error;
      }

      const records = (data as JamSessionRecord[] | null) ?? [];
      const mappedSessions = records.map((record) => mapJamSession(record));
      setJamSessions(mappedSessions);

      if (activeJam) {
        const updatedActive = mappedSessions.find(
          (session) => session.id === activeJam.id,
        );

        if (updatedActive) {
          setActiveJam(updatedActive);
          setJamTempo(updatedActive.tempo);
        } else {
          setActiveJam(null);
          setJamTempo(120);
        }
      }

      return mappedSessions;
    } catch (error) {
      console.error('Error loading jam sessions:', error);
      toast.error('Failed to load jam sessions');
      return [];
    } finally {
      setIsLoadingSessions(false);
    }
  }, [activeJam]);

  const sendMessage = useCallback(async () => {
    if (!currentMessage.trim() || !user) {
      return;
    }

    const trimmedMessage = currentMessage.trim();

    try {
      const { data, error } = await supabase
        .from<ChatMessageRow>(CHAT_MESSAGES_TABLE)
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
        username:
          profile?.username ?? profile?.display_name ?? 'You',
        user_level: profile?.level ?? 1,
        user_badge:
          profile?.level && profile.level > 20 ? 'Pro' : undefined,
      });

      setMessages((prev) => {
        if (prev.some((existing) => existing.id === messagePayload.id)) {
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
    } catch (error) {
      console.error('Error sending chat message:', error);
      toast.error('Failed to send message.');
    }
  }, [currentMessage, profile, selectedChannel, user]);

  const createSession = useCallback(async () => {
    if (!profile || !userId) {
      toast.error('You need a player profile to create jam sessions');
      return;
    }

    const trimmedName = newSession.name.trim();
    const trimmedGenre = newSession.genre.trim();
    const tempo = Number.isFinite(newSession.tempo)
      ? Math.max(1, Math.round(newSession.tempo))
      : 120;
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
          host_id: userId,
          name: trimmedName,
          genre: trimmedGenre,
          tempo,
          max_participants: maxParticipants,
          skill_requirement: skillRequirement,
          is_private: false,
        })
        .select('id')
        .single();

      if (createError) {
        throw createError;
      }

      if (!sessionIdData) {
        throw new Error('Unable to create jam session');
      }

      const { data: joinedData, error: joinError } = await supabase.rpc(
        'join_jam_session',
        { p_session_id: sessionIdData.id },
      );

      if (joinError) {
        throw joinError;
      }

      const hostProfile = {
        display_name: profile.display_name,
        username: profile.username,
      };

      let createdSession: JamSession | null = null;

      if (joinedData) {
        createdSession = mapJamSession(
          joinedData as JamSessionRecord,
          hostProfile,
        );
        setActiveJam(createdSession);
        setJamTempo(createdSession.tempo);
      }

      const sessions = await loadJamSessions();

      if (!createdSession && joinedData) {
        const fallback = sessions.find(
          (session) => session.id === (joinedData as JamSessionRow).id,
        );
        if (fallback) {
          setActiveJam(fallback);
          setJamTempo(fallback.tempo);
        }
      }

      setNewSession(createDefaultSessionState());
      toast.success('Jam session created!');
    } catch (error) {
      console.error('Error creating jam session:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create jam session';
      toast.error(message);
    } finally {
      setCreatingSession(false);
    }
  }, [loadJamSessions, newSession, profile, userId]);

  const joinSession = useCallback(
    async (session: JamSession) => {
      if (!profile || !userId) {
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

      const avgSkill = (profile.level ?? 0) * 2;
      if (avgSkill < session.skillRequirement) {
        toast.error('Your skill level is too low for this jam session');
        return;
      }

      if (session.participantIds.includes(userId)) {
        setActiveJam(session);
        setJamTempo(session.tempo);
        toast.info('You are already part of this jam session');
        return;
      }

      try {
        setJoiningSessionId(session.id);

        const { data, error } = await supabase.rpc('join_jam_session', {
          p_session_id: session.id,
        });

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error('Unable to join jam session');
        }

        const hostOverride = {
          display_name: session.hostName,
          username: session.hostName,
        };

        const updatedSession = mapJamSession(
          data as JamSessionRecord,
          hostOverride,
        );

        setJamSessions((prev) => {
          const exists = prev.some((item) => item.id === updatedSession.id);
          if (exists) {
            return prev.map((item) =>
              item.id === updatedSession.id ? updatedSession : item,
            );
          }
          return [updatedSession, ...prev];
        });

        setActiveJam(updatedSession);
        setJamTempo(updatedSession.tempo);
        toast.success(`Joined ${updatedSession.name}! Get ready to jam!`);
      } catch (error) {
        console.error('Error joining jam session:', error);
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to join jam session';
        toast.error(message);
      } finally {
        setJoiningSessionId(null);
      }
    },
    [profile, userId],
  );

  const leaveJamSession = useCallback(async () => {
    await stopAudioStreaming();
    setActiveJam(null);
    setJamTempo(120);
    toast.info('Left jam session');
    void loadJamSessions();
  }, [loadJamSessions, stopAudioStreaming]);

  const endJamSession = useCallback(async () => {
    if (!activeJam || !userId) {
      return;
    }

    if (userId !== activeJam.hostId) {
      await leaveJamSession();
      return;
    }

    await stopRecordingAndUpload(activeJam.id);
    await stopAudioStreaming();
    setActiveJam(null);
    setJamTempo(120);
    toast.success('Jam session ended.');
    void loadJamSessions();
  }, [activeJam, leaveJamSession, loadJamSessions, stopAudioStreaming, stopRecordingAndUpload, userId]);

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      if (!userId) {
        return;
      }

      const existing = notifications.find(
        (notification) => notification.id === notificationId,
      );
      if (!existing || existing.read) {
        return;
      }

      const previousNotifications = notifications.map((notification) => ({
        ...notification,
      }));

      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification,
        ),
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
    },
    [notifications, userId],
  );
  useEffect(() => {
    if (!user) {
      return;
    }

    void loadJamSessions();
  }, [loadJamSessions, user]);

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
          .from<ChatMessageRow>(CHAT_MESSAGES_TABLE)
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
        const userIds = Array.from(
          new Set(rows.map((row) => row.user_id).filter(Boolean)),
        );

        let profileMap: Record<string, ChatProfileSummary> = {};

        if (userIds.length > 0) {
          const { data: profileRows, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, username, display_name, level')
            .in('user_id', userIds);

          if (!profileError && profileRows) {
            profileMap = Object.fromEntries(
              profileRows.map((profileRow) => [
                profileRow.user_id,
                {
                  username: profileRow.username,
                  display_name: profileRow.display_name,
                  level: profileRow.level,
                } satisfies ChatProfileSummary,
              ]),
            );
          }
        }

        if (!isActive) {
          return;
        }

        const mapped = rows.map((row) =>
          mapChatMessageRow({
            ...row,
            channel: row.channel ?? selectedChannel,
            created_at: row.created_at ?? new Date().toISOString(),
            profiles: profileMap[row.user_id] ?? null,
          }),
        );
        setMessages(mapped);
      } catch (error) {
        console.error('Error loading chat messages:', error);
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

    channel.on('broadcast', { event: 'new-message' }, (payload) => {
      const incoming = payload.payload as ChatMessage | undefined;

      if (!incoming || incoming.channel !== selectedChannel) {
        return;
      }

      setMessages((prev) => {
        if (prev.some((message) => message.id === incoming.id)) {
          return prev;
        }
        return [...prev, incoming];
      });
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);

        if (!hasConnectedRef.current) {
          toast.success('Connected to RockMundo Live!');
          hasConnectedRef.current = true;
        }
      }

      if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
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
          .from<NotificationRow>(
            'notifications' as unknown as keyof Database['public']['Tables'],
          )
          .select('*')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false });

        if (error) {
          throw error;
        }

        if (!isActive) {
          return;
        }
        const mapped = (data ?? []).map((item) =>
          mapNotificationRow(item as NotificationRow),
        );
        setNotifications(sortNotificationsByTimestamp(mapped));
      } catch (error) {
        console.error('Error loading notifications:', error);
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = mapNotificationRow(
            payload.new as NotificationRow,
          );
          setNotifications((prev) => {
            if (prev.some((notification) => notification.id === newNotification.id)) {
              return prev;
            }
            const updated = [newNotification, ...prev];
            return sortNotificationsByTimestamp(updated);
          });
          toast(newNotification.title, {
            description: newNotification.message,
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updatedNotification = mapNotificationRow(
            payload.new as NotificationRow,
          );
          setNotifications((prev) =>
            prev.map((notification) =>
              notification.id === updatedNotification.id
                ? updatedNotification
                : notification,
            ),
          );
        },
      );

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
  const sendMessage = useCallback(async () => {
    const trimmedMessage = currentMessage.trim();

    if (!trimmedMessage || !user) {
      return;
    }

    if (isMuted) {
      toast.error('You are muted and cannot send messages.');
      return;
    }

    const channelId = selectedChannelRef.current ?? selectedChannel;

    try {
      const { data, error } = await supabase
        .from<ChatMessageRow>(CHAT_MESSAGES_TABLE)
        .insert({
          user_id: user.id,
          channel: channelId,
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
        channel: insertedRow.channel ?? channelId,
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

      const realtimeChannel = channelRef.current;
      if (realtimeChannel) {
        const status = await realtimeChannel.send({
          type: 'broadcast',
          event: 'new-message',
          payload: messagePayload,
        });

        if (status !== 'ok') {
          console.warn('Broadcast failed with status:', status);
        }
      }

      setCurrentMessage('');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      setIsTyping(false);
      void syncPresence('online', channelId);
      toast.success('Message sent!');
    } catch (error) {
      console.error('Error sending chat message:', error);
      toast.error('Failed to send message.');
    }
  }, [currentMessage, isMuted, profile, selectedChannel, syncPresence, user]);
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

  useEffect(() => {
    if (activeJam && userId) {
      void startAudioStreaming(activeJam.id);
    }
  }, [activeJam, startAudioStreaming, userId]);

  useEffect(() => {
    Object.entries(participantStreams).forEach(([participantId, stream]) => {
      const element = audioElementsRef.current[participantId];
      if (element && element.srcObject !== stream) {
        element.srcObject = stream;
      }
    });

    const validIds = new Set(Object.keys(participantStreams));
    Object.entries(audioElementsRef.current).forEach(([participantId, el]) => {
      if (!validIds.has(participantId) && el) {
        el.srcObject = null;
      }
    });
  }, [participantStreams]);

  useEffect(() => {
    if (!activeJam || !userId) {
      return;
    }

    if (!isAudioReady) {
      return;
    }

    if (userId !== activeJam.hostId) {
      return;
    }

    if (hasStartedRecordingRef.current) {
      return;
    }

    startRecordingIfHost();
    hasStartedRecordingRef.current = true;
  }, [activeJam, isAudioReady, startRecordingIfHost, userId]);

  useEffect(() => {
    return () => {
      void stopAudioStreaming();
    };
  }, [stopAudioStreaming]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RockMundo Live</h1>
          <p className="text-muted-foreground">
            Real-time communication and collaboration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-6 h-6" />
                  Global Chat
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  {onlineCount} online
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {channels.map((channel) => (
                  <Button
                    key={channel.id}
                    variant={selectedChannel === channel.id ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                    onClick={() => handleChannelSelect(channel.id)}
                    disabled={!channel.public && (!profile || profile.level < 10)}
                  >
                    <channel.icon className="w-4 h-4" />
                    {channel.name}
                    {!channel.public && <Lock className="w-3 h-3" />}
                  </Button>
                ))}
              </div>

              <ScrollArea className="h-80 border rounded-lg p-4">
                <div className="space-y-3">
                  {messages
                    .filter((msg) => msg.channel === selectedChannel)
                    .map((message) => (
                      <div key={message.id} className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-medium">{message.username}</span>
                            {message.user_badge && (
                              <Badge
                                className={`text-xs ${getUserBadgeColor(
                                  message.user_badge,
                                )}`}
                              >
                                {message.user_badge}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              Lv.{message.user_level ?? '?'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </span>
                            {isAdminUser && message.user_id !== userId && (
                              <div className="ml-auto flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => void handleMuteUser(message.user_id)}
                                  title="Mute user"
                                >
                                  <VolumeX className="w-4 h-4" />
                                  <span className="sr-only">Mute user</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => void handleKickUser(message.user_id)}
                                  title="Remove user"
                                >
                                  <UserX className="w-4 h-4" />
                                  <span className="sr-only">Remove user</span>
                                </Button>
                              </div>
                            )}
                          </div>
                          <p className="text-sm">{message.message}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>

              {typingMessage && (
                <p className="text-xs text-muted-foreground">{typingMessage}</p>
              )}

              {/* Message Input */}
              <div className="flex gap-2">
                <Input
                  value={currentMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={isMuted ? 'Muted by an admin' : 'Type your message...'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  disabled={!isConnected || isMuted}
                />
                <Button
                  onClick={() => {
                    void sendMessage();
                  }}
                  disabled={!isConnected || !currentMessage.trim() || isMuted}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              {isMuted && (
                <p className="text-xs text-destructive">
                  You have been muted by an admin and cannot send messages.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-6 h-6" />
                Notifications
                {unreadCount > 0 && <Badge variant="destructive">{unreadCount}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        !notification.read
                          ? 'bg-blue-50 border-blue-200'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => void markNotificationRead(notification.id)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {notification.title}
                        </span>
                        <Badge className={`text-xs ${getPriorityColor(notification.priority)}`}>
                          {notification.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {notification.message}
                      </p>
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
                          onChange={(e) =>
                            setNewSession((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Midnight Groove"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="jam-session-genre">Genre</Label>
                        <Input
                          id="jam-session-genre"
                          value={newSession.genre}
                          onChange={(e) =>
                            setNewSession((prev) => ({
                              ...prev,
                              genre: e.target.value,
                            }))
                          }
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
                          onChange={(e) =>
                            setNewSession((prev) => ({
                              ...prev,
                              tempo: Number(e.target.value) || 120,
                            }))
                          }
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
                          onChange={(e) =>
                            setNewSession((prev) => ({
                              ...prev,
                              maxParticipants: Number(e.target.value) || 4,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="jam-session-skill">Skill Requirement</Label>
                        <Input
                          id="jam-session-skill"
                          type="number"
                          min={0}
                          max={100}
                          value={newSession.skillRequirement}
                          onChange={(e) =>
                            setNewSession((prev) => ({
                              ...prev,
                              skillRequirement: Number(e.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        void createSession();
                      }}
                      disabled={creatingSession}
                      className="w-full sm:w-auto"
                    >
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
                      <h3 className="font-medium text-green-800">
                        Currently Jamming
                      </h3>
                      <p className="text-sm text-green-600">{activeJam.name}</p>
                      <p className="text-xs text-green-600">
                        Hosted by {activeJam.hostName}
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-4 h-4" />
                          <span className="text-sm">Tempo: {jamTempo} BPM</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span className="text-sm">
                            {activeJam.currentParticipants}/{activeJam.maxParticipants}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs text-green-700">
                          <Headphones className="w-4 h-4" />
                          <span>Live audio stream</span>
                        </div>
                        <div className="space-y-2">
                          {Object.keys(participantStreams).length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Waiting for musicians to connect...
                            </p>
                          ) : (
                            Object.entries(participantStreams).map(
                              ([participantId]) => {
                                const level = audioLevels[participantId] ?? 0;
                                const isLocal = participantId === userId;
                                const name = isLocal
                                  ? 'You'
                                  : participantDetails[participantId]?.name ??
                                    'Guest Musician';

                                return (
                                  <div
                                    key={participantId}
                                    className="flex items-center gap-3 rounded-md border p-2"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        {isLocal ? (
                                          <Mic className="w-4 h-4 text-green-600" />
                                        ) : (
                                          <Volume2 className="w-4 h-4 text-green-600" />
                                        )}
                                        <span className="text-sm font-medium">
                                          {name}
                                        </span>
                                      </div>
                                      <div className="mt-1 h-2 w-full rounded-full bg-muted">
                                        <div
                                          className="h-full rounded-full bg-green-500 transition-all duration-200 ease-out"
                                          style={{
                                            width: `${Math.min(
                                              100,
                                              Math.max(5, level),
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                    <audio
                                      ref={(element) => {
                                        audioElementsRef.current[participantId] =
                                          element;
                                        const stream =
                                          participantStreamsRef.current[
                                            participantId
                                          ];
                                        if (
                                          element &&
                                          stream &&
                                          element.srcObject !== stream
                                        ) {
                                          element.srcObject = stream;
                                        }
                                      }}
                                      autoPlay
                                      playsInline
                                      muted={isLocal}
                                      className="hidden"
                                    />
                                  </div>
                                );
                              },
                            )
                          )}
                        </div>
                        {userId === activeJam.hostId && (
                          <p className="text-xs text-muted-foreground">
                            {isRecording
                              ? 'Recording in progress. Your jam will be saved when you end the session.'
                              : 'Preparing recording...'}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void endJamSession()}
                        >
                          <Mic className="w-4 h-4 mr-1" />
                          {userId === activeJam.hostId
                            ? 'End & Save Jam'
                            : 'Leave Jam'}
                        </Button>
                        {userId !== activeJam.hostId && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              void leaveJamSession();
                            }}
                          >
                            Leave
                          </Button>
                        )}
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
                            const isMember = userId
                              ? session.participantIds.includes(userId)
                              : false;
                            const isJoining = joiningSessionId === session.id;
                            const isFull =
                              session.currentParticipants >=
                              session.maxParticipants;
                            const isDisabled =
                              isJoining || isMember || isFull || session.isPrivate;

                            return (
                              <div key={session.id} className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="font-medium">{session.name}</h3>
                                  {session.isPrivate && (
                                    <Lock className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <div>Host: {session.hostName}</div>
                                  <div>Genre: {session.genre}</div>
                                  <div>Tempo: {session.tempo} BPM</div>
                                  <div>
                                    Skill Required: {session.skillRequirement}+
                                  </div>
                                  <div>
                                    Players: {session.currentParticipants}/
                                    {session.maxParticipants}
                                  </div>
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
