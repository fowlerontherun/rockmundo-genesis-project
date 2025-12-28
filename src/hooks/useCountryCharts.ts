import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MUSIC_GENRES } from "@/data/genres";

export type ChartType = "streaming" | "cd_sales" | "vinyl_sales" | "digital_sales" | "cassette_sales" | "combined";

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
}

const GENRES = [...MUSIC_GENRES];

const COUNTRIES = [
  "Global", "United States", "United Kingdom", "Germany", "France", 
  "Japan", "Australia", "Canada", "Brazil", "Mexico"
];

const FAKE_ARTISTS = [
  "The Midnight Echo", "Nova Dreams", "Electric Pulse", "Shadow Valley",
  "Crystal Waves", "Neon Horizon", "Velvet Storm", "Arctic Fire",
  "Golden Frequency", "Lunar Drift", "Crimson Sky", "Silent Thunder",
  "Emerald Coast", "Phantom Groove", "Solar Wind", "Ocean Drive",
  "Desert Rain", "Mountain High", "City Lights", "Starlight Express"
];

const FAKE_SONG_TITLES = [
  "Midnight Run", "Electric Dreams", "Fading Light", "Summer Nights",
  "Heart of Gold", "Breaking Through", "Lost in Time", "Rising Sun",
  "Endless Road", "Dancing Shadows", "Fire and Ice", "Whispered Secrets",
  "Chasing Stars", "Broken Wings", "Northern Lights", "Ocean Waves",
  "City Streets", "Mountain Song", "Desert Wind", "Rainy Days",
  "Golden Hour", "Silver Moon", "Crystal Clear", "Thunder Road",
  "Lightning Strike", "Peaceful Morning", "Wild Heart", "Gentle Storm",
  "Burning Bright", "Frozen Dreams", "Autumn Leaves", "Spring Rain",
  "Winter Frost", "Summer Haze", "Twilight Zone", "Daybreak",
  "Sunset Boulevard", "Moonlit Path", "Starry Night", "Cloudy Skies",
  "Rainbow Bridge", "Diamond Eyes", "Ruby Red", "Sapphire Blue",
  "Emerald Green", "Amber Glow", "Pearl White", "Onyx Black",
  "Ivory Tower", "Bronze Age"
];

const generateFakeEntry = (rank: number, genre: string, country: string, chartType: ChartType): ChartEntry => {
  const artistIndex = (rank * 7 + genre.length) % FAKE_ARTISTS.length;
  const titleIndex = (rank * 13 + country.length) % FAKE_SONG_TITLES.length;
  const basePlays = Math.floor(1000000 / (rank * 0.8 + 1));
  const trendOptions: ("up" | "down" | "stable" | "new")[] = ["up", "down", "stable", "new"];
  const trendIndex = (rank + genre.charCodeAt(0)) % 4;
  const weeklySales = Math.floor(basePlays * 0.1);
  const totalSales = weeklySales * (Math.floor(Math.random() * 10) + 1);
  
  return {
    id: `fake-${chartType}-${genre}-${country}-${rank}`,
    rank,
    song_id: `fake-song-${rank}`,
    title: FAKE_SONG_TITLES[titleIndex],
    artist: FAKE_ARTISTS[artistIndex],
    genre,
    country,
    plays_count: basePlays + Math.floor(Math.random() * 100000),
    weekly_sales: weeklySales,
    total_sales: totalSales,
    trend: trendOptions[trendIndex],
    trend_change: trendIndex === 3 ? 0 : Math.floor(Math.random() * 10) - 3,
    weeks_on_chart: trendIndex === 3 ? 1 : Math.floor(Math.random() * 20) + 1,
    is_fake: true,
  };
};

export const useCountryCharts = (
  country: string,
  genre: string,
  chartType: ChartType
) => {
  return useQuery({
    queryKey: ["country-charts", country, genre, chartType],
    queryFn: async (): Promise<ChartEntry[]> => {
      // Determine which chart_type values to query
      let chartTypeFilter: string[] = [];
      if (chartType === "streaming") {
        chartTypeFilter = ["streaming"];
      } else if (chartType === "cd_sales") {
        chartTypeFilter = ["cd_sales"];
      } else if (chartType === "vinyl_sales") {
        chartTypeFilter = ["vinyl_sales"];
      } else if (chartType === "digital_sales") {
        chartTypeFilter = ["digital_sales"];
      } else if (chartType === "cassette_sales") {
        chartTypeFilter = ["cassette_sales"];
      } else {
        // combined - get all types
        chartTypeFilter = ["streaming", "cd_sales", "vinyl_sales", "digital_sales", "cassette_sales"];
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
            user_id,
            bands(name, artist_name),
            profiles:user_id(stage_name)
          )
        `)
        .in("chart_type", chartTypeFilter)
        .order("plays_count", { ascending: false })
        .limit(50);

      if (country !== "Global") {
        query = query.eq("country", country);
      }

      if (genre !== "All") {
        query = query.eq("genre", genre);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching chart entries:", error);
      }

      // Transform real data
      const realEntries: ChartEntry[] = (data || []).map((entry, index) => {
        // Get artist name from band (artist_name or name) or profile stage_name
        const bandArtistName = entry.songs?.bands?.artist_name || entry.songs?.bands?.name;
        const profileStageName = (entry.songs?.profiles as any)?.stage_name;
        const artistName = bandArtistName || profileStageName || "Unknown Artist";
        
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
        };
      });

      // Fill remaining spots with fake data up to 50
      const targetGenre = genre === "All" ? "Pop" : genre;
      const entries = [...realEntries];
      
      for (let i = realEntries.length; i < 50; i++) {
        entries.push(generateFakeEntry(i + 1, targetGenre, country, chartType));
      }

      // Re-rank entries
      return entries.map((entry, index) => ({
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
      const { data } = await supabase
        .from("chart_entries")
        .select("country")
        .not("country", "is", null);

      const uniqueCountries = new Set<string>();
      data?.forEach((entry) => {
        if (entry.country) uniqueCountries.add(entry.country);
      });

      // Add default countries if none found
      if (uniqueCountries.size === 0) {
        return COUNTRIES;
      }

      return ["Global", ...Array.from(uniqueCountries).filter(c => c !== "Global").sort()];
    },
    staleTime: 10 * 60 * 1000,
  });
};

export { GENRES, COUNTRIES };
