import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchBandAvailableSongs } from "@/hooks/useBandAvailableSongs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Music, Clock, Star, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Song {
  id: string;
  title: string;
  duration_seconds: number;
  quality_score: number;
  genre: string;
}

interface OpenMicSongSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bandId?: string | null;
  profileId?: string | null;
  onConfirm: (song1Id: string, song2Id: string) => void;
}

const normalizeSong = (song: {
  id: string;
  title: string | null;
  duration_seconds: number | null;
  quality_score: number | null;
  genre: string | null;
}): Song => ({
  id: song.id,
  title: song.title || "Untitled song",
  duration_seconds: song.duration_seconds || 0,
  quality_score: song.quality_score || 0,
  genre: song.genre || "Unknown",
});

export function OpenMicSongSelector({
  open,
  onOpenChange,
  bandId,
  profileId,
  onConfirm,
}: OpenMicSongSelectorProps) {
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ['songs-for-open-mic', bandId ?? null, profileId ?? null],
    queryFn: async () => {
      // Open mic should use the same repertoire source as rehearsals and
      // setlists. A band's available songs can include songs owned by active
      // members even when songs.band_id is null, which is common for songs that
      // were written before being rehearsed with the band.
      if (bandId) {
        const availableSongs = await fetchBandAvailableSongs(bandId);
        return availableSongs
          .map(normalizeSong)
          .sort((a, b) => b.quality_score - a.quality_score);
      }

      if (!profileId) return [] as Song[];

      // Solo performers can use their own unarchived songs without requiring a
      // recording. Keep this character-scoped so songs from another character
      // on the same auth account are never mixed in.
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, duration_seconds, quality_score, genre')
        .eq('profile_id', profileId)
        .is('band_id', null)
        .or('archived.is.null,archived.eq.false')
        .order('quality_score', { ascending: false });

      if (error) throw error;
      return (data || []).map(normalizeSong);
    },
    enabled: open && (!!bandId || !!profileId),
  });

  const toggleSong = (songId: string) => {
    setSelectedSongs((prev) => {
      if (prev.includes(songId)) {
        return prev.filter((id) => id !== songId);
      }
      if (prev.length >= 2) {
        return prev;
      }
      return [...prev, songId];
    });
  };

  const handleConfirm = () => {
    if (selectedSongs.length === 2) {
      onConfirm(selectedSongs[0], selectedSongs[1]);
      setSelectedSongs([]);
      onOpenChange(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDuration = selectedSongs.reduce((acc, songId) => {
    const song = songs.find((s) => s.id === songId);
    return acc + (song?.duration_seconds || 0);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Choose Your 2 Songs
          </DialogTitle>
          <DialogDescription>
            Select exactly 2 songs for your open mic performance. Choose wisely - quality matters!
          </DialogDescription>
        </DialogHeader>

        {songs.length === 0 && !isLoading ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No eligible songs were found. Band entries can use songs available to the active band, including songs written by active band members; solo entries use your own songs.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {songs.map((song) => {
                  const isSelected = selectedSongs.includes(song.id);
                  const selectionIndex = selectedSongs.indexOf(song.id);

                  return (
                    <div
                      key={song.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      } ${selectedSongs.length >= 2 && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => toggleSong(song.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          disabled={selectedSongs.length >= 2 && !isSelected}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{song.title}</span>
                            {isSelected && (
                              <Badge variant="secondary" className="text-xs">
                                Song {selectionIndex + 1}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(song.duration_seconds)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {song.quality_score}%
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {song.genre}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">
                {selectedSongs.length}/2 songs selected
              </span>
              <span className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Total: {formatDuration(totalDuration)}
              </span>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedSongs.length !== 2}
          >
            Confirm Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
