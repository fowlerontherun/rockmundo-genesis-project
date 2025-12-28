import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Music,
  Calendar,
  Clock,
  TrendingUp,
  Sparkles,
  Headphones,
  Flame,
  Star,
} from "lucide-react";
import { SongPlayer } from "@/components/audio/SongPlayer";
import { SongVoting } from "@/components/audio/SongVoting";

interface SongDetailDialogProps {
  songId: string | null;
  onClose: () => void;
}

export const SongDetailDialog = ({ songId, onClose }: SongDetailDialogProps) => {
  const { data: song, isLoading } = useQuery({
    queryKey: ["song-details", songId],
    queryFn: async () => {
      if (!songId) return null;
      
      const { data, error } = await supabase
        .from("songs")
        .select(`
          *,
          bands (
            name,
            genre
          )
        `)
        .eq("id", songId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!songId,
  });

  if (!songId) return null;

  return (
    <Dialog open={!!songId} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Music className="h-6 w-6" />
            {song?.title || "Loading..."}
          </DialogTitle>
          <DialogDescription>
            {song?.bands?.name || "Solo Artist"} • {song?.genre}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading song details...
            </div>
          ) : song ? (
            <div className="space-y-6">
              {/* Audio Player */}
              {(song.audio_url || song.audio_generation_status) && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Headphones className="h-4 w-4" />
                    Listen
                  </h3>
                  <SongPlayer
                    audioUrl={song.audio_url}
                    title={song.title}
                    artist={song.bands?.name || "Solo Artist"}
                    generationStatus={song.audio_generation_status}
                  />
                  <div className="mt-3">
                    <SongVoting songId={song.id} />
                  </div>
                </div>
              )}

              {(song.audio_url || song.audio_generation_status) && <Separator />}

              {/* Quality Overview */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Quality Metrics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-primary/5 border">
                    <div className="text-2xl font-bold text-primary">
                      {song.quality_score}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Overall Quality
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 border">
                    <div className="text-2xl font-bold">
                      {song.melody_strength || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Melody</div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 border">
                    <div className="text-2xl font-bold">
                      {song.lyrics_strength || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Lyrics</div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 border">
                    <div className="text-2xl font-bold">
                      {song.arrangement_strength || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Arrangement
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Hype & Fame */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Performance Metrics
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Flame className="h-4 w-4 text-orange-500" />
                      <span className="text-xs text-muted-foreground">Hype</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-500">
                      {song.hype || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Buzz & anticipation
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="h-4 w-4 text-purple-500" />
                      <span className="text-xs text-muted-foreground">Fame</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-500">
                      {song.fame || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      From sales, streams & radio
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Basic Information */}
              <div>
                <h3 className="font-semibold mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Genre:</span>
                    <Badge variant="outline">{song.genre}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Duration:</span>
                    <span>{song.duration_display || "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created:</span>
                    <span>
                      {new Date(song.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Status:</span>
                    <Badge>{song.catalog_status || "Unreleased"}</Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Lyrics Preview */}
              {song.lyrics && (
                <div>
                  <h3 className="font-semibold mb-2">Lyrics Preview</h3>
                  <div className="p-4 rounded-lg bg-secondary/30 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {song.lyrics.substring(0, 300)}
                    {song.lyrics.length > 300 && "..."}
                  </div>
                  {song.ai_generated_lyrics && (
                    <div className="text-xs text-muted-foreground mt-2">
                      ✨ AI-assisted lyrics
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Song not found
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button className="flex-1">Add to Setlist</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
