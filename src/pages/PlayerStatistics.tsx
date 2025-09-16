import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { calculateLevel, getFameTitle } from "@/utils/gameBalance";
import {
  User, 
  TrendingUp, 
  Star, 
  Music, 
  Calendar, 
  DollarSign,
  Trophy,
  Users,
  Play,
  Target,
  BarChart3,
  Crown,
  type LucideIcon
} from "lucide-react";

interface AchievementProgress {
  total: number;
  earned: number;
  remaining: number;
  progress: number;
  lastUnlockedAt: string | null;
}

interface ExtendedStats {
  totalSongs: number;
  releasedSongs: number;
  totalStreams: number;
  totalRevenue: number;
  bestChartPosition: number;
  totalGigs: number;
  equipmentValue: number;
  equipmentBonus: Record<string, number>;
  weeklyStats: {
    streams: number;
    revenue: number;
    fans: number;
    fame: number;
  };
  achievements: AchievementProgress;
}

type LeaderboardRow = Database["public"]["Views"]["leaderboards"]["Row"];

type LeaderboardEntry = LeaderboardRow;

type LeaderboardMetric = "fame" | "gigs" | "achievements";

type LeaderboardField = "fame" | "total_gigs" | "total_achievements";

const leaderboardMetricConfig: Record<LeaderboardMetric, {
  label: string;
  description: string;
  field: LeaderboardField;
  icon: LucideIcon;
  format: (value: number) => string;
}> = {
  fame: {
    label: "Fame",
    description: "Overall celebrity status across Rockmundo.",
    field: "fame",
    icon: Crown,
    format: (value: number) => value.toLocaleString(),
  },
  gigs: {
    label: "Gigs Performed",
    description: "Total gigs completed by each performer.",
    field: "total_gigs",
    icon: Calendar,
    format: (value: number) => value.toLocaleString(),
  },
  achievements: {
    label: "Achievements",
    description: "Unlocked achievements by dedicated artists.",
    field: "total_achievements",
    icon: Trophy,
    format: (value: number) => value.toLocaleString(),
  },
};

