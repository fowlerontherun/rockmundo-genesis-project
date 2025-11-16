import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

export type ChartFilters = {
  chartType?: string;
  genre?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
};

type SongRelation = {
  title: string;
  genre: string | null;
  bands?: { name: string | null } | null;
  profiles?: { stage_name: string | null } | null;
};

export type ChartEntryWithRelations = (Tables<"chart_entries"> & {
  total_streams?: number | null;
  songs: SongRelation | null;
})[] extends (infer U)[]
  ? U
  : never;

export interface ChartTrendPoint {
  date: string;
  averageRank: number;
  totalPlays: number;
}

export interface ChartAggregate {
  chartType: string;
  averageRank: number;
  totalPlays: number;
  totalWeeks: number;
  entryCount: number;
  momentum: number;
  dominantCountry?: string;
  dominantGenre?: string;
  topCountries: Array<{ country: string; count: number }>;
  topGenres: Array<{ genre: string; count: number }>;
  topSongs: Array<{ rank: number; title: string; artist: string }>;
  trendSeries: ChartTrendPoint[];
}

const SELECT_WITH_RELATIONS = `
  *,
  songs(
    title,
    genre,
    bands(name),
    profiles:user_id(stage_name)
  )
`;

export const fetchChartEntries = async (
  filters: ChartFilters = {}
): Promise<ChartEntryWithRelations[]> => {
  let query = supabase
    .from("chart_entries")
    .select(SELECT_WITH_RELATIONS)
    .order("chart_date", { ascending: false, nullsFirst: false })
    .order("rank", { ascending: true });

  if (filters.chartType && filters.chartType !== "all") {
    query = query.eq("chart_type", filters.chartType);
  }

  if (filters.genre && filters.genre !== "all") {
    query = query.eq("genre", filters.genre);
  }

  if (filters.country && filters.country !== "all") {
    query = query.eq("country", filters.country);
  }

  if (filters.startDate) {
    query = query.gte("chart_date", filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte("chart_date", filters.endDate);
  }

  const { data, error } = await query.limit(500);

  if (error) {
    throw new Error(`Failed to fetch chart entries: ${error.message}`);
  }

  return (data as ChartEntryWithRelations[] | null) ?? [];
};

const toFixedNumber = (value: number, digits = 2): number => {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
};

export const fetchChartAggregates = async (
  filters: ChartFilters = {}
): Promise<ChartAggregate[]> => {
  const entries = await fetchChartEntries(filters);

  const entriesByType = new Map<string, ChartEntryWithRelations[]>();

  for (const entry of entries) {
    const bucket = entriesByType.get(entry.chart_type) ?? [];
    bucket.push(entry);
    entriesByType.set(entry.chart_type, bucket);
  }

  const aggregates: ChartAggregate[] = [];

  for (const [chartType, chartEntries] of entriesByType.entries()) {
    let totalPlays = 0;
    let rankSum = 0;
    let weekSum = 0;

    const countryCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();
    const trendByDate = new Map<string, { rankSum: number; count: number; playSum: number }>();

    for (const entry of chartEntries) {
      const plays = entry.plays_count ?? entry.total_streams ?? 0;
      totalPlays += plays;
      rankSum += entry.rank ?? 0;
      weekSum += entry.weeks_on_chart ?? 0;

      if (entry.country) {
        countryCounts.set(entry.country, (countryCounts.get(entry.country) ?? 0) + 1);
      }

      const genre = entry.genre ?? entry.songs?.genre ?? "Unknown";
      if (genre) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }

      if (entry.chart_date) {
        const trendKey = entry.chart_date;
        const stats = trendByDate.get(trendKey) ?? { rankSum: 0, count: 0, playSum: 0 };
        stats.rankSum += entry.rank ?? 0;
        stats.count += 1;
        stats.playSum += plays;
        trendByDate.set(trendKey, stats);
      }
    }

    const trendSeries = Array.from(trendByDate.entries())
      .map(([date, stats]) => ({
        date,
        averageRank: toFixedNumber(stats.rankSum / stats.count),
        totalPlays: stats.playSum,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const averageRank = toFixedNumber(rankSum / chartEntries.length);

    const topCountries = Array.from(countryCounts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topGenres = Array.from(genreCounts.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topSongs = [...chartEntries]
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      .slice(0, 5)
      .map(entry => ({
        rank: entry.rank ?? 0,
        title: entry.songs?.title ?? "Unknown Song",
        artist: entry.songs?.bands?.name ?? entry.songs?.profiles?.stage_name ?? "Unknown Artist",
      }));

    const latestTrend = trendSeries.at(-1)?.averageRank ?? averageRank;
    const previousTrend = trendSeries.at(-2)?.averageRank ?? latestTrend;
    const momentum = toFixedNumber(previousTrend - latestTrend);

    aggregates.push({
      chartType,
      averageRank,
      totalPlays,
      totalWeeks: weekSum,
      entryCount: chartEntries.length,
      momentum,
      dominantCountry: topCountries[0]?.country,
      dominantGenre: topGenres[0]?.genre,
      topCountries,
      topGenres,
      topSongs,
      trendSeries,
    });
  }

  return aggregates.sort((a, b) => a.chartType.localeCompare(b.chartType));
};
