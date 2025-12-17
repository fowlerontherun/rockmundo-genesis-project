import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Music, Play, Headphones, ExternalLink } from "lucide-react";
import { SongPlayer } from "@/components/audio/SongPlayer";
import { Link } from "react-router-dom";
import { useTrackSongPlay } from "@/hooks/useTrackSongPlay";

type TopTrack = {
  song_id: string;
  title: string;
  band_id: string | null;
  band_name: string | null;
  audio_url: string | null;
  unique_plays: number;
  quality_score: number | null;
  genre: string | null;
};

export function TopTracksNews() {
  const { trackPlay } = useTrackSongPlay();

  const { data: topTracks, isLoading } = useQuery({
    queryKey: ["news-top-tracks"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_played_songs", { p_limit: 5 });
      if (error) throw error;
      return data as TopTrack[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getRankIcon = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Headphones className="h-5 w-5" />
            Top Tracks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <div className="animate-pulse text-muted-foreground">Loading top tracks...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="md:col-span-2 lg:col-span-3">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Headphones className="h-5 w-5 text-primary" />
            Top Tracks Right Now
          </CardTitle>
          <Link to="/admin/ai-song-generation">
            <Button variant="ghost" size="sm" className="gap-1">
              View All
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {topTracks && topTracks.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {topTracks.map((track, index) => (
              <div
                key={track.song_id}
                className="rounded-lg border bg-card/50 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg flex-shrink-0">{getRankIcon(index)}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate text-sm">{track.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {track.band_name || "Artist"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    <Play className="h-3 w-3 mr-1" />
                    {track.unique_plays}
                  </Badge>
                </div>
                
                {track.audio_url ? (
                  <SongPlayer
                    audioUrl={track.audio_url}
                    title={track.title}
                    artist={track.band_name || "Artist"}
                    compact
                    onPlay={() => trackPlay(track.song_id)}
                  />
                ) : (
                  <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                    <Music className="h-4 w-4 mr-1 opacity-50" />
                    No audio yet
                  </div>
                )}
                
                {track.genre && (
                  <Badge variant="outline" className="text-xs w-full justify-center">
                    {track.genre}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Music className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>No tracks with plays yet</p>
            <p className="text-sm">Be the first to listen to some songs!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