const PlayerStatistics = () => {
  const { user } = useAuth();
  const { profile, skills } = useGameData();
  const [extendedStats, setExtendedStats] = useState<ExtendedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [selectedLeaderboardMetric, setSelectedLeaderboardMetric] = useState<LeaderboardMetric>("fame");

  const fetchExtendedStats = useCallback(async () => {
    if (!user) return;

    try {
      const [
        songsResponse,
        equipmentResponse,
        achievementsResponse,
        playerAchievementsResponse,
        achievementSummaryResponse,
        gigPerformancesResponse
      ] = await Promise.all([
        supabase
          .from('songs')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('player_equipment')
          .select(`
            *,
            equipment:equipment_items!player_equipment_equipment_id_fkey (
              price,
              stat_boosts
            )
          `)
          .eq('user_id', user.id),
        supabase
          .from('achievements')
          .select('id'),
        supabase
          .from('player_achievements')
          .select('achievement_id, unlocked_at')
          .eq('user_id', user.id),
        supabase
          .from('player_achievement_summary')
          .select('earned_count, total_achievements, remaining_count, last_unlocked_at')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('gig_performances')
          .select('id, gig_id, performed_at, earnings, performance_score')
          .eq('user_id', user.id)
          .order('performed_at', { ascending: false })
      ]);

      if (songsResponse.error) throw songsResponse.error;
      if (equipmentResponse.error) throw equipmentResponse.error;
      if (achievementsResponse.error) throw achievementsResponse.error;
      if (playerAchievementsResponse.error) throw playerAchievementsResponse.error;
      if (gigPerformancesResponse.error) throw gigPerformancesResponse.error;
      if (achievementSummaryResponse.error && achievementSummaryResponse.status !== 406) {
        throw achievementSummaryResponse.error;
      }

      const songs = songsResponse.data || [];
      const equipmentItems = equipmentResponse.data || [];
      const achievementsData = achievementsResponse.data || [];
      const playerAchievements = (playerAchievementsResponse.data as {
        achievement_id: string;
        unlocked_at: string | null;
      }[]) || [];
      const achievementSummary = achievementSummaryResponse.data;
      const gigPerformances = gigPerformancesResponse.data || [];

      // Calculate stats
      const totalSongs = songs.length;
      const releasedSongs = songs.filter(s => s.status === 'released').length;
      const totalStreams = songs.reduce((sum, s) => sum + (s.streams || 0), 0);
      const totalRevenue = songs.reduce((sum, s) => sum + (s.revenue || 0), 0);
      const bestChartPosition = Math.min(...(songs.filter(s => s.chart_position).map(s => s.chart_position) || [100]));
      const totalGigs = gigPerformances.length;

      // Calculate equipment value and bonuses
      const equipmentValue = equipmentItems.reduce((sum, item) => {
        const price = item.equipment?.price || 0;
        return sum + Math.floor(price * (item.condition / 100));
      }, 0);

      const equippedItems = equipmentItems.filter(item => item.equipped || item.is_equipped);
      const equipmentBonus = equippedItems.reduce((bonus, item) => {
        const stats = item.equipment?.stat_boosts || {};
        Object.entries(stats).forEach(([stat, value]) => {
          bonus[stat] = (bonus[stat] || 0) + value;
        });
        return bonus;
      }, {} as Record<string, number>);

      const totalAchievements = achievementSummary?.total_achievements ?? achievementsData.length;
      const earnedAchievements = achievementSummary?.earned_count ?? playerAchievements.length;
      const remainingAchievements = achievementSummary?.remaining_count ?? Math.max(totalAchievements - earnedAchievements, 0);
      const lastUnlockedAt = achievementSummary?.last_unlocked_at ?? (playerAchievements.length
        ? playerAchievements.reduce<string | null>((latest, current) => {
            if (!current.unlocked_at) return latest;
            if (!latest) return current.unlocked_at;
            return new Date(current.unlocked_at) > new Date(latest) ? current.unlocked_at : latest;
          }, null)
        : null);
      const achievementProgress = totalAchievements > 0
        ? Math.min(100, Math.round((earnedAchievements / totalAchievements) * 100))
        : 0;

      // Mock weekly stats (in real implementation, this would be calculated from historical data)
      const profileFans = (profile as { fans?: number | null })?.fans ?? 0;
      const weeklyStats = {
        streams: Math.floor(totalStreams * 0.1),
        revenue: Math.floor(totalRevenue * 0.1),
        fans: Math.floor(profileFans * 0.05),
        fame: Math.floor((profile?.fame || 0) * 0.02)
      };

      setExtendedStats({
        totalSongs,
        releasedSongs,
        totalStreams,
        totalRevenue,
        bestChartPosition: bestChartPosition === Infinity ? 0 : bestChartPosition,
        totalGigs,
        equipmentValue,
        equipmentBonus,
        weeklyStats,
        achievements: {
          total: totalAchievements,
          earned: earnedAchievements,
          remaining: remainingAchievements,
          progress: achievementProgress,
          lastUnlockedAt
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error fetching extended stats:', error.message);
      } else {
        console.error('Error fetching extended stats:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  const fetchLeaderboard = useCallback(async () => {
    if (!user) return;

    try {
      setLeaderboardLoading(true);
      setLeaderboardError(null);

      const { data, error } = await supabase
        .from('leaderboards')
        .select('*');

      if (error) throw error;

      const rows = ((data ?? []) as LeaderboardRow[]).map(row => ({
        ...row,
        total_revenue: Number(row.total_revenue ?? 0),
      }));

      setLeaderboardEntries(rows);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error fetching leaderboard:', error.message);
      } else {
        console.error('Error fetching leaderboard:', error);
      }
      setLeaderboardError('Failed to load leaderboard data.');
    } finally {
      setLeaderboardLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchExtendedStats();
      fetchLeaderboard();
    }
  }, [user, fetchExtendedStats, fetchLeaderboard]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`player-achievements-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_achievements',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchExtendedStats();
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchExtendedStats, fetchLeaderboard]);

  const metricConfig = leaderboardMetricConfig[selectedLeaderboardMetric];
  const sortedLeaderboard = useMemo(() => {
    const entries = [...leaderboardEntries];
    return entries.sort((a, b) => b[metricConfig.field] - a[metricConfig.field]);
  }, [leaderboardEntries, metricConfig.field]);
  const topLeaderboardEntries = useMemo(() => sortedLeaderboard.slice(0, 5), [sortedLeaderboard]);
  const playerRank = useMemo(() => {
    if (!user) return null;
    const index = sortedLeaderboard.findIndex(entry => entry.user_id === user.id);
    return index === -1 ? null : index + 1;
  }, [sortedLeaderboard, user]);
  const playerMetricValue = useMemo(() => {
    if (!user) return 0;
    const entry = leaderboardEntries.find(item => item.user_id === user.id);
    if (!entry) return 0;
    return entry[metricConfig.field];
  }, [leaderboardEntries, metricConfig.field, user]);

  if (loading || !profile || !skills) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-lg text-foreground">Loading statistics...</p>
        </div>
      </div>
    );
  }

  const playerLevel = calculateLevel(profile.experience);
  const fameTitle = getFameTitle(profile.fame);
  const skillAverage = Math.round(
    (skills.performance + (skills.songwriting || 0) + (skills.guitar || 0) + (skills.vocals || 0) + (skills.drums || 0)) / 5
  );
  const playerAvatarLabel = (profile.display_name || profile.username || 'P').slice(0, 2).toUpperCase();
  const MetricIcon = metricConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Player Statistics
          </h1>
          <p className="text-lg text-muted-foreground">
            Your complete musical journey analytics
          </p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="music">Music</TabsTrigger>
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Player Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <User className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <div className="text-2xl font-bold">Level {playerLevel}</div>
                  <div className="text-sm text-muted-foreground">Player Level</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <Crown className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <div className="text-lg font-bold">{fameTitle}</div>
                  <div className="text-sm text-muted-foreground">Fame Status</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold">${profile.cash.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Current Cash</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">{profile.fans?.toLocaleString() || 0}</div>
                  <div className="text-sm text-muted-foreground">Total Fans</div>
                </CardContent>
              </Card>
            </div>

            {/* Career Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Career Highlights
                </CardTitle>
                <CardDescription>Your musical achievements and milestones</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{extendedStats?.totalSongs || 0}</div>
                    <div className="text-sm text-muted-foreground">Songs Created</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{extendedStats?.releasedSongs || 0}</div>
                    <div className="text-sm text-muted-foreground">Songs Released</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">{extendedStats?.totalGigs || 0}</div>
                    <div className="text-sm text-muted-foreground">Gigs Performed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">
                      #{extendedStats?.bestChartPosition || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">Best Chart Position</div>
                  </div>
                </div>
                {extendedStats && (
                  <div className="mt-6 rounded-lg border border-dashed border-primary/30 bg-muted/40 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <Trophy className="h-8 w-8 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">Achievement Progress</p>
                          <p className="text-xl font-semibold">
                            {extendedStats.achievements.earned} / {extendedStats.achievements.total} unlocked
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Badge variant="secondary" className="uppercase tracking-wide">
                          {extendedStats.achievements.remaining} remaining
                        </Badge>
                        <span className="text-muted-foreground">
                          {extendedStats.achievements.total > 0
                            ? `${extendedStats.achievements.progress}% complete`
                            : 'No achievements available yet'}
                        </span>
                      </div>
                    </div>
                    <Progress value={extendedStats.achievements.progress} className="mt-4 h-2" />
                    <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
                      <span>{extendedStats.achievements.earned} earned</span>
                      <span>{extendedStats.achievements.remaining} to go</span>
                    </div>
                    {extendedStats.achievements.lastUnlockedAt ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Last unlocked on {new Date(extendedStats.achievements.lastUnlockedAt).toLocaleString()}
                      </p>
                    ) : (
                      extendedStats.achievements.total > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Unlock your first achievement to start your streak!
                        </p>
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Global Leaderboards */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Global Leaderboards
                    </CardTitle>
                    <CardDescription>{metricConfig.description}</CardDescription>
                  </div>
                  <ToggleGroup
                    type="single"
                    value={selectedLeaderboardMetric}
                    onValueChange={(value) => {
                      if (value) {
                        setSelectedLeaderboardMetric(value as LeaderboardMetric);
                      }
                    }}
                    className="grid grid-cols-3 gap-2 md:inline-flex"
                  >
                    {Object.entries(leaderboardMetricConfig).map(([key, config]) => {
                      const metricKey = key as LeaderboardMetric;
                      const OptionIcon = config.icon;
                      return (
                        <ToggleGroupItem
                          key={metricKey}
                          value={metricKey}
                          className="px-3 py-2 text-sm font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        >
                          <span className="flex items-center gap-2">
                            <OptionIcon className="h-4 w-4" />
                            {config.label}
                          </span>
                        </ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border border-primary/30 bg-muted/40 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={profile.avatar_url || undefined}
                          alt={profile.display_name || profile.username || 'Player avatar'}
                        />
                        <AvatarFallback>{playerAvatarLabel}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm text-muted-foreground">Your Position</p>
                        <p className="text-2xl font-bold text-primary">
                          {playerRank ? `#${playerRank}` : "Unranked"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-2 text-sm md:items-end">
                      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <MetricIcon className="h-4 w-4 text-primary" />
                        <span>{metricConfig.format(playerMetricValue)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{metricConfig.label}</span>
                      {!playerRank && (
                        <span className="text-xs text-muted-foreground">
                          Complete more activities to enter the leaderboard.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {leaderboardError && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {leaderboardError}
                  </div>
                )}
                <div className="space-y-3">
                  {leaderboardLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Skeleton key={index} className="h-14 w-full" />
                      ))}
                    </div>
                  ) : topLeaderboardEntries.length > 0 ? (
                    topLeaderboardEntries.map((entry, index) => {
                      const displayName = entry.display_name || entry.username || 'Unknown Artist';
                      const isCurrentUser = entry.user_id === user?.id;
                      const metricValue = metricConfig.format(entry[metricConfig.field]);
                      return (
                        <div
                          key={entry.user_id}
                          className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                            isCurrentUser ? 'border-primary bg-primary/10' : 'border-border bg-card/40'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={entry.avatar_url || undefined} alt={displayName} />
                              <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold">{displayName}</div>
                              {entry.username && (
                                <div className="text-xs text-muted-foreground">@{entry.username}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-2 text-sm font-semibold">
                              <MetricIcon className="h-4 w-4 text-primary" />
                              <span>{metricValue}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">{metricConfig.label}</div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No leaderboard data available yet. Keep playing to be featured here.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Weekly Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Weekly Performance
                </CardTitle>
                <CardDescription>Your recent activity and growth</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {extendedStats?.weeklyStats.streams.toLocaleString() || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Streams This Week</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      ${extendedStats?.weeklyStats.revenue.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-sm text-muted-foreground">Revenue This Week</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      +{extendedStats?.weeklyStats.fans.toLocaleString() || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">New Fans</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      +{extendedStats?.weeklyStats.fame.toLocaleString() || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Fame Gained</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="skills" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Skill Breakdown
                </CardTitle>
                <CardDescription>Your current skill levels and progress</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(skills).filter(([key]) => key !== 'id' && key !== 'user_id').map(([skill, value]) => (
                    <div key={skill} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium capitalize">{skill.replace('_', ' ')}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{value}/100</span>
                          <Badge variant={value >= 80 ? "default" : value >= 50 ? "secondary" : "outline"}>
                            {value >= 80 ? "Expert" : value >= 50 ? "Advanced" : "Beginner"}
                          </Badge>
                        </div>
                      </div>
                      <Progress value={value} className="h-3" />
                    </div>
                  ))}
                </div>

                <div className="text-center pt-4">
                  <div className="text-3xl font-bold text-primary">{skillAverage}/100</div>
                  <div className="text-muted-foreground">Overall Skill Average</div>
                </div>
              </CardContent>
            </Card>

            {/* Equipment Bonuses */}
            {extendedStats && Object.keys(extendedStats.equipmentBonus).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Equipment Bonuses
                  </CardTitle>
                  <CardDescription>Stat boosts from your equipped gear</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(extendedStats.equipmentBonus).map(([stat, bonus]) => (
                      <div key={stat} className="text-center">
                        <div className="text-2xl font-bold text-green-600">+{bonus}</div>
                        <div className="text-sm text-muted-foreground capitalize">{stat.replace('_', ' ')}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="music" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5" />
                  Music Career Statistics
                </CardTitle>
                <CardDescription>Your songwriting and performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <Play className="h-12 w-12 mx-auto mb-2 text-primary" />
                    <div className="text-3xl font-bold">{extendedStats?.totalStreams.toLocaleString() || 0}</div>
                    <div className="text-sm text-muted-foreground">Total Streams</div>
                  </div>
                  <div className="text-center">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 text-green-500" />
                    <div className="text-3xl font-bold">${extendedStats?.totalRevenue.toFixed(2) || '0.00'}</div>
                    <div className="text-sm text-muted-foreground">Music Revenue</div>
                  </div>
                  <div className="text-center">
                    <Target className="h-12 w-12 mx-auto mb-2 text-yellow-500" />
                    <div className="text-3xl font-bold">#{extendedStats?.bestChartPosition || 'N/A'}</div>
                    <div className="text-sm text-muted-foreground">Best Chart Position</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Song Portfolio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Songs:</span>
                    <span className="font-bold">{extendedStats?.totalSongs || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Released Songs:</span>
                    <span className="font-bold text-green-600">{extendedStats?.releasedSongs || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Draft Songs:</span>
                    <span className="font-bold text-yellow-600">
                      {(extendedStats?.totalSongs || 0) - (extendedStats?.releasedSongs || 0)}
                    </span>
                  </div>
                  <div className="pt-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Release Rate</span>
                      <span>
                        {extendedStats?.totalSongs ? 
                          Math.round(((extendedStats.releasedSongs || 0) / extendedStats.totalSongs) * 100) : 0
                        }%
                      </span>
                    </div>
                    <Progress 
                      value={extendedStats?.totalSongs ? 
                        ((extendedStats.releasedSongs || 0) / extendedStats.totalSongs) * 100 : 0
                      } 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Gigs:</span>
                    <span className="font-bold">{extendedStats?.totalGigs || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fame Points:</span>
                    <span className="font-bold text-purple-600">{profile.fame.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Experience:</span>
                    <span className="font-bold text-blue-600">{profile.experience.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="equipment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Equipment Overview
                </CardTitle>
                <CardDescription>Your gear collection and investments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <DollarSign className="h-16 w-16 mx-auto mb-4 text-primary" />
                  <div className="text-4xl font-bold">${extendedStats?.equipmentValue.toLocaleString() || 0}</div>
                  <div className="text-muted-foreground">Total Equipment Value</div>
                </div>
              </CardContent>
            </Card>

            {extendedStats && Object.keys(extendedStats.equipmentBonus).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Active Equipment Bonuses</CardTitle>
                  <CardDescription>Stat boosts from your currently equipped gear</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(extendedStats.equipmentBonus).map(([stat, bonus]) => (
                      <div key={stat} className="bg-muted p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-600">+{bonus}</div>
                        <div className="text-sm text-muted-foreground capitalize">
                          {stat.replace('_', ' ')} Boost
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PlayerStatistics;