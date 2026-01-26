import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MUSIC_GENRES } from "@/data/genres";
import { countryData } from "@/data/countryData";

export type ChartType =
  | "streaming"
  | "cd_sales"
  | "vinyl_sales"
  | "digital_sales"
  | "cassette_sales"
  | "record_sales"
  | "radio_airplay"
  | "combined"
  | "physical_sales";

export type ReleaseCategory = "all" | "single" | "ep" | "album";

export type ChartTimeRange = "daily" | "weekly" | "monthly" | "yearly";

export type ChartYear = "current" | number; // "current" or specific year like 2025

export interface ChartEntry {
  id: string;
  rank: number;
  song_id: string;
  title: string;
  artist: string;
  genre: string;
  country: string;
  plays_count: number;
  weekly_plays: number;
  combined_score: number;
  total_sales: number;
  trend: "up" | "down" | "stable" | "new";
  trend_change: number;
  weeks_on_chart: number;
  is_fake: boolean;
  audio_url?: string | null;
  audio_generation_status?: string | null;
  entry_type?: "song" | "album";
  release_id?: string | null;
  release_title?: string | null;
  song_count?: number;
}

export interface ChartHistoryPoint {
  date: string;
  rank: number;
  plays_count: number;
}

const GENRES = [...MUSIC_GENRES];

// Use all countries from countryData (43 countries + Global)
const COUNTRIES = ["Global", ...Object.keys(countryData).sort()];

// Helper to get the correct label for the metric based on chart type
export const getMetricLabels = (chartType: ChartType, timeRange: ChartTimeRange = "weekly"): { weekly: string; total: string } => {
  const timeLabel = timeRange === "daily" ? "Today" :
                    timeRange === "weekly" ? "This Week" :
                    timeRange === "monthly" ? "This Month" : "This Year";
  
  switch (chartType) {
    case "combined":
      return { weekly: "Chart Pts", total: "Streams" };
    case "streaming":
      return { weekly: timeLabel, total: "Total Streams" };
    case "radio_airplay":
      return { weekly: "Listeners", total: "Total Plays" };
    case "digital_sales":
      return { weekly: timeLabel, total: "Total Sales" };
    case "cd_sales":
    case "vinyl_sales":
    case "cassette_sales":
    case "record_sales":
      return { weekly: timeLabel, total: "Total Sales" };
    default:
      return { weekly: timeLabel, total: "Total" };
  }
};

