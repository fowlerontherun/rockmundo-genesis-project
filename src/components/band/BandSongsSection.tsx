import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Music, Play, Star } from "lucide-react";
import { TrackableSongPlayer } from "@/components/audio/TrackableSongPlayer";
import { SongVoting } from "@/components/audio/SongVoting";

interface BandSongsSectionProps {
  bandId: string;
  bandName?: string;
}

interface BandSong {
  id: string;
  title: string;
  genre: string | null;
  quality_score: number | null;
  status: string | null;
  audio_url: string | null;
  audio_generation_status: string | null;
  play_count: number;
}

export function BandSongsSection({ bandId, bandName }: BandSongsSectionProps) {
  const { data: songs, isLoading } = useQuery({
    queryKey: ["band-songs", bandId],
    queryFn: async () => {
      // Get songs with play counts
      const { data: songsData, error } = await supabase
        .from("songs")
        .select(`
          id,
          title,
          genre,
          quality_score,
          status,
          audio_url,
          audio_generation_status
        `)
        .eq("band_id", bandId)
        .in("status", ["recorded", "released"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get play counts for each song
      const songIds = songsData?.map(s => s.id) || [];
      const { data: playCounts } = await supabase
        .from("song_plays")
        .select("song_id")
        .in("song_id", songIds);

      const playCountMap = new Map<string, number>();
      playCounts?.forEach(p => {
        playCountMap.set(p.song_id, (playCountMap.get(p.song_id) || 0) + 1);
      });

      return (songsData || []).map(song => ({
        ...song,
        play_count: playCountMap.get(song.id) || 0,
      })) as BandSong[];
    },
    enabled: !!bandId,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Songs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!songs || songs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Songs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No recorded songs yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Songs ({songs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {songs.map((song) => (
          <div
            key={song.id}
            className="flex flex-col gap-2 p-3 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{song.title}</h4>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {song.genre && (
                    <Badge variant="secondary" className="text-xs">
                      {song.genre}
                    </Badge>
                  )}
                  {song.quality_score && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {song.quality_score}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    {song.play_count} plays
                  </span>
                </div>
              </div>
              <SongVoting songId={song.id} compact showCounts />
            </div>

            {song.audio_url && (
              <TrackableSongPlayer
                songId={song.id}
                audioUrl={song.audio_url}
                title={song.title}
                artist={bandName}
                generationStatus={song.audio_generation_status}
                compact
                source="band_profile"
              />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
