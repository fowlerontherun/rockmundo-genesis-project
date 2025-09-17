import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData, type PlayerAttributes, type PlayerSkills } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { calculateLevel, getFameTitle, calculateEquipmentBonus } from "@/utils/gameBalance";
import { getStoredAvatarPreviewUrl } from "@/utils/avatar";
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
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface AchievementProgress {
  total: number;
  earned: number;
  remaining: number;
  progress: number;
  lastUnlockedAt: string | null;
}

interface WeeklyMetric {
  value: number;
  change: number;
  previous: number;
}

interface AudienceReactionSnapshot {
  energy: number;
  satisfaction: number;
  excitement: number;
  singing_along: number;
}

interface StagePerformanceDetail {
  stageName: string;
  score: number;
  audienceReaction?: AudienceReactionSnapshot;
  feedback: string[];
  bonuses: string[];
}

interface GigPerformanceDetail {
  id: string;
  gig_id: string | null;
  performed_at: string;
  earnings: number | null;
  performance_score: number | null;
  stage_results: StagePerformanceDetail[];
  audience_reaction: AudienceReactionSnapshot | null;
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
    songs: WeeklyMetric;
    gigs: WeeklyMetric;
    fans: WeeklyMetric;
  };
  achievements: AchievementProgress;
  recentGigPerformances: GigPerformanceDetail[];
}

type WeeklyStatsRow = Database['public']['Views']['weekly_stats']['Row'];
type GigPerformanceRow = Database['public']['Tables']['gig_performances']['Row'];

const RECENT_GIG_LIMIT = 5;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const parseAudienceReaction = (value: unknown): AudienceReactionSnapshot | null => {
  if (!isRecord(value)) return null;

  return {
    energy: toNumber(value.energy),
    satisfaction: toNumber(value.satisfaction),
    excitement: toNumber(value.excitement),
    singing_along: toNumber(value.singing_along)
  };
};

const parseStageResults = (value: unknown): StagePerformanceDetail[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map(stage => {
      if (!isRecord(stage)) return null;

      return {
        stageName: typeof stage.stageName === "string" ? stage.stageName : "Stage",
        score: toNumber(stage.score),
        audienceReaction: parseAudienceReaction(stage.audienceReaction),
        feedback: parseStringArray(stage.feedback),
        bonuses: parseStringArray(stage.bonuses)
      };
    })
    .filter((stage): stage is StagePerformanceDetail => stage !== null);
};

