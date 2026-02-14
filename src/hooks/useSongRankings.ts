import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RankingType = "quality" | "sales" | "streams";

export interface RankedSong {
  id: string;
  title: string;
  genre: string | null;
  quality_score: number;
  streams: number;
  band_id: string | null;
  user_id: string;
  band_name: string | null;
  artist_name: string | null;
  total_sales: number;
  audio_url: string | null;
}

export const useSongRankings = (rankingType: RankingType, genreFilter?: string) => {
  return useQuery({
    queryKey: ["song-rankings", rankingType, genreFilter],
    queryFn: async (): Promise<RankedSong[]> => {
      // Fetch songs with band info
      let query = supabase
        .from("songs")
        .select("id, title, genre, quality_score, streams, band_id, user_id, audio_url, bands(name)")
        .in("status", ["released", "recorded"])
        .not("quality_score", "is", null);

      if (genreFilter && genreFilter !== "all") {
        query = query.eq("genre", genreFilter);
      }

      const { data: songs, error } = await query.limit(100);
      if (error) throw error;

      let salesMap: Record<string, number> = {};

      if (rankingType === "sales") {
        // Fetch sales data via release_songs -> releases
        const { data: releaseSongs } = await supabase
          .from("release_songs")
          .select("song_id, releases(digital_sales, cd_sales, vinyl_sales, cassette_sales)")
          .in("song_id", (songs || []).map(s => s.id));

        if (releaseSongs) {
          for (const rs of releaseSongs) {
            const r = rs.releases as any;
            if (r) {
              const total = (r.digital_sales || 0) + (r.cd_sales || 0) + (r.vinyl_sales || 0) + (r.cassette_sales || 0);
              salesMap[rs.song_id] = (salesMap[rs.song_id] || 0) + total;
            }
          }
        }
      }

      const ranked: RankedSong[] = (songs || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        genre: s.genre,
        quality_score: s.quality_score || 0,
        streams: s.streams || 0,
        band_id: s.band_id,
        user_id: s.user_id,
        band_name: s.bands?.name || null,
        artist_name: null,
        total_sales: salesMap[s.id] || 0,
        audio_url: s.audio_url || null,
      }));

      // Sort based on ranking type
      switch (rankingType) {
        case "quality":
          ranked.sort((a, b) => b.quality_score - a.quality_score);
          break;
        case "sales":
          ranked.sort((a, b) => b.total_sales - a.total_sales);
          break;
        case "streams":
          ranked.sort((a, b) => b.streams - a.streams);
          break;
      }

      return ranked;
    },
    staleTime: 2 * 60 * 1000,
  });
};

export const useSongGenres = () => {
  return useQuery({
    queryKey: ["song-genres-for-rankings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("songs")
        .select("genre")
        .not("genre", "is", null)
        .in("status", ["released", "recorded"]);

      const genres = [...new Set((data || []).map(s => s.genre).filter(Boolean))] as string[];
      return genres.sort();
    },
    staleTime: 10 * 60 * 1000,
  });
};
