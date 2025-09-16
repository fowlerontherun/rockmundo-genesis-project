import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Settings, 
  Users, 
  BarChart3, 
  AlertTriangle, 
  Shield, 
  Database,
  Activity,
  Globe,
  Zap,
  DollarSign,
  Music,
  Calendar,
  Flag,
  Ban,
  Eye,
  RefreshCw
} from 'lucide-react';

interface SystemMetrics {
  total_users: number;
  active_users_24h: number;
  total_bands: number;
  total_gigs_today: number;
  total_revenue_24h: number;
  server_uptime: string;
  database_size: string;
  active_sessions: number;
}

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
}

interface UserAction {
  id: string;
  user_id: string;
  username: string;
  action: string;
  details: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SeasonConfig {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  multipliers: Record<string, number>;
  active: boolean;
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [userActions, setUserActions] = useState<UserAction[]>([]);
  const [seasons, setSeasons] = useState<SeasonConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState('');
  const [banReason, setBanReason] = useState('');
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    type: 'tournament',
    start_date: '',
    end_date: '',
    rewards: ''
  });

  useEffect(() => {
    if (user) {
      loadAdminData();
    }
  }, [user]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      
      // Load system metrics (simulated)
      const metricsData: SystemMetrics = {
        total_users: 1247,
        active_users_24h: 156,
        total_bands: 423,
        total_gigs_today: 28,
        total_revenue_24h: 15420,
        server_uptime: '7d 14h 32m',
        database_size: '2.4 GB',
        active_sessions: 89
      };
      setMetrics(metricsData);

      // Load feature flags (simulated)
      const flagsData: FeatureFlag[] = [
        { id: '1', name: 'realtime_chat', description: 'Enable real-time chat system', enabled: true, category: 'communication' },
        { id: '2', name: 'tournaments', description: 'Enable tournament system', enabled: true, category: 'competition' },
        { id: '3', name: 'advanced_gigs', description: 'Enable advanced gig mechanics', enabled: false, category: 'performance' },
        { id: '4', name: 'weather_system', description: 'Enable weather effects on tours', enabled: true, category: 'world' },
        { id: '5', name: 'mod_support', description: 'Enable user-generated content', enabled: false, category: 'modding' },
        { id: '6', name: 'live_events', description: 'Enable live events system', enabled: true, category: 'events' },
      ];
      setFeatureFlags(flagsData);

      // Load user actions (simulated)
      const actionsData: UserAction[] = [
        { id: '1', user_id: '1', username: 'RockStar99', action: 'Large Cash Transfer', details: 'Transferred $50,000 to unknown user', timestamp: new Date().toISOString(), severity: 'high' },
        { id: '2', user_id: '2', username: 'BandLeader', action: 'Multiple Account Creation', details: 'Created 5 accounts in 10 minutes', timestamp: new Date(Date.now() - 3600000).toISOString(), severity: 'medium' },
        { id: '3', user_id: '3', username: 'MusicMaker', action: 'Inappropriate Content', details: 'Posted offensive lyrics in song', timestamp: new Date(Date.now() - 7200000).toISOString(), severity: 'critical' },
      ];
      setUserActions(actionsData);

      // Load seasons (simulated)
      const seasonsData: SeasonConfig[] = [
        { 
          id: '1', 
          name: 'Summer Festival Season', 
          start_date: '2024-06-01', 
          end_date: '2024-08-31', 
          multipliers: { gig_payment: 1.5, fan_gain: 1.3, experience: 1.2 },
          active: true 
        },
        { 
          id: '2', 
          name: 'Holiday Special', 
          start_date: '2024-12-01', 
          end_date: '2024-12-31', 
          multipliers: { merch_sales: 2.0, streaming_revenue: 1.4 },
          active: false 
        }
      ];
      setSeasons(seasonsData);

    } catch (error: any) {
      console.error('Error loading admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const toggleFeatureFlag = async (flagId: string) => {
    try {
      setFeatureFlags(prev => prev.map(flag => 
        flag.id === flagId ? { ...flag, enabled: !flag.enabled } : flag
      ));
      toast.success('Feature flag updated successfully');
    } catch (error: any) {
      console.error('Error updating feature flag:', error);
      toast.error('Failed to update feature flag');
    }
  };

  const banUser = async () => {
    if (!selectedUser || !banReason) {
      toast.error('Please select a user and provide a reason');
      return;
    }

    try {
      // In a real implementation, this would call a ban API
      toast.success(`User ${selectedUser} has been banned: ${banReason}`);
      setSelectedUser('');
      setBanReason('');
    } catch (error: any) {
      console.error('Error banning user:', error);
      toast.error('Failed to ban user');
    }
  };

  const createEvent = async () => {
    if (!newEvent.title || !newEvent.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // In a real implementation, this would create an event in the database
      toast.success(`Event "${newEvent.title}" created successfully`);
      setNewEvent({
        title: '',
        description: '',
        type: 'tournament',
        start_date: '',
        end_date: '',
        rewards: ''
      });
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
          Admin Control Center
        </h1>
        <p className="text-muted-foreground">
          Monitor, manage, and moderate the RockMundo universe
        </p>
      </div>

      {/* System Overview */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">{metrics.total_users.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Users</div>
              <div className="text-xs text-green-600">+{metrics.active_users_24h} active (24h)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Music className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold">{metrics.total_bands.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Bands</div>
              <div className="text-xs text-blue-600">{metrics.total_gigs_today} gigs today</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">${metrics.total_revenue_24h.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Revenue (24h)</div>
              <div className="text-xs text-green-600">+12% vs yesterday</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Activity className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-bold">{metrics.active_sessions}</div>
              <div className="text-sm text-muted-foreground">Active Sessions</div>
              <div className="text-xs text-muted-foreground">Uptime: {metrics.server_uptime}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="monitoring" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="moderation">Moderation</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="seasons">Seasons</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-6 h-6" />
                Real-time Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Server Status</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>API Response Time</span>
                      <Badge variant="outline" className="text-green-600">142ms</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Database Connections</span>
                      <Badge variant="outline">23/100</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Memory Usage</span>
                      <Badge variant="outline" className="text-yellow-600">67%</Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Recent Alerts</h4>
                  <div className="space-y-2">
                    <div className="p-2 bg-yellow-50 rounded text-sm">
                      <div className="font-medium">High CPU Usage</div>
                      <div className="text-muted-foreground">Server load at 78%</div>
                    </div>
                    <div className="p-2 bg-blue-50 rounded text-sm">
                      <div className="font-medium">New User Spike</div>
                      <div className="text-muted-foreground">+50 registrations in 1h</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                Suspicious Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userActions.map((action) => (
                  <div key={action.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className={getSeverityColor(action.severity)}>
                        {action.severity.toUpperCase()}
                      </Badge>
                      <div>
                        <div className="font-medium">{action.username}</div>
                        <div className="text-sm text-muted-foreground">{action.action}</div>
                        <div className="text-xs text-muted-foreground">{action.details}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        {new Date(action.timestamp).toLocaleDateString()}
                      </div>
                      <Button size="sm" variant="outline">
                        Investigate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="w-6 h-6" />
                Feature Flags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {featureFlags.map((flag) => (
                  <div key={flag.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{flag.name}</div>
                      <div className="text-sm text-muted-foreground">{flag.description}</div>
                      <Badge variant="outline" className="mt-1">{flag.category}</Badge>
                    </div>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={() => toggleFeatureFlag(flag.id)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moderation" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ban className="w-6 h-6" />
                  User Moderation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Username</label>
                  <Input
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    placeholder="Enter username to moderate"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Reason</label>
                  <Textarea
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Reason for action..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={banUser} variant="destructive" className="flex-1">
                    Ban User
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Warn User
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-6 h-6" />
                  Content Moderation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="p-3 border rounded-lg">
                    <div className="font-medium">Reported Song: "Inappropriate Title"</div>
                    <div className="text-sm text-muted-foreground">By: BandUser123</div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="destructive">Remove</Button>
                      <Button size="sm" variant="outline">Approve</Button>
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="font-medium">Reported Profile: Offensive Bio</div>
                    <div className="text-sm text-muted-foreground">By: NewUser456</div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="destructive">Remove</Button>
                      <Button size="sm" variant="outline">Approve</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                Create Live Event
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Event Title</label>
                  <Input
                    value={newEvent.title}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Summer Music Festival"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Event Type</label>
                  <select 
                    className="w-full p-2 border rounded"
                    value={newEvent.type}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="tournament">Tournament</option>
                    <option value="festival">Festival</option>
                    <option value="challenge">Challenge</option>
                    <option value="season">Season Event</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Event description and rules..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="datetime-local"
                    value={newEvent.start_date}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="datetime-local"
                    value={newEvent.end_date}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Rewards</label>
                  <Input
                    value={newEvent.rewards}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, rewards: e.target.value }))}
                    placeholder="$10,000 + Trophy"
                  />
                </div>
              </div>
              <Button onClick={createEvent} className="w-full">
                Create Event
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seasons" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-6 h-6" />
                Season Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {seasons.map((season) => (
                  <div key={season.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium">{season.name}</h3>
                        <div className="text-sm text-muted-foreground">
                          {new Date(season.start_date).toLocaleDateString()} - {new Date(season.end_date).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant={season.active ? "default" : "secondary"}>
                        {season.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(season.multipliers).map(([key, value]) => (
                        <div key={key} className="text-center p-2 bg-muted rounded">
                          <div className="text-sm font-medium">{key.replace('_', ' ')}</div>
                          <div className="text-lg font-bold text-primary">{value}x</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-6 h-6" />
                  User Engagement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Daily Active Users</span>
                    <span className="font-bold text-green-600">+8.3%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Average Session Time</span>
                    <span className="font-bold">34m 12s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Retention Rate (7d)</span>
                    <span className="font-bold text-blue-600">73%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Revenue per User</span>
                    <span className="font-bold text-green-600">$12.40</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-6 h-6" />
                  System Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>API Uptime</span>
                    <span className="font-bold text-green-600">99.97%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Database Performance</span>
                    <span className="font-bold text-green-600">Excellent</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Error Rate</span>
                    <span className="font-bold text-red-600">0.03%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Storage Used</span>
                    <span className="font-bold">2.4GB / 100GB</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-center">
        <Button onClick={loadAdminData} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh Data
        </Button>
      </div>
    </div>
  );
};

export default AdminDashboard;