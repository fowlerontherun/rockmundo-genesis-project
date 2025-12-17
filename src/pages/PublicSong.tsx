import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SongPlayer } from "@/components/audio/SongPlayer";
import { SongShareButtons } from "@/components/audio/SongShareButtons";
import { SongVoting } from "@/components/audio/SongVoting";
import { Music, User, Clock, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PublicSong() {
  const { songId } = useParams<{ songId: string }>();

  const { data: song, isLoading, error } = useQuery({
    queryKey: ["public-song", songId],
    queryFn: async () => {
      if (!songId) throw new Error("No song ID");
      
      const { data, error } = await supabase
        .from("songs")
        .select(`
          id,
          title,
          genre,
          duration_seconds,
          quality_score,
          audio_url,
          status,
          created_at,
          band_id,
          bands (
            id,
            name,
            artist_name,
            logo_url
          )
        `)
        .eq("id", songId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!songId,
  });

  // Set document title
  useEffect(() => {
    if (song) {
      const artistName = song.bands?.artist_name || song.bands?.name || "Unknown Artist";
      document.title = `${song.title} by ${artistName} | Rockmundo`;
    } else {
      document.title = "Song | Rockmundo";
    }
    return () => {
      document.title = "Rockmundo";
    };
  }, [song]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading song...</div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold mb-2">Song Not Found</h1>
            <p className="text-muted-foreground mb-4">
              This song may have been removed or doesn't exist.
            </p>
            <Button asChild>
              <a href="/">Visit Rockmundo</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const artistName = song.bands?.artist_name || song.bands?.name || "Unknown Artist";
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "Unknown";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-xl font-bold">
            <Music className="h-6 w-6 text-primary" />
            Rockmundo
          </a>
          <Button asChild variant="outline" size="sm">
            <a href="/auth">Sign In</a>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="overflow-hidden">
          {/* Song Header */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
            <div className="flex items-start gap-4">
              {song.bands?.logo_url ? (
                <img 
                  src={song.bands.logo_url} 
                  alt={artistName}
                  className="w-20 h-20 rounded-lg object-cover shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Music className="h-8 w-8 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold truncate">{song.title}</h1>
                <p className="text-muted-foreground flex items-center gap-1 mt-1">
                  <User className="h-4 w-4" />
                  {artistName}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {song.genre && <Badge variant="secondary">{song.genre}</Badge>}
                  {song.duration_seconds && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(song.duration_seconds)}
                    </span>
                  )}
                  {song.quality_score && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {song.quality_score}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Audio Player */}
            {song.audio_url ? (
              <div className="space-y-4">
                <SongPlayer
                  songId={song.id}
                  audioUrl={song.audio_url}
                  title={song.title}
                  artist={artistName}
                  showShare={false}
                />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Audio not available for this song</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <SongVoting songId={song.id} compact />
              <SongShareButtons
                songId={song.id}
                songTitle={song.title}
                artistName={artistName}
              />
            </div>

            {/* CTA */}
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Want to create your own music and build a band?
              </p>
              <Button asChild>
                <a href="/auth">Join Rockmundo Free</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Rockmundo - Music Industry Simulation Game</p>
        </div>
      </footer>
    </div>
  );
}
