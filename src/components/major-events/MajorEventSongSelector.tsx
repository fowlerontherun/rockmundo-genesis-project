import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

interface MajorEventSongSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bandId: string;
  onConfirm: (song1Id: string, song2Id: string, song3Id: string) => void;
}

export function MajorEventSongSelector({
  open,
  onOpenChange,
  bandId,
  onConfirm,
}: MajorEventSongSelectorProps) {
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ['band-songs-for-major-event', bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, duration_seconds, quality_score, genre')
        .eq('band_id', bandId)
        .eq('status', 'recorded')
        .neq('archived', true)
        .order('quality_score', { ascending: false });

      if (error) throw error;
      return data as Song[];
    },
    enabled: open && !!bandId,
  });

  const toggleSong = (songId: string) => {
    setSelectedSongs((prev) => {
      if (prev.includes(songId)) {
        return prev.filter((id) => id !== songId);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, songId];
    });
  };

  const handleConfirm = () => {
    if (selectedSongs.length === 3) {
      onConfirm(selectedSongs[0], selectedSongs[1], selectedSongs[2]);
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
            Choose Your 3 Songs
          </DialogTitle>
          <DialogDescription>
            Select exactly 3 songs for your major event performance. This is the big stage — bring your best!
          </DialogDescription>
        </DialogHeader>

        {songs.length < 3 && !isLoading ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need at least 3 recorded songs to perform at a major event!
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
                      } ${selectedSongs.length >= 3 && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => toggleSong(song.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          disabled={selectedSongs.length >= 3 && !isSelected}
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
                {selectedSongs.length}/3 songs selected
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
            disabled={selectedSongs.length !== 3}
          >
            Confirm Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
