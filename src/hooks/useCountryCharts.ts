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
  | "combined";

export type ReleaseCategory = "all" | "single" | "ep" | "album";

export interface ChartEntry {
  id: string;
  rank: number;
  song_id: string;
  title: string;
  artist: string;
  genre: string;
  country: string;
  plays_count: number;
  weekly_sales: number;
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

const GENRES = [...MUSIC_GENRES];

// Use all countries from countryData (43 countries + Global)
const COUNTRIES = ["Global", ...Object.keys(countryData).sort()];

export const useCountryCharts = (
  country: string,
  genre: string,
  chartType: ChartType,
  releaseCategory: ReleaseCategory = "all",
) => {
  return useQuery({
    queryKey: ["country-charts", country, genre, chartType, releaseCategory],
    queryFn: async (): Promise<ChartEntry[]> => {
      // First, get the latest chart_date to avoid duplicates
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

      // Build all possible chart_type values to query
      let chartTypeFilter: string[] = [];
      
      // Release category suffixes to check
      const suffixes = releaseCategory === "all" 
        ? ["", "_single", "_ep", "_album"]  // Query all variations when "all"
        : [`_${releaseCategory}`];          // Query specific category

      if (chartType === "combined") {
        // Combined: query all chart types with all relevant suffixes
        const baseTypes = ["streaming", "cd_sales", "vinyl_sales", "digital_sales", "cassette_sales"];
        for (const baseType of baseTypes) {
          for (const suffix of suffixes) {
            chartTypeFilter.push(`${baseType}${suffix}`);
          }
        }
      } else {
        // Specific chart type with all relevant suffixes
        for (const suffix of suffixes) {
          chartTypeFilter.push(`${chartType}${suffix}`);
        }
      }

      console.log("[useCountryCharts] Querying chart_types:", chartTypeFilter, "date:", latestChartDate);

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
        .eq("chart_date", latestChartDate)  // Only get latest date to prevent duplicates
        .order("plays_count", { ascending: false })
        .limit(100);  // Get more to allow for deduplication

      // Handle country filter - database uses "all" but UI uses "Global"
      if (country !== "Global") {
        // Query for both the specific country AND entries marked as "all" (global)
        query = query.or(`country.eq.${country},country.eq.all`);
      }
      // When "Global" is selected, we want ALL entries (no country filter needed)
      // since we want to see global charts

      if (genre !== "All") {
        query = query.eq("genre", genre);
      }

      const { data, error } = await query;

      if (error) {
        console.error("[useCountryCharts] Error fetching chart entries:", error);
        return [];
      }

      console.log("[useCountryCharts] Found entries:", data?.length || 0);

      // Deduplicate by song_id - keep the entry with highest plays_count
      const songMap = new Map<string, any>();
      for (const entry of data || []) {
        const key = entry.song_id;
        const existing = songMap.get(key);
        if (!existing || (entry.plays_count || 0) > (existing.plays_count || 0)) {
          songMap.set(key, entry);
        }
      }

      const deduplicatedData = Array.from(songMap.values());
      console.log("[useCountryCharts] After deduplication:", deduplicatedData.length);

      // Transform real data
      const realEntries: ChartEntry[] = deduplicatedData.map((entry, index) => {
        // Get artist name from band (artist_name or name)
        const bandArtistName = entry.songs?.bands?.artist_name || entry.songs?.bands?.name;
        const artistName = bandArtistName || "Unknown Artist";
        
        const playsCount = entry.plays_count || 0;
        const weeksOnChart = entry.weeks_on_chart || 1;
        
        return {
          id: entry.id,
          rank: index + 1,
          song_id: entry.song_id,
          title: entry.songs?.title || "Unknown Song",
          artist: artistName,
          genre: entry.genre || entry.songs?.genre || "Unknown",
          country: entry.country || "Global",
          plays_count: playsCount,
          weekly_sales: Math.floor(playsCount / weeksOnChart),
          total_sales: playsCount,
          trend: (entry.trend as "up" | "down" | "stable" | "new") || "stable",
          trend_change: entry.trend_change || 0,
          weeks_on_chart: weeksOnChart,
          is_fake: false,
          audio_url: entry.songs?.audio_url || null,
          audio_generation_status: entry.songs?.audio_generation_status || null,
          entry_type: entry.entry_type || "song",
          release_id: entry.release_id || null,
        };
      });

      // Re-rank entries by plays_count
      return realEntries
        .sort((a, b) => b.plays_count - a.plays_count)
        .slice(0, 50)  // Limit to top 50
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
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

      // Add default genres if none found
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
      // Return all game countries from countryData
      // This ensures charts can filter by any country in the game
      return COUNTRIES;
    },
    staleTime: 10 * 60 * 1000,
  });
};

export { GENRES, COUNTRIES };
