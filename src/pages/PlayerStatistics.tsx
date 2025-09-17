import { useState, useEffect, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  ArrowRight,
  Lock
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

interface SkillProgressEntry {
  id: string;
  slug: string;
  name: string;
  currentValue: number;
  maxValue: number;
  progressPercent: number;
  unlocked: boolean;
  description?: string | null;
  category?: string | null;
  parentSkillName?: string | null;
  parentSkillSlug?: string | null;
  unlockDescription?: string | null;
  requirementValue?: number | null;
  order?: number | null;
}

type RawSkillProgressRow = Record<string, unknown>;

const formatLabel = (value: string) =>
  value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const readStringField = (row: RawSkillProgressRow, keys: string[]): string | null => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
};

const readNumberField = (row: RawSkillProgressRow, keys: string[]): number | null => {
  for (const key of keys) {
    if (!(key in row)) continue;
    const value = row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
};

const readBooleanField = (row: RawSkillProgressRow, keys: string[]): boolean | null => {
  for (const key of keys) {
    if (!(key in row)) continue;
    const value = row[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (!normalized) continue;
      if (["true", "t", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "f", "0", "no", "n"].includes(normalized)) return false;
    }
  }

  return null;
};

const ensureSentence = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const normalizeSkillProgressRow = (row: RawSkillProgressRow): SkillProgressEntry | null => {
  const slug = readStringField(row, ["skill_slug", "slug", "skill", "skill_key", "id"]);
  if (!slug) return null;

  const id = readStringField(row, ["id", "skill_id", "definition_id"]) ?? slug;
  const name = readStringField(row, ["skill_name", "name", "title"]) ?? formatLabel(slug);
  const description = readStringField(row, ["skill_description", "description", "summary"]);
  const category = readStringField(row, ["category", "skill_category", "type"]);
  const parentSkillSlug = readStringField(row, ["parent_skill_slug", "parent_slug", "parent_skill_key"]);
  const parentSkillNameRaw = readStringField(row, ["parent_skill_name", "parent_name", "parent_skill", "parent_title"]);
  const parentSkillName = parentSkillNameRaw ?? (parentSkillSlug ? formatLabel(parentSkillSlug) : null);

  const currentValueRaw =
    readNumberField(row, ["current_value", "current_level", "value", "level", "progress_value", "skill_value", "current_points"]) ??
    0;
  const maxValueRaw = readNumberField(row, ["max_value", "max_level", "cap", "goal_value", "target_value", "max_points"]) ?? 100;
  const sanitizedMaxValue = maxValueRaw > 0 ? maxValueRaw : 100;
  const sanitizedCurrentValue = Math.max(0, Math.min(currentValueRaw, sanitizedMaxValue));

  const progressPercentExplicit = readNumberField(row, [
    "progress_percent",
    "completion",
    "progress",
    "percent_complete",
    "progress_percentage"
  ]);
  const derivedProgress = sanitizedMaxValue ? (sanitizedCurrentValue / sanitizedMaxValue) * 100 : 0;
  const progressPercent = Math.max(0, Math.min(100, progressPercentExplicit ?? derivedProgress));

  const unlockedDirect = readBooleanField(row, ["is_unlocked", "unlocked", "has_access"]);
  const lockedDirect = readBooleanField(row, ["is_locked", "locked"]);
  const unlocked =
    unlockedDirect !== null ? unlockedDirect : lockedDirect !== null ? !lockedDirect : sanitizedCurrentValue > 0;

  const parentRequirementDescription = readStringField(row, [
    "parent_requirement_description",
    "parent_requirement",
    "parent_skill_requirement_description"
  ]);
  const parentRequirementValue = readNumberField(row, [
    "parent_requirement_level",
    "parent_skill_requirement_level",
    "required_parent_level",
    "parent_skill_required_value"
  ]);

  const unlockRequirementDescription = readStringField(row, [
    "unlock_description",
    "unlock_requirement_description",
    "unlock_requirement",
    "requirement_description",
    "requirement"
  ]);
  const unlockRequirementValue = readNumberField(row, [
    "unlock_value",
    "unlock_level",
    "required_value",
    "requirement_value",
    "unlock_requirement_value"
  ]);

  const order = readNumberField(row, ["display_order", "order_index", "sort_order", "position"]);

  return {
    id,
    slug,
    name,
    currentValue: sanitizedCurrentValue,
    maxValue: sanitizedMaxValue,
    progressPercent,
    unlocked,
    description,
    category,
    parentSkillName,
    parentSkillSlug,
    unlockDescription: parentRequirementDescription ?? unlockRequirementDescription ?? null,
    requirementValue: parentRequirementValue ?? unlockRequirementValue ?? null,
    order: order ?? null
  };
};

const buildRequirementMessage = (entry: SkillProgressEntry) => {
  const requirementLevel =
    typeof entry.requirementValue === "number" && Number.isFinite(entry.requirementValue)
      ? Math.round(entry.requirementValue)
      : null;

  if (entry.unlockDescription && entry.parentSkillName) {
    const requirementText = requirementLevel
      ? `Requires ${entry.parentSkillName} level ${requirementLevel}.`
      : `Requires ${entry.parentSkillName}.`;
    const base = ensureSentence(entry.unlockDescription);
    return `${base} ${requirementText}`.trim();
  }

  if (entry.unlockDescription) {
    return entry.unlockDescription;
  }

  if (entry.parentSkillName) {
    return requirementLevel
      ? `Requires ${entry.parentSkillName} level ${requirementLevel} to unlock.`
      : `Requires progress in ${entry.parentSkillName} to unlock.`;
  }

  return "Unlock this skill by progressing through related activities or story milestones.";
};

const resolveSkillBadge = (value: number) => {
  if (value >= 80) {
    return { label: "Expert", variant: "default" as const };
  }

  if (value >= 50) {
    return { label: "Advanced", variant: "secondary" as const };
  }

  if (value > 0) {
    return { label: "Beginner", variant: "outline" as const };
  }

  return { label: "Untrained", variant: "outline" as const };
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
  const [skillProgress, setSkillProgress] = useState<SkillProgressEntry[]>([]);
  const [skillProgressLoading, setSkillProgressLoading] = useState(false);
  const [skillProgressError, setSkillProgressError] = useState<string | null>(null);

  const fallbackSkillEntries = useMemo<SkillProgressEntry[]>(() => {
    if (!skills) return [];

    return Object.entries(skills)
      .filter(([key]) => !["id", "user_id", "profile_id", "created_at", "updated_at"].includes(key))
      .map(([key, value], index) => {
        const numericValue = typeof value === "number" ? value : Number(value ?? 0);
        const clampedValue = Number.isFinite(numericValue)
          ? Math.max(0, Math.min(numericValue, 100))
          : 0;

        return {
          id: key,
          slug: key,
          name: formatLabel(key),
          currentValue: clampedValue,
          maxValue: 100,
          progressPercent: Math.max(0, Math.min(clampedValue, 100)),
          unlocked: true,
          order: index
        } satisfies SkillProgressEntry;
      });
  }, [skills]);

  const baseSkillEntries = useMemo<SkillProgressEntry[]>(() => {
    if (skillProgress.length > 0) {
      return skillProgress;
    }

    return fallbackSkillEntries;
  }, [skillProgress, fallbackSkillEntries]);

  const sortedSkillEntries = useMemo(() => {
    const entries = [...baseSkillEntries];

    return entries.sort((a, b) => {
      if (a.order !== null && b.order !== null && a.order !== undefined && b.order !== undefined && a.order !== b.order) {
        return a.order - b.order;
      }

      if (a.category && b.category) {
        const categoryCompare = a.category.localeCompare(b.category);
        if (categoryCompare !== 0) {
          return categoryCompare;
        }
      } else if (a.category) {
        return -1;
      } else if (b.category) {
        return 1;
      }

      return a.name.localeCompare(b.name);
    });
  }, [baseSkillEntries]);

  const unlockedSkillCount = useMemo(
    () => baseSkillEntries.filter(entry => entry.unlocked).length,
    [baseSkillEntries]
  );
  const totalSkillCount = baseSkillEntries.length;

  const skillAverageSummary = useMemo(() => {
    if (baseSkillEntries.length === 0) {
      return { average: 0, count: 0, usesUnlockedOnly: false } as const;
    }

    const unlockedEntries = baseSkillEntries.filter(entry => entry.unlocked);
    const usesUnlockedOnly = baseSkillEntries.some(entry => !entry.unlocked) && unlockedEntries.length > 0;
    const pool = usesUnlockedOnly ? unlockedEntries : baseSkillEntries;
    const total = pool.reduce((sum, entry) => sum + entry.currentValue, 0);
    const average = pool.length > 0 ? Math.round(total / pool.length) : 0;

    return { average, count: pool.length, usesUnlockedOnly } as const;
  }, [baseSkillEntries]);

  const skillAverage = skillAverageSummary.average;
  const averageUsesUnlockedOnly = skillAverageSummary.usesUnlockedOnly;
  const skillAverageCount = skillAverageSummary.count;
  const lockedSkillCount = Math.max(0, totalSkillCount - unlockedSkillCount);

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

  const fetchSkillProgress = useCallback(async () => {
    if (!user?.id || !profile?.id) {
      return;
    }

    try {
      setSkillProgressLoading(true);
      setSkillProgressError(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Accessing a view not yet represented in generated types
      const { data, error } = await (supabase as any)
        .from('profile_skill_progress')
        .select('*')
        .eq('profile_id', profile.id);

      if (error) {
        throw error;
      }

      const normalized = Array.isArray(data)
        ? (data
            .map(item => (isRecord(item) ? normalizeSkillProgressRow(item) : null))
            .filter((entry): entry is SkillProgressEntry => entry !== null))
        : [];

      setSkillProgress(normalized);
    } catch (error) {
      console.error('Error fetching skill progress:', error);
      setSkillProgress([]);
      setSkillProgressError(
        error instanceof Error ? error.message : 'Failed to load skill progress data.'
      );
    } finally {
      setSkillProgressLoading(false);
    }
  }, [user?.id, profile?.id]);

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
      fetchSkillProgress();
    }
  }, [user, fetchExtendedStats, fetchLeaderboard, fetchSkillProgress]);

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
          fetchSkillProgress();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchExtendedStats, fetchLeaderboard, fetchSkillProgress]);

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
                {skillProgressError && (
                  <Alert variant="destructive">
                    <AlertTitle>Unable to load detailed skill data</AlertTitle>
                    <AlertDescription>{skillProgressError}</AlertDescription>
                  </Alert>
                )}

                {skillProgressLoading && sortedSkillEntries.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Refreshing skill progress…
                  </div>
                )}

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {skillProgressLoading && sortedSkillEntries.length === 0 ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-28 w-full rounded-lg" />
                    ))
                  ) : sortedSkillEntries.length > 0 ? (
                    sortedSkillEntries.map(entry => {
                      const isLocked = !entry.unlocked;
                      const badgeInfo = resolveSkillBadge(entry.currentValue);
                      const requirementMessage = buildRequirementMessage(entry);
                      const categoryLabel = entry.category ? formatLabel(entry.category) : null;
                      const requirementLevel =
                        typeof entry.requirementValue === 'number' && Number.isFinite(entry.requirementValue)
                          ? Math.round(entry.requirementValue)
                          : null;

                      return (
                        <div
                          key={entry.slug}
                          className={`space-y-3 rounded-lg border p-4 shadow-sm transition-colors ${
                            isLocked
                              ? 'border-dashed border-muted-foreground/30 bg-muted/40 text-muted-foreground'
                              : 'border-primary/20 bg-muted/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-medium capitalize text-base">{entry.name}</span>
                                {categoryLabel ? (
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {categoryLabel}
                                  </Badge>
                                ) : null}
                                {isLocked && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                        <Lock className="h-3 w-3" />
                                        Locked
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" align="start" className="max-w-xs text-sm">
                                      <p>{requirementMessage}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                              {entry.description && entry.unlocked && (
                                <p className="text-xs text-muted-foreground">{entry.description}</p>
                              )}
                              {isLocked && (
                                <p className="text-xs text-muted-foreground">{requirementMessage}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">
                                {Math.round(entry.currentValue)}/{Math.round(entry.maxValue)}
                              </span>
                              <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
                            </div>
                          </div>
                          <Progress value={entry.progressPercent} className="h-3" />
                          {entry.parentSkillName && isLocked && (
                            <p className="text-xs text-muted-foreground">
                              Parent skill: {entry.parentSkillName}
                              {requirementLevel !== null ? ` (level ${requirementLevel})` : ''}
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                      No skill data available yet. Unlock a skill to see it tracked here.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {totalSkillCount} total skill{totalSkillCount === 1 ? '' : 's'}
                  </span>
                  <span>
                    {unlockedSkillCount} unlocked
                  </span>
                  {lockedSkillCount > 0 && <span>{lockedSkillCount} locked</span>}
                </div>

                <div className="space-y-2 pt-4 text-center">
                  <div className="text-3xl font-bold text-primary">{skillAverage}/100</div>
                  <div className="text-muted-foreground">Overall Skill Average</div>
                  {skillAverageCount > 0 ? (
                    <div className="text-xs text-muted-foreground">
                      Calculated from{' '}
                      {averageUsesUnlockedOnly
                        ? `${skillAverageCount} unlocked skill${skillAverageCount === 1 ? '' : 's'}`
                        : `${skillAverageCount} skill${skillAverageCount === 1 ? '' : 's'}`}
                      {averageUsesUnlockedOnly && lockedSkillCount > 0
                        ? ` (excluding ${lockedSkillCount} locked).`
                        : '.'}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      No skill data available yet. Unlock skills to begin tracking your average.
                    </div>
                  )}
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