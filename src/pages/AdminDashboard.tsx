import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth-context';
import { toast } from '@/components/ui/sonner-toast';
import {
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
  description: string | null;
  enabled: boolean;
  category: string | null;
}

interface UserAction {
  id: string;
  user_id: string | null;
  username: string | null;
  action: string;
  details: string | null;
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

interface NewSeasonForm {
  name: string;
  start_date: string;
  end_date: string;
  multipliers: string;
  active: boolean;
}

const USER_ACTIONS_PAGE_SIZE = 10;

type FeatureFlagRecord = {
  id: string;
  name: string;
  description?: string | null;
  enabled?: boolean | null;
  category?: string | null;
};

type SeasonRecord = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  multipliers?: Record<string, number> | null;
  active?: boolean | null;
};

type UserActionRecord = {
  id: string;
  user_id?: string | null;
  username?: string | null;
  action?: string | null;
  details?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
  severity?: string | null;
};

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
  const [userActionsPage, setUserActionsPage] = useState(0);
  const [userActionsTotal, setUserActionsTotal] = useState(0);
  const [userActionsLoading, setUserActionsLoading] = useState(false);
  const [userActionsHasMore, setUserActionsHasMore] = useState(false);
  const [userActionsTotalKnown, setUserActionsTotalKnown] = useState(true);
  const [updatingFlagId, setUpdatingFlagId] = useState<string | null>(null);
  const [banningUser, setBanningUser] = useState(false);
  const [creatingSeason, setCreatingSeason] = useState(false);
  const [newSeason, setNewSeason] = useState<NewSeasonForm>({
    name: '',
    start_date: '',
    end_date: '',
    multipliers: '',
    active: false
  });

  const fetchFeatureFlags = useCallback(async () => {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    const normalizedFlags = (data ?? []).map((flag: FeatureFlagRecord) => ({
      id: flag.id,
      name: flag.name,
      description: flag.description ?? null,
      enabled: Boolean(flag.enabled),
      category: flag.category ?? null
    })) as FeatureFlag[];

    setFeatureFlags(normalizedFlags);
  }, []);

  const fetchSeasons = useCallback(async () => {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      throw error;
    }

    const normalizedSeasons = (data ?? []).map((season: SeasonRecord) => ({
      id: season.id,
      name: season.name,
      start_date: season.start_date,
      end_date: season.end_date,
      multipliers: (season.multipliers as Record<string, number> | null) ?? {},
      active: Boolean(season.active)
    })) as SeasonConfig[];

    setSeasons(normalizedSeasons);
  }, []);

  const fetchUserActions = useCallback(async (page: number) => {
    setUserActionsLoading(true);

    try {
      const from = page * USER_ACTIONS_PAGE_SIZE;
      const to = from + USER_ACTIONS_PAGE_SIZE - 1;

      let result = await supabase
        .from('user_actions')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false })
        .range(from, to);

      if (result.error && result.error.message?.toLowerCase().includes('timestamp')) {
        result = await supabase
          .from('user_actions')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, to);
      }

      if (result.error) {
        throw result.error;
      }

      const normalizedActions = (result.data ?? []).map((action: UserActionRecord) => ({
        id: action.id,
        user_id: action.user_id ?? null,
        username: action.username ?? null,
        action: action.action ?? '',
        details: action.details ?? null,
        timestamp: action.timestamp ?? action.created_at ?? new Date().toISOString(),
        severity: (action.severity ?? 'low') as UserAction['severity'],
      })) as UserAction[];

      const totalCount = result.count ?? normalizedActions.length;

      setUserActions(normalizedActions);
      setUserActionsTotal(totalCount);
      setUserActionsTotalKnown(result.count !== null && result.count !== undefined);
      setUserActionsHasMore(
        result.count === null
          ? normalizedActions.length === USER_ACTIONS_PAGE_SIZE
          : (page + 1) * USER_ACTIONS_PAGE_SIZE < totalCount
      );
      setUserActionsPage(page);
    } finally {
      setUserActionsLoading(false);
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);

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

      const tasks = [
        { name: 'feature flags', promise: fetchFeatureFlags() },
        { name: 'seasons', promise: fetchSeasons() },
        { name: 'user actions', promise: fetchUserActions(0) }
      ];

      const results = await Promise.allSettled(tasks.map(task => task.promise));
      const failures = results
        .map((result, index) => ({ result, name: tasks[index].name }))
        .filter((item): item is { result: PromiseRejectedResult; name: string } => item.result.status === 'rejected');

      if (failures.length > 0) {
        failures.forEach((failure) => {
          console.error(`Error loading ${failure.name}:`, failure.result.reason);
        });
        const failureNames = failures.map((failure) => failure.name).join(', ');
        toast.error(`Failed to load ${failureNames}. Please try again.`);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [fetchFeatureFlags, fetchSeasons, fetchUserActions]);

  const toggleFeatureFlag = async (flagId: string, newValue: boolean) => {
    const previousFlags = featureFlags.map(flag => ({ ...flag }));

    setUpdatingFlagId(flagId);
    setFeatureFlags(prev => prev.map(flag =>
      flag.id === flagId ? { ...flag, enabled: newValue } : flag
    ));

    try {
      const { error } = await supabase
        .from('feature_flags')
        .update({ enabled: newValue })
        .eq('id', flagId);

      if (error) {
        throw error;
      }

      toast.success('Feature flag updated successfully');
    } catch (error) {
      console.error('Error updating feature flag:', error);
      setFeatureFlags(previousFlags);
      toast.error('Failed to update feature flag');
    } finally {
      setUpdatingFlagId(null);
    }
  };

  const banUser = async () => {
    if (!selectedUser || !banReason) {
      toast.error('Please select a user and provide a reason');
      return;
    }

    try {
      setBanningUser(true);

      const payload = {
        user_id: selectedUser,
        username: selectedUser,
        action: 'User Ban',
        details: banReason,
        timestamp: new Date().toISOString(),
        severity: 'critical' as const
      };

      const { error } = await supabase.from('user_actions').insert([payload]);

      if (error) {
        throw error;
      }

      toast.success(`User ${selectedUser} has been banned: ${banReason}`);
      setSelectedUser('');
      setBanReason('');

      try {
        await fetchUserActions(0);
      } catch (refreshError) {
        console.error('Error refreshing user actions:', refreshError);
        toast.error('User banned, but failed to refresh activity log');
      }
    } catch (error) {
      console.error('Error banning user:', error);
      toast.error('Failed to ban user');
    } finally {
      setBanningUser(false);
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
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    }
  };

  const createSeason = async () => {
    if (!newSeason.name || !newSeason.start_date || !newSeason.end_date) {
      toast.error('Please provide a name, start date, and end date for the season');
      return;
    }

    let multipliersPayload: Record<string, number> = {};

    if (newSeason.multipliers.trim()) {
      try {
        const parsed = JSON.parse(newSeason.multipliers);

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Multipliers must be a JSON object');
        }

        multipliersPayload = Object.entries(parsed).reduce((acc, [key, value]) => {
          const numericValue = Number(value);

          if (!Number.isFinite(numericValue)) {
            throw new Error('Multipliers must contain numeric values');
          }

          acc[key] = numericValue;
          return acc;
        }, {} as Record<string, number>);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid multipliers format';
        toast.error(message);
        return;
      }
    }

    try {
      setCreatingSeason(true);

      const { error } = await supabase.from('seasons').insert([{
        name: newSeason.name,
        start_date: newSeason.start_date,
        end_date: newSeason.end_date,
        multipliers: multipliersPayload,
        active: newSeason.active
      }]);

      if (error) {
        throw error;
      }

      toast.success(`Season "${newSeason.name}" created successfully`);
      setNewSeason({
        name: '',
        start_date: '',
        end_date: '',
        multipliers: '',
        active: false
      });

      try {
        await fetchSeasons();
      } catch (refreshError) {
        console.error('Error refreshing seasons:', refreshError);
        toast.error('Season created, but failed to refresh list');
      }
    } catch (error) {
      console.error('Error creating season:', error);
      toast.error('Failed to create season');
    } finally {
      setCreatingSeason(false);
    }
  };

  const handleUserActionsPageChange = async (direction: 'previous' | 'next') => {
    const totalPages = userActionsTotal > 0
      ? Math.ceil(userActionsTotal / USER_ACTIONS_PAGE_SIZE)
      : userActionsHasMore
        ? userActionsPage + 2
        : 1;

    if (direction === 'previous') {
      if (userActionsPage === 0) {
        return;
      }

      const previousPage = userActionsPage - 1;

      try {
        await fetchUserActions(previousPage);
      } catch (error) {
        console.error('Error loading user actions:', error);
        toast.error('Failed to load user actions');
      }

      return;
    }

    if (!userActionsHasMore && userActionsPage + 1 >= totalPages) {
      return;
    }

    const nextPage = userActionsPage + 1;

    try {
      await fetchUserActions(nextPage);
    } catch (error) {
      console.error('Error loading user actions:', error);
      toast.error('Failed to load user actions');
    }
  };

  const totalUserActionsPages = userActionsTotal > 0
    ? Math.max(1, Math.ceil(userActionsTotal / USER_ACTIONS_PAGE_SIZE))
    : userActionsHasMore
      ? userActionsPage + 2
      : Math.max(1, userActionsPage + (userActions.length > 0 ? 1 : 0));

  const userActionsStart = userActions.length === 0 ? 0 : userActionsPage * USER_ACTIONS_PAGE_SIZE + 1;
  const userActionsEnd = userActions.length === 0 ? 0 : userActionsPage * USER_ACTIONS_PAGE_SIZE + userActions.length;
  const canGoToPreviousPage = userActionsPage > 0;
  const canGoToNextPage = userActionsHasMore || (userActionsTotal > 0 && userActionsPage + 1 < totalUserActionsPages);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  useEffect(() => {
    if (user) {
      loadAdminData();
    }
  }, [user, loadAdminData]);

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
              <div className="space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-muted-foreground">
                    {userActions.length === 0
                      ? 'No actions to display'
                      : userActionsTotalKnown
                        ? `Showing ${userActionsStart}-${userActionsEnd} of ${userActionsTotal}`
                        : `Showing ${userActionsStart}-${userActionsEnd}${userActionsHasMore ? '+' : ''}`}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUserActionsPageChange('previous')}
                      disabled={userActionsLoading || !canGoToPreviousPage}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {userActionsPage + 1}
                      {userActionsTotalKnown ? ` of ${totalUserActionsPages}` : userActionsHasMore ? ' +' : ''}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUserActionsPageChange('next')}
                      disabled={userActionsLoading || !canGoToNextPage}
                    >
                      Next
                    </Button>
                  </div>
                </div>
                {userActionsLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : userActions.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No suspicious activity found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userActions.map((action) => (
                      <div key={action.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge className={getSeverityColor(action.severity)}>
                            {action.severity.toUpperCase()}
                          </Badge>
                          <div>
                            <div className="font-medium">{action.username ?? 'Unknown user'}</div>
                            <div className="text-sm text-muted-foreground">{action.action}</div>
                            {action.details && (
                              <div className="text-xs text-muted-foreground">{action.details}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <div className="text-sm text-muted-foreground">
                            {new Date(action.timestamp).toLocaleString()}
                          </div>
                          <Button size="sm" variant="outline">
                            Investigate
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                      <div className="text-sm text-muted-foreground">
                        {flag.description ?? 'No description provided'}
                      </div>
                      <Badge variant="outline" className="mt-1">
                        {flag.category ?? 'uncategorized'}
                      </Badge>
                    </div>
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(checked) => toggleFeatureFlag(flag.id, checked)}
                      disabled={updatingFlagId === flag.id}
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
                  <Button
                    onClick={banUser}
                    variant="destructive"
                    className="flex-1"
                    disabled={banningUser}
                  >
                    {banningUser ? 'Banning...' : 'Ban User'}
                  </Button>
                  <Button variant="outline" className="flex-1" disabled={banningUser}>
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
                <Database className="w-6 h-6" />
                Create Season
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Season Name</label>
                  <Input
                    value={newSeason.name}
                    onChange={(e) => setNewSeason(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Summer Festival Season"
                  />
                </div>
                <div className="flex items-center gap-3 md:justify-end pt-2">
                  <Switch
                    id="season-active"
                    checked={newSeason.active}
                    onCheckedChange={(checked) => setNewSeason(prev => ({ ...prev, active: checked }))}
                  />
                  <label htmlFor="season-active" className="text-sm font-medium">Active</label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <Input
                    type="date"
                    value={newSeason.start_date}
                    onChange={(e) => setNewSeason(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <Input
                    type="date"
                    value={newSeason.end_date}
                    onChange={(e) => setNewSeason(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Multipliers (JSON)</label>
                <Textarea
                  value={newSeason.multipliers}
                  onChange={(e) => setNewSeason(prev => ({ ...prev, multipliers: e.target.value }))}
                  placeholder='{"gig_payment": 1.5, "fan_gain": 1.3}'
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Provide key-value pairs where each value is a numeric multiplier (e.g. 1.5).
                </p>
              </div>
              <Button onClick={createSeason} className="w-full" disabled={creatingSeason}>
                {creatingSeason ? 'Creating Season...' : 'Create Season'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-6 h-6" />
                Season Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {seasons.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No seasons configured yet.
                  </div>
                ) : (
                  seasons.map((season) => (
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
                        {Object.entries(season.multipliers).length > 0 ? (
                          Object.entries(season.multipliers).map(([key, value]) => (
                            <div key={key} className="text-center p-2 bg-muted rounded">
                              <div className="text-sm font-medium">{key.replace(/_/g, ' ')}</div>
                              <div className="text-lg font-bold text-primary">{value}x</div>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-full text-center text-sm text-muted-foreground">
                            No multipliers configured.
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
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