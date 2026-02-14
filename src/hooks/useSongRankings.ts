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

      const songIds = (songs || []).map(s => s.id);

      // Fetch actual streams from song_releases (the real source of streaming data)
      let streamsMap: Record<string, number> = {};
      if (songIds.length > 0) {
        const { data: songReleases } = await supabase
          .from("song_releases")
          .select("song_id, total_streams")
          .in("song_id", songIds);

        if (songReleases) {
          for (const sr of songReleases) {
            streamsMap[sr.song_id] = (streamsMap[sr.song_id] || 0) + (sr.total_streams || 0);
          }
        }
      }

      // Fetch actual sales from release_sales via release_formats -> releases -> release_songs
      let salesMap: Record<string, number> = {};
      if (rankingType === "sales" && songIds.length > 0) {
        const { data: releaseSongs } = await supabase
          .from("release_songs")
          .select("song_id, release_id")
          .in("song_id", songIds);

        if (releaseSongs && releaseSongs.length > 0) {
          const releaseIds = [...new Set(releaseSongs.map(rs => rs.release_id))];
          
          const { data: releaseFormats } = await supabase
            .from("release_formats")
            .select("id, release_id")
            .in("release_id", releaseIds);

          if (releaseFormats && releaseFormats.length > 0) {
            const formatIds = releaseFormats.map(rf => rf.id);
            const releaseToFormats = new Map<string, string[]>();
            for (const rf of releaseFormats) {
              const arr = releaseToFormats.get(rf.release_id) || [];
              arr.push(rf.id);
              releaseToFormats.set(rf.release_id, arr);
            }

            const { data: sales } = await supabase
              .from("release_sales")
              .select("release_format_id, total_amount")
              .in("release_format_id", formatIds);

            if (sales) {
              // Map format_id -> release_id
              const formatToRelease = new Map<string, string>();
              for (const rf of releaseFormats) {
                formatToRelease.set(rf.id, rf.release_id);
              }
              // Map release_id -> song_ids
              const releaseToSongs = new Map<string, string[]>();
              for (const rs of releaseSongs) {
                const arr = releaseToSongs.get(rs.release_id) || [];
                arr.push(rs.song_id);
                releaseToSongs.set(rs.release_id, arr);
              }

              for (const sale of sales) {
                const releaseId = formatToRelease.get(sale.release_format_id);
                if (releaseId) {
                  const songIdsForRelease = releaseToSongs.get(releaseId) || [];
                  const perSongAmount = (sale.total_amount || 0) / Math.max(songIdsForRelease.length, 1);
                  for (const sid of songIdsForRelease) {
                    salesMap[sid] = (salesMap[sid] || 0) + perSongAmount;
                  }
                }
              }
            }
          }
        }
      }

      const ranked: RankedSong[] = (songs || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        genre: s.genre,
        quality_score: s.quality_score || 0,
        streams: streamsMap[s.id] || s.streams || 0,
        band_id: s.band_id,
        user_id: s.user_id,
        band_name: s.bands?.name || null,
        artist_name: null,
        total_sales: Math.round(salesMap[s.id] || 0),
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
