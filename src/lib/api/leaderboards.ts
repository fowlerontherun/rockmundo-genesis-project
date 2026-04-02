import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

export type LeaderboardSeasonRecord = Tables<"leaderboard_seasons">;
export type LeaderboardSnapshotRecord = Tables<"leaderboard_season_snapshots">;
export type LeaderboardBadgeRecord = Tables<"leaderboard_badges">;
export type LeaderboardBadgeAwardRecord = Tables<"leaderboard_badge_awards">;

export interface LeaderboardProfileSummary {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  fame: number | null;
  experience: number | null;
  level: number | null;
}

export interface LeaderboardStanding {
  id: string;
  seasonId: string;
  division: string;
  region: string;
  instrument: string;
  tier: string | null;
  finalRank: number | null;
  finalScore: number | null;
  totalRevenue: number | null;
  totalGigs: number | null;
  totalAchievements: number | null;
  fame: number | null;
  experience: number | null;
  recordedAt: string;
  breakdown: Record<string, number>;
  awardedBadges: string[];
  profile: LeaderboardProfileSummary | null;
}

export interface LeaderboardStandingFilters {
  division?: string;
  region?: string;
  instrument?: string;
  tier?: string;
}

export interface LeaderboardSeasonSummary {
  totalPlayers: number;
  averageScore: number;
  averageFame: number;
  averageExperience: number;
  totalRevenue: number;
  totalGigs: number;
  totalAchievements: number;
}

export interface LeaderboardBadgeAward extends LeaderboardBadgeAwardRecord {
  profile: LeaderboardProfileSummary | null;
}

export interface LeaderboardBadge extends LeaderboardBadgeRecord {
  awards: LeaderboardBadgeAward[];
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter(item => typeof item === "string") as string[];
  }

  return [];
};

const toNumericRecord = (value: unknown): Record<string, number> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, number>>((acc, [key, entryValue]) => {
    const numericValue = toNumber(entryValue);
    if (numericValue !== null) {
      acc[key] = numericValue;
    }
    return acc;
  }, {});
};

const mapProfile = (raw: any): LeaderboardProfileSummary | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = typeof raw.id === "string" ? raw.id : null;

  if (!id) {
    return null;
  }

  return {
    id,
    displayName: typeof raw.display_name === "string" ? raw.display_name : null,
    username: typeof raw.username === "string" ? raw.username : null,
    avatarUrl: typeof raw.avatar_url === "string" ? raw.avatar_url : null,
    fame: toNumber(raw.fame),
    experience: toNumber(raw.experience),
    level: toNumber(raw.level),
  };
};

const mapStanding = (record: any): LeaderboardStanding | null => {
  if (!record || typeof record !== "object") {
    return null;
  }

  const id = typeof record.id === "string" ? record.id : null;
  const seasonId = typeof record.season_id === "string" ? record.season_id : null;
  const division = typeof record.division === "string" ? record.division : null;
  const region = typeof record.region === "string" ? record.region : null;
  const instrument = typeof record.instrument === "string" ? record.instrument : null;
  const recordedAt = typeof record.recorded_at === "string" ? record.recorded_at : null;

  if (!id || !seasonId || !division || !region || !instrument || !recordedAt) {
    return null;
  }

  return {
    id,
    seasonId,
    division,
    region,
    instrument,
    tier: typeof record.tier === "string" ? record.tier : null,
    finalRank: toNumber(record.final_rank),
    finalScore: toNumber(record.final_score),
    totalRevenue: toNumber(record.total_revenue),
    totalGigs: toNumber(record.total_gigs),
    totalAchievements: toNumber(record.total_achievements),
    fame: toNumber(record.fame),
    experience: toNumber(record.experience),
    recordedAt,
    breakdown: toNumericRecord(record.breakdown),
    awardedBadges: toStringArray(record.awarded_badges),
    profile: mapProfile(record.profile),
  };
};

const mapBadgeAward = (record: any): LeaderboardBadgeAward | null => {
  if (!record || typeof record !== "object") {
    return null;
  }

  const id = typeof record.id === "string" ? record.id : null;
  const badgeId = typeof record.badge_id === "string" ? record.badge_id : null;
  const userId = typeof record.user_id === "string" ? record.user_id : null;
  const awardedAt = typeof record.awarded_at === "string" ? record.awarded_at : null;

  if (!id || !badgeId || !userId || !awardedAt) {
    return null;
  }

  return {
    id,
    badge_id: badgeId,
    user_id: userId,
    awarded_at: awardedAt,
    season_id: typeof record.season_id === "string" ? record.season_id : null,
    profile_id: typeof record.profile_id === "string" ? record.profile_id : null,
    rank: toNumber(record.rank),
    metadata: (typeof record.metadata === "object" && record.metadata !== null ? record.metadata : {}) as LeaderboardBadgeAwardRecord["metadata"],
    created_at: typeof record.created_at === "string" ? record.created_at : awardedAt,
    profile: mapProfile(record.profile),
  };
};