const PlayerStatistics = () => {
  const { user } = useAuth();
  const { profile, skills, attributes } = useGameData();
  const instrumentSkillKeys: (keyof PlayerSkills)[] = [
    "performance",
    "songwriting",
    "guitar",
    "vocals",
    "drums",
    "bass",
    "composition"
  ];
  const attributeKeys: (keyof PlayerAttributes)[] = [
    "creativity",
    "business",
    "marketing",
    "technical"
  ];
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
        gigPerformancesResponse,
        weeklyStatsResponse
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
          .select('id, gig_id, performed_at, earnings, performance_score, stage_results, audience_reaction')
          .eq('user_id', user.id)
          .order('performed_at', { ascending: false }),
        supabase
          .from('weekly_stats')
          .select('*')
          .eq('user_id', user.id)
          .order('week_start', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (songsResponse.error) throw songsResponse.error;
      if (equipmentResponse.error) throw equipmentResponse.error;
      if (achievementsResponse.error) throw achievementsResponse.error;
      if (playerAchievementsResponse.error) throw playerAchievementsResponse.error;
      if (gigPerformancesResponse.error) throw gigPerformancesResponse.error;
      if (achievementSummaryResponse.error && achievementSummaryResponse.status !== 406) {
        throw achievementSummaryResponse.error;
      }
      if (weeklyStatsResponse.error && weeklyStatsResponse.status !== 406) {
        throw weeklyStatsResponse.error;
      }

      const songs = songsResponse.data || [];
      const equipmentItems = equipmentResponse.data || [];
      const achievementsData = achievementsResponse.data || [];
      const playerAchievements = (playerAchievementsResponse.data as {
        achievement_id: string;
        unlocked_at: string | null;
      }[]) || [];
      const achievementSummary = achievementSummaryResponse.data;
      const gigPerformances = (gigPerformancesResponse.data as GigPerformanceRow[] | null) ?? [];
      const gigPerformanceDetails: GigPerformanceDetail[] = gigPerformances.map(performance => ({
        id: performance.id,
        gig_id: performance.gig_id,
        performed_at: performance.performed_at,
        earnings: performance.earnings === null ? null : Number(performance.earnings),
        performance_score: performance.performance_score === null ? null : Number(performance.performance_score),
        stage_results: parseStageResults(performance.stage_results),
        audience_reaction: parseAudienceReaction(performance.audience_reaction)
      }));
      const weeklyStatsRow = weeklyStatsResponse.data as WeeklyStatsRow | null;

      const buildMetric = (
        value?: number | null,
        change?: number | null,
        previous?: number | null
      ): WeeklyMetric => ({
        value: value ?? 0,
        change: change ?? 0,
        previous: previous ?? 0
      });

      const weeklyStats = weeklyStatsRow
        ? {
            songs: buildMetric(
              weeklyStatsRow.songs_created,
              weeklyStatsRow.songs_change,
              weeklyStatsRow.previous_songs
            ),
            gigs: buildMetric(
              weeklyStatsRow.gigs_performed,
              weeklyStatsRow.gigs_change,
              weeklyStatsRow.previous_gigs
            ),
            fans: buildMetric(
              weeklyStatsRow.fan_change,
              weeklyStatsRow.fans_change,
              weeklyStatsRow.previous_fans
            )
          }
        : {
            songs: buildMetric(),
            gigs: buildMetric(),
            fans: buildMetric()
          };

      // Calculate stats
      const totalSongs = songs.length;
      const releasedSongs = songs.filter(s => s.status === 'released').length;
      const totalStreams = songs.reduce((sum, s) => sum + (s.streams || 0), 0);
      const totalRevenue = songs.reduce((sum, s) => sum + (s.revenue || 0), 0);
      const bestChartPosition = Math.min(...(songs.filter(s => s.chart_position).map(s => s.chart_position) || [100]));
      const totalGigs = gigPerformanceDetails.length;

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
        },
        recentGigPerformances: gigPerformanceDetails
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
  }, [user]);

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
        avatar_url: getStoredAvatarPreviewUrl(row.avatar_url ?? null),
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

  if (loading || !profile || !skills || !attributes) {
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

  const weeklyMetricsConfig: Array<{
    key: 'songs' | 'gigs' | 'fans';
    title: string;
    icon: LucideIcon;
    description: string;
    valueClass: string;
    positivePrefix?: boolean;
  }> = [
    {
      key: 'songs',
      title: 'Songs Created',
      icon: Music,
      description: 'New tracks completed this week',
      valueClass: 'text-blue-600'
    },
    {
      key: 'gigs',
      title: 'Gigs Performed',
      icon: Calendar,
      description: 'Shows played for your fans',
      valueClass: 'text-purple-600'
    },
    {
      key: 'fans',
      title: 'Fans Gained',
      icon: Users,
      description: 'Net fan growth across all activities',
      valueClass: 'text-green-600',
      positivePrefix: true
    }
  ];

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
                  <div className="text-2xl font-bold">0</div>
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
                          src={profileAvatarPreview ?? undefined}
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
                              <AvatarImage src={entry.avatar_url ?? undefined} alt={displayName} />
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {weeklyMetricsConfig.map(({ key, title, icon: Icon, description, valueClass, positivePrefix }) => {
                    const metric = extendedStats?.weeklyStats[key] ?? { value: 0, change: 0, previous: 0 };
                    const { value, change, previous } = metric;
                    const formattedValue = positivePrefix
                      ? value > 0
                        ? `+${value.toLocaleString()}`
                        : value.toLocaleString()
                      : value.toLocaleString();
                    const ChangeIcon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : ArrowRight;
                    const changeColor =
                      change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-muted-foreground';
                    const formattedChange = change > 0 ? `+${change.toLocaleString()}` : change.toLocaleString();
                    const comparisonText =
                      previous === 0
                        ? 'No activity last week'
                        : `vs ${previous.toLocaleString()} last week`;

                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-primary/20 bg-muted/30 p-4 text-center shadow-sm"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Icon className="h-6 w-6 text-primary" />
                          <span className={`text-2xl font-bold ${valueClass}`}>{formattedValue}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-muted-foreground">{title}</p>
                        <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                          <ChangeIcon className={`h-4 w-4 ${changeColor}`} />
                          <span className={`${changeColor} font-semibold`}>{formattedChange}</span>
                          <span className="text-muted-foreground">{comparisonText}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
                      </div>
                    );
                  })}
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
                  {instrumentSkillKeys.map(skillKey => {
                    const value = Number(skills?.[skillKey] ?? 0);
                    return (
                      <div key={skillKey} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium capitalize">{skillKey.replace('_', ' ')}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{value}/100</span>
                            <Badge variant={value >= 80 ? "default" : value >= 50 ? "secondary" : "outline"}>
                              {value >= 80 ? "Expert" : value >= 50 ? "Advanced" : "Beginner"}
                            </Badge>
                          </div>
                        </div>
                        <Progress value={value} className="h-3" />
                      </div>
                    );
                  })}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground">Professional Attributes</h4>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {attributeKeys.map(attributeKey => {
                      const value = Number(attributes?.[attributeKey] ?? 0);
                      const percent = Math.min(100, (value / 1000) * 100);
                      return (
                        <div key={attributeKey} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium capitalize">{attributeKey.replace('_', ' ')}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">{value}/1000</span>
                              <Badge variant={value >= 700 ? "default" : value >= 400 ? "secondary" : "outline"}>
                                {value >= 700 ? "Elite" : value >= 400 ? "Established" : "Developing"}
                              </Badge>
                            </div>
                          </div>
                          <Progress value={percent} className="h-3" />
                        </div>
                      );
                    })}
                  </div>
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

            <Card>
              <CardHeader>
                <CardTitle>Recent Gig Performances</CardTitle>
                <CardDescription>Detailed breakdowns from your latest shows</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {extendedStats?.recentGigPerformances.length ? (
                  extendedStats.recentGigPerformances
                    .slice(0, RECENT_GIG_LIMIT)
                    .map(performance => {
                      const energyBadge = performance.audience_reaction
                        ? Math.round(performance.audience_reaction.energy)
                        : null;

                      return (
                        <div key={performance.id} className="space-y-3 rounded-lg border border-muted p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-semibold">
                                {new Date(performance.performed_at).toLocaleString()}
                              </div>
                              {performance.performance_score !== null && (
                                <div className="text-sm text-muted-foreground">
                                  Score: {performance.performance_score}%
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <Badge variant="secondary">
                                {`Earnings: $${performance.earnings !== null
                                  ? performance.earnings.toLocaleString()
                                  : '0'}`}
                              </Badge>
                              {energyBadge !== null && (
                                <Badge variant="outline">Crowd Energy: {energyBadge}%</Badge>
                              )}
                            </div>
                          </div>

                          {performance.stage_results.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">Stage Highlights</div>
                              <div className="space-y-2">
                                {performance.stage_results.map((stage, index) => (
                                  <div
                                    key={`${performance.id}-stage-${index}`}
                                    className="rounded-md bg-muted/60 p-3"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-medium">{stage.stageName}</span>
                                      <Badge
                                        variant={
                                          stage.score >= 80
                                            ? 'default'
                                            : stage.score >= 60
                                            ? 'secondary'
                                            : 'destructive'
                                        }
                                      >
                                        {stage.score.toFixed(1)}%
                                      </Badge>
                                    </div>
                                    {stage.audienceReaction && (
                                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                        <span>Energy: {Math.round(stage.audienceReaction.energy)}%</span>
                                        <span>Excitement: {Math.round(stage.audienceReaction.excitement)}%</span>
                                        <span>Satisfaction: {Math.round(stage.audienceReaction.satisfaction)}%</span>
                                        <span>Singing Along: {Math.round(stage.audienceReaction.singing_along)}%</span>
                                      </div>
                                    )}
                                    {stage.feedback.length > 0 && (
                                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                        {stage.feedback.map((item, feedbackIndex) => (
                                          <div key={feedbackIndex}>• {item}</div>
                                        ))}
                                      </div>
                                    )}
                                    {stage.bonuses.length > 0 && (
                                      <div className="mt-2 space-y-1 text-xs text-green-600">
                                        {stage.bonuses.map((bonus, bonusIndex) => (
                                          <div key={bonusIndex}>• {bonus}</div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Complete an advanced gig to unlock detailed performance breakdowns.
                  </p>
                )}
              </CardContent>
            </Card>
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