export const useCountryCharts = (
  country: string,
  genre: string,
  chartType: ChartType,
  releaseCategory: ReleaseCategory = "single", // Default to singles
  timeRange: ChartTimeRange = "weekly",
  selectedYear: ChartYear = "current", // For yearly view - specific year or current
) => {
  return useQuery({
    queryKey: ["country-charts", country, genre, chartType, releaseCategory, timeRange, selectedYear],
    queryFn: async (): Promise<ChartEntry[]> => {
      // Calculate date range based on timeRange
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;
      
      switch (timeRange) {
        case "daily":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 1);
          break;
        case "weekly":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case "monthly":
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        case "yearly":
          // If a specific year is selected, use that year's date range
          if (selectedYear !== "current" && typeof selectedYear === "number") {
            startDate = new Date(selectedYear, 0, 1); // Jan 1 of selected year
            endDate = new Date(selectedYear, 11, 31); // Dec 31 of selected year
          } else {
            startDate = new Date(now);
            startDate.setFullYear(now.getFullYear() - 1);
          }
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
      }

      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];

      // Build chart_type values to query - include BOTH base type AND scoped types
      // This ensures we get data from whichever exists in the database
      let chartTypeFilter: string[] = [];
      
      // Handle physical_sales as a special combined type
      if (chartType === "physical_sales" as any) {
        if (releaseCategory === "all") {
          chartTypeFilter = [
            "cd_sales", "cd_sales_single", "cd_sales_album", "cd_sales_ep",
            "vinyl_sales", "vinyl_sales_single", "vinyl_sales_album", "vinyl_sales_ep",
            "cassette_sales", "cassette_sales_single", "cassette_sales_album", "cassette_sales_ep",
            "record_sales", "record_sales_single", "record_sales_album", "record_sales_ep"
          ];
        } else if (releaseCategory === "single") {
          chartTypeFilter = [
            "cd_sales", "cd_sales_single",
            "vinyl_sales", "vinyl_sales_single",
            "cassette_sales", "cassette_sales_single",
            "record_sales", "record_sales_single"
          ];
        } else {
          chartTypeFilter = [
            `cd_sales_${releaseCategory}`,
            `vinyl_sales_${releaseCategory}`,
            `cassette_sales_${releaseCategory}`,
            `record_sales_${releaseCategory}`
          ];
        }
      } else if (releaseCategory === "all") {
        // Query ALL variants plus base type for full data
        chartTypeFilter = [
          chartType,
          `${chartType}_single`,
          `${chartType}_ep`,
          `${chartType}_album`
        ];
      } else if (releaseCategory === "single") {
        // Query both base type AND single variant (base often contains singles)
        chartTypeFilter = [chartType, `${chartType}_single`];
      } else {
        // Query specific category plus base type as fallback
        chartTypeFilter = [`${chartType}_${releaseCategory}`, chartType];
      }

      console.log("[useCountryCharts] Querying chart_types:", chartTypeFilter, "from:", startDateStr, "to:", endDateStr, "timeRange:", timeRange, "year:", selectedYear);

      // For daily, get just the latest date. For other ranges, aggregate across dates.
      if (timeRange === "daily") {
        // Get the latest chart_date
        const { data: latestDateData } = await supabase
          .from("chart_entries")
          .select("chart_date")
          .order("chart_date", { ascending: false })
          .limit(1)
          .single();

        const latestChartDate = latestDateData?.chart_date;

        if (!latestChartDate) {
          console.log("[useCountryCharts] No chart data available");
          return [];
        }

        let query = supabase
          .from("chart_entries")
          .select(`
            *,
            songs(
              title,
              genre,
              audio_url,
              audio_generation_status,
              bands(name, artist_name)
            )
          `)
          .in("chart_type", chartTypeFilter)
          .eq("chart_date", latestChartDate)
          .limit(100);

        // Handle country filter
        if (country !== "Global") {
          query = query.or(`country.eq.${country},country.eq.all`);
        }

        if (genre !== "All") {
          query = query.eq("genre", genre);
        }

        // Sort by the appropriate metric
        if (chartType === "combined") {
          query = query.order("combined_score", { ascending: false });
        } else if (chartType === "streaming") {
          query = query.order("weekly_plays", { ascending: false });
        } else {
          query = query.order("plays_count", { ascending: false });
        }

        const { data, error } = await query;

        if (error) {
          console.error("[useCountryCharts] Error fetching chart entries:", error);
          return [];
        }

        return transformAndDeduplicateEntries(data || [], chartType, releaseCategory);
      }

      // For weekly/monthly/yearly, aggregate across multiple dates
      let query = supabase
        .from("chart_entries")
        .select(`
          *,
          songs(
            title,
            genre,
            audio_url,
            audio_generation_status,
            bands(name, artist_name)
          )
        `)
        .in("chart_type", chartTypeFilter)
        .gte("chart_date", startDateStr)
        .lte("chart_date", endDateStr)
        .limit(1000); // Get more entries to aggregate

      // Handle country filter
      if (country !== "Global") {
        query = query.or(`country.eq.${country},country.eq.all`);
      }

      if (genre !== "All") {
        query = query.eq("genre", genre);
      }

      const { data, error } = await query;

      if (error) {
        console.error("[useCountryCharts] Error fetching chart entries:", error);
        return [];
      }

      console.log("[useCountryCharts] Found raw entries:", data?.length || 0);

      // For album/EP categories, aggregate by release_id instead of song_id
      const isAlbumCategory = releaseCategory === "album" || releaseCategory === "ep";
      
      // Aggregate by the appropriate key
      const aggregatedMap = new Map<string, {
        entry: any;
        totalPlays: number;
        totalWeeklyPlays: number;
        totalCombinedScore: number;
        latestTrend: string;
        latestTrendChange: number;
        maxWeeksOnChart: number;
      }>();

      for (const entry of data || []) {
        // Use release_id for album/EP entries, song_id for singles
        const key = isAlbumCategory && entry.release_id 
          ? entry.release_id 
          : entry.song_id;
          
        const existing = aggregatedMap.get(key);

        if (existing) {
          existing.totalPlays += entry.plays_count || 0;
          existing.totalWeeklyPlays += entry.weekly_plays || 0;
          existing.totalCombinedScore += entry.combined_score || 0;
          existing.maxWeeksOnChart = Math.max(existing.maxWeeksOnChart, entry.weeks_on_chart || 1);
          // Keep the latest trend info
          if (entry.chart_date > existing.entry.chart_date) {
            existing.latestTrend = entry.trend || "stable";
            existing.latestTrendChange = entry.trend_change || 0;
            existing.entry = entry;
          }
        } else {
          aggregatedMap.set(key, {
            entry,
            totalPlays: entry.plays_count || 0,
            totalWeeklyPlays: entry.weekly_plays || 0,
            totalCombinedScore: entry.combined_score || 0,
            latestTrend: entry.trend || "stable",
            latestTrendChange: entry.trend_change || 0,
            maxWeeksOnChart: entry.weeks_on_chart || 1,
          });
        }
      }

      console.log("[useCountryCharts] After aggregation:", aggregatedMap.size);

      // Transform aggregated data to ChartEntry format
      const aggregatedEntries = Array.from(aggregatedMap.values()).map(agg => {
        const entry = agg.entry;
        const bandArtistName = entry.songs?.bands?.artist_name || entry.songs?.bands?.name;
        const artistName = bandArtistName || "Unknown Artist";
        
        // For album entries, use release_title; for songs, use song title
        const isAlbumEntry = entry.entry_type === "album";
        const displayTitle = isAlbumEntry && entry.release_title 
          ? entry.release_title 
          : entry.songs?.title || "Unknown Song";

        return {
          id: entry.id,
          rank: 0, // Will be set after sorting
          song_id: entry.song_id,
          title: displayTitle,
          artist: artistName,
          genre: entry.genre || entry.songs?.genre || "Unknown",
          country: entry.country || "Global",
          plays_count: agg.totalPlays,
          weekly_plays: agg.totalWeeklyPlays,
          combined_score: agg.totalCombinedScore,
          total_sales: agg.totalPlays,
          trend: agg.latestTrend as "up" | "down" | "stable" | "new",
          trend_change: agg.latestTrendChange,
          weeks_on_chart: agg.maxWeeksOnChart,
          is_fake: false,
          audio_url: entry.songs?.audio_url || null,
          audio_generation_status: entry.songs?.audio_generation_status || null,
          entry_type: entry.entry_type || "song",
          release_id: entry.release_id || null,
          release_title: entry.release_title || null,
        };
      });

      // Sort by appropriate metric and assign ranks
      return aggregatedEntries
        .sort((a, b) => {
          if (chartType === "combined") {
            return b.combined_score - a.combined_score;
          }
          if (chartType === "streaming") {
            return b.weekly_plays - a.weekly_plays;
          }
          return b.plays_count - a.plays_count;
        })
        .slice(0, 50)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Helper function to transform and deduplicate entries (for daily view)
function transformAndDeduplicateEntries(data: any[], chartType: ChartType, releaseCategory: ReleaseCategory): ChartEntry[] {
  const isAlbumCategory = releaseCategory === "album" || releaseCategory === "ep";
  
  // Deduplicate by appropriate key - use release_id for albums, song_id for singles
  const entryMap = new Map<string, any>();
  for (const entry of data || []) {
    const key = isAlbumCategory && entry.release_id 
      ? entry.release_id 
      : entry.song_id;
      
    const existing = entryMap.get(key);
    
    // Use combined_score for combined chart, otherwise use plays_count
    const entryScore = chartType === "combined" 
      ? (entry.combined_score || 0) 
      : (entry.plays_count || 0);
    const existingScore = existing 
      ? (chartType === "combined" ? (existing.combined_score || 0) : (existing.plays_count || 0))
      : 0;
      
    if (!existing || entryScore > existingScore) {
      entryMap.set(key, entry);
    }
  }

  const deduplicatedData = Array.from(entryMap.values());
  console.log("[useCountryCharts] After deduplication:", deduplicatedData.length);

  // Transform real data
  const realEntries: ChartEntry[] = deduplicatedData.map((entry, index) => {
    const bandArtistName = entry.songs?.bands?.artist_name || entry.songs?.bands?.name;
    const artistName = bandArtistName || "Unknown Artist";
    
    // For album entries, use release_title; for songs, use song title
    const isAlbumEntry = entry.entry_type === "album";
    const displayTitle = isAlbumEntry && entry.release_title 
      ? entry.release_title 
      : entry.songs?.title || "Unknown Song";
    
    const playsCount = entry.plays_count || 0;
    const weeklyPlays = entry.weekly_plays || 0;
    const combinedScore = entry.combined_score || 0;
    const weeksOnChart = entry.weeks_on_chart || 1;
    
    return {
      id: entry.id,
      rank: index + 1,
      song_id: entry.song_id,
      title: displayTitle,
      artist: artistName,
      genre: entry.genre || entry.songs?.genre || "Unknown",
      country: entry.country || "Global",
      plays_count: playsCount,
      weekly_plays: weeklyPlays,
      combined_score: combinedScore,
      total_sales: playsCount,
      trend: (entry.trend as "up" | "down" | "stable" | "new") || "stable",
      trend_change: entry.trend_change || 0,
      weeks_on_chart: weeksOnChart,
      is_fake: false,
      audio_url: entry.songs?.audio_url || null,
      audio_generation_status: entry.songs?.audio_generation_status || null,
      entry_type: entry.entry_type || "song",
      release_id: entry.release_id || null,
      release_title: entry.release_title || null,
    };
  });

  // Re-rank entries by appropriate score
  return realEntries
    .sort((a, b) => {
      if (chartType === "combined") {
        return b.combined_score - a.combined_score;
      }
      return b.plays_count - a.plays_count;
    })
    .slice(0, 50)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

// Hook to fetch chart history for a specific song
export const useChartHistory = (songId: string, chartType: ChartType) => {
  return useQuery({
    queryKey: ["chart-history", songId, chartType],
    queryFn: async (): Promise<ChartHistoryPoint[]> => {
      const { data, error } = await supabase
        .from("chart_entries")
        .select("chart_date, rank, plays_count")
        .eq("song_id", songId)
        .eq("chart_type", chartType)
        .order("chart_date", { ascending: true })
        .limit(90); // Last 90 days

      if (error) {
        console.error("[useChartHistory] Error:", error);
        return [];
      }

      return (data || []).map(entry => ({
        date: entry.chart_date,
        rank: entry.rank,
        plays_count: entry.plays_count || 0,
      }));
    },
    enabled: !!songId,
    staleTime: 10 * 60 * 1000,
  });
};

// Hook to fetch #1 streaks
export const useNumberOneStreaks = (songId?: string) => {
  return useQuery({
    queryKey: ["number-one-streaks", songId],
    queryFn: async () => {
      let query = supabase
        .from("chart_number_one_streaks")
        .select(`
          *,
          songs(title, bands(name, artist_name))
        `)
        .order("streak_days", { ascending: false })
        .limit(20);

      if (songId) {
        query = query.eq("song_id", songId);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[useNumberOneStreaks] Error:", error);
        return [];
      }
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });
};

export const useAvailableGenres = () => {
  return useQuery({
    queryKey: ["chart-genres"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chart_entries")
        .select("genre")
        .not("genre", "is", null);

      const uniqueGenres = new Set<string>();
      data?.forEach((entry) => {
        if (entry.genre) uniqueGenres.add(entry.genre);
      });

      if (uniqueGenres.size === 0) {
        return GENRES;
      }

      return ["All", ...Array.from(uniqueGenres).sort()];
    },
    staleTime: 10 * 60 * 1000,
  });
};

export const useAvailableCountries = () => {
  return useQuery({
    queryKey: ["chart-countries"],
    queryFn: async () => {
      return COUNTRIES;
    },
    staleTime: 10 * 60 * 1000,
  });
};

export { GENRES, COUNTRIES };