const mapBadge = (record: any): LeaderboardBadge | null => {
  if (!record || typeof record !== "object") {
    return null;
  }

  const id = typeof record.id === "string" ? record.id : null;
  const code = typeof record.code === "string" ? record.code : null;
  const name = typeof record.name === "string" ? record.name : null;

  if (!id || !code || !name) {
    return null;
  }

  const awardsRaw = Array.isArray(record.awards) ? record.awards : Array.isArray(record.leaderboard_badge_awards) ? record.leaderboard_badge_awards : [];
  const awards = awardsRaw.reduce<LeaderboardBadgeAward[]>((acc, item) => {
    const mapped = mapBadgeAward(item);
    if (mapped) {
      acc.push(mapped);
    }
    return acc;
  }, []);

  return {
    id,
    code,
    name,
    description: typeof record.description === "string" ? record.description : null,
    icon: typeof record.icon === "string" ? record.icon : "trophy",
    rarity: typeof record.rarity === "string" ? record.rarity : "rare",
    tier: typeof record.tier === "string" ? record.tier : null,
    season_id: typeof record.season_id === "string" ? record.season_id : null,
    criteria: (typeof record.criteria === "object" && record.criteria !== null ? record.criteria : {}) as LeaderboardBadgeRecord["criteria"],
    created_at: typeof record.created_at === "string" ? record.created_at : new Date().toISOString(),
    updated_at: typeof record.updated_at === "string" ? record.updated_at : new Date().toISOString(),
    awards,
  };
};

type SnapshotRow = Database["public"]["Tables"]["leaderboard_season_snapshots"]["Row"];

type SnapshotFilterBuilder = PostgrestFilterBuilder<
  Database["public"],
  SnapshotRow,
  SnapshotRow
>;

const applyStandingFilters = (
  query: SnapshotFilterBuilder,
  filters: LeaderboardStandingFilters | undefined
): SnapshotFilterBuilder => {
  let next = query;

  if (filters?.division && filters.division !== "all") {
    next = next.eq("division", filters.division);
  }

  if (filters?.region && filters.region !== "all") {
    next = next.eq("region", filters.region);
  }

  if (filters?.instrument && filters.instrument !== "all") {
    next = next.eq("instrument", filters.instrument);
  }

  if (filters?.tier && filters.tier !== "all") {
    next = next.eq("tier", filters.tier);
  }

  return next;
};

export const fetchLeaderboardSeasons = async (): Promise<LeaderboardSeasonRecord[]> => {
  const { data, error } = await supabase
    .from("leaderboard_seasons")
    .select("*")
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as LeaderboardSeasonRecord[];
};

export const fetchSeasonStandings = async (
  seasonId: string,
  filters?: LeaderboardStandingFilters,
  limit = 100
): Promise<LeaderboardStanding[]> => {
  let query = supabase
    .from("leaderboard_season_snapshots")
    .select(
      `
        *,
        profile:profile_id (
          id,
          display_name,
          username,
          avatar_url,
          fame,
          experience,
          level
        )
      `
    )
    .eq("season_id", seasonId);

  query = applyStandingFilters(query, filters)
    .order("final_rank", { ascending: true, nullsFirst: false })
    .order("final_score", { ascending: false, nullsFirst: true })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.reduce<LeaderboardStanding[]>((acc, item) => {
    const mapped = mapStanding(item);
    if (mapped) {
      acc.push(mapped);
    }
    return acc;
  }, []);
};

export const fetchSeasonSummary = async (
  seasonId: string,
  filters?: LeaderboardStandingFilters
): Promise<LeaderboardSeasonSummary> => {
  let query = supabase
    .from("leaderboard_season_snapshots")
    .select(
      `
        total_players:count(*),
        average_score:avg(final_score),
        average_fame:avg(fame),
        average_experience:avg(experience),
        total_revenue:sum(total_revenue),
        total_gigs:sum(total_gigs),
        total_achievements:sum(total_achievements)
      `
    )
    .eq("season_id", seasonId);

  query = applyStandingFilters(query, filters);

  const { data, error } = await query.maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return {
        totalPlayers: 0,
        averageScore: 0,
        averageFame: 0,
        averageExperience: 0,
        totalRevenue: 0,
        totalGigs: 0,
        totalAchievements: 0,
      };
    }
    throw error;
  }

  const summary = data ?? {};

  return {
    totalPlayers: toNumber(summary.total_players) ?? 0,
    averageScore: toNumber(summary.average_score) ?? 0,
    averageFame: toNumber(summary.average_fame) ?? 0,
    averageExperience: toNumber(summary.average_experience) ?? 0,
    totalRevenue: toNumber(summary.total_revenue) ?? 0,
    totalGigs: toNumber(summary.total_gigs) ?? 0,
    totalAchievements: toNumber(summary.total_achievements) ?? 0,
  };
};

export const fetchSeasonBadges = async (
  seasonId: string
): Promise<LeaderboardBadge[]> => {
  const { data, error } = await supabase
    .from("leaderboard_badges")
    .select(
      `
        *,
        awards:leaderboard_badge_awards (
          id,
          badge_id,
          user_id,
          season_id,
          profile_id,
          awarded_at,
          rank,
          metadata,
          created_at,
          profile:profile_id (
            id,
            display_name,
            username,
            avatar_url,
            fame,
            experience,
            level
          )
        )
      `
    )
    .or(`season_id.eq.${seasonId},season_id.is.null`)
    .order("rarity", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.reduce<LeaderboardBadge[]>((acc, item) => {
    const mapped = mapBadge(item);
    if (mapped) {
      acc.push(mapped);
    }
    return acc;
  }, []);
};
