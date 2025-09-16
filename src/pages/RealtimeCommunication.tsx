import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useGameData } from '@/hooks/useGameData';
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
  Crown
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

interface JamSession {
  id: string;
  name: string;
  host: string;
  participants: number;
  max_participants: number;
  genre: string;
  tempo: number;
  is_private: boolean;
  skill_requirement: number;
}

interface Notification {
  id: string;
  type: 'gig_invite' | 'band_request' | 'fan_milestone' | 'achievement' | 'system';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
}

const RealtimeCommunication: React.FC = () => {
  const { user } = useAuth();
  const { profile } = useGameData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [jamSessions, setJamSessions] = useState<JamSession[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('general');
  const [isConnected, setIsConnected] = useState(false);
  const [activeJam, setActiveJam] = useState<JamSession | null>(null);
  const [jamTempo, setJamTempo] = useState(120);

  const channels = [
    { id: 'general', name: 'General Chat', icon: MessageSquare, public: true },
    { id: 'gigs', name: 'Gig Talk', icon: Music, public: true },
    { id: 'trading', name: 'Equipment Trade', icon: Share2, public: true },
    { id: 'beginners', name: 'Beginners Help', icon: Heart, public: true },
    { id: 'vip', name: 'VIP Lounge', icon: Crown, public: false, requirement: 'Level 10+' },
  ];

  useEffect(() => {
    if (user) {
      initializeRealtime();
      loadChatHistory();
      loadJamSessions();
      loadNotifications();
    }

    return () => {
      // Cleanup WebSocket connections
      setIsConnected(false);
    };
  }, [user]);

  const initializeRealtime = () => {
    // Simulate WebSocket connection
    setTimeout(() => {
      setIsConnected(true);
      toast.success('Connected to RockMundo Live!');
    }, 1000);

    // Simulate receiving messages
    const messageInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        const randomMessages = [
          'Anyone up for a jam session?',
          'Just finished recording a new track!',
          'Looking for a bassist for our upcoming tour',
          'Check out my new song on the charts!',
          'Equipment trade: Gibson Les Paul for Fender Strat',
        ];
        
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          user_id: 'random',
          username: `Player${Math.floor(Math.random() * 1000)}`,
          message: randomMessages[Math.floor(Math.random() * randomMessages.length)],
          timestamp: new Date().toISOString(),
          channel: selectedChannel,
          user_level: Math.floor(Math.random() * 50) + 1,
          user_badge: Math.random() > 0.7 ? 'Premium' : undefined
        };
        
        setMessages(prev => [...prev.slice(-49), newMessage]);
      }
    }, 5000);

    return () => clearInterval(messageInterval);
  };

  const loadChatHistory = () => {
    // Simulate loading chat history
    const historyMessages: ChatMessage[] = [
      {
        id: '1',
        user_id: 'user1',
        username: 'RockStar99',
        message: 'Welcome to RockMundo! Anyone want to start a band?',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        channel: 'general',
        user_level: 25,
        user_badge: 'Premium'
      },
      {
        id: '2',
        user_id: 'user2',
        username: 'MelodyMaker',
        message: 'Just hit level 15! Time to book bigger venues 🎸',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        channel: 'general',
        user_level: 15
      },
      {
        id: '3',
        user_id: 'user3',
        username: 'DrumMaster',
        message: 'Looking for band members for the upcoming tournament!',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        channel: 'general',
        user_level: 22,
        user_badge: 'Pro'
      }
    ];
    setMessages(historyMessages);
  };

  const loadJamSessions = () => {
    const sessions: JamSession[] = [
      {
        id: '1',
        name: 'Rock Legends Jam',
        host: 'GuitarHero123',
        participants: 3,
        max_participants: 5,
        genre: 'Rock',
        tempo: 140,
        is_private: false,
        skill_requirement: 30
      },
      {
        id: '2',
        name: 'Jazz Fusion Session',
        host: 'JazzMaster',
        participants: 2,
        max_participants: 4,
        genre: 'Jazz',
        tempo: 100,
        is_private: false,
        skill_requirement: 40
      },
      {
        id: '3',
        name: 'Electronic Beats',
        host: 'SynthWave',
        participants: 1,
        max_participants: 3,
        genre: 'Electronic',
        tempo: 128,
        is_private: false,
        skill_requirement: 20
      }
    ];
    setJamSessions(sessions);
  };

  const loadNotifications = () => {
    const notifs: Notification[] = [
      {
        id: '1',
        type: 'gig_invite',
        title: 'Gig Invitation',
        message: 'You\'ve been invited to perform at Central Arena',
        timestamp: new Date().toISOString(),
        read: false,
        priority: 'high'
      },
      {
        id: '2',
        type: 'achievement',
        title: 'Achievement Unlocked!',
        message: 'You earned the "Rising Star" achievement',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        read: false,
        priority: 'medium'
      },
      {
        id: '3',
        type: 'fan_milestone',
        title: 'Fan Milestone',
        message: 'You reached 1,000 fans! Keep it up!',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        read: true,
        priority: 'low'
      }
    ];
    setNotifications(notifs);
  };

  const sendMessage = () => {
    if (!currentMessage.trim() || !user) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      user_id: user.id,
      username: profile?.username || 'You',
      message: currentMessage,
      timestamp: new Date().toISOString(),
      channel: selectedChannel,
      user_level: profile?.level || 1,
      user_badge: profile?.level && profile.level > 20 ? 'Pro' : undefined
    };

    setMessages(prev => [...prev, newMessage]);
    setCurrentMessage('');
    toast.success('Message sent!');
  };

  const joinJamSession = (session: JamSession) => {
    if (!profile) return;

    // Check skill requirement
    const avgSkill = profile.level * 2; // Simplified skill calculation
    if (avgSkill < session.skill_requirement) {
      toast.error('Your skill level is too low for this jam session');
      return;
    }

    setActiveJam(session);
    setJamTempo(session.tempo);
    toast.success(`Joined ${session.name}! Get ready to jam!`);
  };

  const leaveJamSession = () => {
    setActiveJam(null);
    toast.info('Left jam session');
  };

  const markNotificationRead = (notificationId: string) => {
    setNotifications(prev => prev.map(notif => 
      notif.id === notificationId ? { ...notif, read: true } : notif
    ));
  };

  const getPriorityColor = (priority: string) => {
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
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={!isConnected}
                />
                <Button onClick={sendMessage} disabled={!isConnected || !currentMessage.trim()}>
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
                {notifications.filter(n => !n.read).length > 0 && (
                  <Badge variant="destructive">
                    {notifications.filter(n => !n.read).length}
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
                      onClick={() => markNotificationRead(notification.id)}
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
              {activeJam ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="font-medium text-green-800">Currently Jamming</h3>
                    <p className="text-sm text-green-600">{activeJam.name}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        <span className="text-sm">Tempo: {jamTempo} BPM</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">{activeJam.participants}/{activeJam.max_participants}</span>
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
                  <div className="space-y-3">
                    {jamSessions.map((session) => (
                      <div key={session.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">{session.name}</h3>
                          {session.is_private && <Lock className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>Host: {session.host}</div>
                          <div>Genre: {session.genre}</div>
                          <div>Tempo: {session.tempo} BPM</div>
                          <div>Skill Required: {session.skill_requirement}+</div>
                          <div>Players: {session.participants}/{session.max_participants}</div>
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full mt-2"
                          onClick={() => joinJamSession(session)}
                          disabled={session.participants >= session.max_participants}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Join Jam
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RealtimeCommunication;