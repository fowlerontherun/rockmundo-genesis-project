import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReleasedSong {
  id: string;
  title: string;
  genre: string;
  duration_seconds: number;
  quality_score: number;
  release_id: string;
  release_title: string;
  release_status: string;
  user_id: string;
  band_id?: string;
}

export function useReleasedSongs(userId: string | undefined, bandId?: string) {
  return useQuery({
    queryKey: ["released-songs", userId, bandId],
    queryFn: async () => {
      // Get user's releases
      let releasesQuery = supabase
        .from("releases")
        .select("id")
        .eq("release_status", "released");

      if (bandId) {
        releasesQuery = releasesQuery.eq("band_id", bandId);
      } else if (userId) {
        releasesQuery = releasesQuery.eq("user_id", userId);
      }

      const { data: releases, error: releasesError } = await releasesQuery;
      if (releasesError) throw releasesError;
      if (!releases || releases.length === 0) return [];

      const releaseIds = releases.map((r) => r.id);

      // Get songs from these releases
      const { data: releaseSongs, error: rsError } = await supabase
        .from("release_songs")
        .select("song_id, release_id")
        .in("release_id", releaseIds);

      if (rsError) throw rsError;
      if (!releaseSongs || releaseSongs.length === 0) return [];

      const songIds = [...new Set(releaseSongs.map((rs) => rs.song_id))];

      // Get full song details
      const { data: songs, error: songsError } = await supabase
        .from("songs")
        .select("*, releases:release_songs!inner(release:releases(id, title, release_status))")
        .in("id", songIds)
        .in("status", ["recorded", "completed"]);

      if (songsError) throw songsError;

      // Transform to our interface
      const releasedSongs: ReleasedSong[] = songs?.flatMap((song: any) => {
        const releases = song.releases?.filter(
          (r: any) => r.release?.release_status === "released"
        );
        return releases?.map((r: any) => ({
          id: song.id,
          title: song.title,
          genre: song.genre,
          duration_seconds: song.duration_seconds,
          quality_score: song.quality_score,
          release_id: r.release.id,
          release_title: r.release.title,
          release_status: r.release.release_status,
          user_id: song.user_id,
          band_id: song.band_id,
        }));
      }) || [];

      return releasedSongs;
    },
    enabled: !!userId || !!bandId,
  });
}
