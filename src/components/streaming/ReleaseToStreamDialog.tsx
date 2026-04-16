import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Music2, Loader2 } from "lucide-react";
import { useStreaming } from "@/hooks/useStreaming";
import { useReleasedSongs } from "@/hooks/useReleasedSongs";
import { useToast } from "@/hooks/use-toast";

interface ReleaseToStreamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export const ReleaseToStreamDialog = ({ open, onOpenChange, userId }: ReleaseToStreamDialogProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { platforms, releaseToStreaming } = useStreaming(userId);
  const { data: releasedSongs, isLoading: songsLoading } = useReleasedSongs(userId);

  const [selectedSong, setSelectedSong] = useState<string>("");
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Look up which platforms the chosen song is already live on
  const { data: existingPlatformIds = [] } = useQuery({
    queryKey: ["song-existing-streaming-platforms", selectedSong],
    queryFn: async () => {
      if (!selectedSong) return [];
      const { data } = await supabase
        .from("song_releases")
        .select("platform_id")
        .eq("song_id", selectedSong)
        .eq("release_type", "streaming")
        .eq("is_active", true);
      return (data || []).map((r: any) => r.platform_id).filter(Boolean);
    },
    enabled: !!selectedSong && open,
  });

  const availablePlatforms = useMemo(
    () => (platforms || []).filter((p: any) => !existingPlatformIds.includes(p.id)),
    [platforms, existingPlatformIds],
  );

  const togglePlatform = (id: string) => {
    setSelectedPlatformIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id],
    );
  };

  const reset = () => {
    setSelectedSong("");
    setSelectedPlatformIds([]);
    setSubmitting(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!selectedSong || selectedPlatformIds.length === 0) return;
    const song = releasedSongs?.find(s => s.id === selectedSong);
    if (!song) return;

    setSubmitting(true);
    let successes = 0;
    let failures = 0;

    for (const platformId of selectedPlatformIds) {
      const platformName = platforms?.find((p: any) => p.id === platformId)?.platform_name;
      try {
        await releaseToStreaming.mutateAsync({
          songId: selectedSong,
          platformId,
          userId,
          releaseId: song.release_id,
          bandId: song.band_id,
          songTitle: song.title,
          platformName,
        });
        successes += 1;
      } catch {
        failures += 1;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["streaming-releases"] });
    queryClient.invalidateQueries({ queryKey: ["user-streaming-stats"] });

    toast({
      title: failures === 0 ? "Released" : "Partial release",
      description:
        failures === 0
          ? `"${song.title}" is now live on ${successes} platform${successes !== 1 ? "s" : ""}.`
          : `${successes} succeeded, ${failures} failed.`,
      variant: failures > 0 && successes === 0 ? "destructive" : "default",
    });

    setSubmitting(false);
    if (successes > 0) handleClose(false);
  };

  const noSongs = !songsLoading && (!releasedSongs || releasedSongs.length === 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5 text-primary" />
            Release to Streaming
          </DialogTitle>
          <DialogDescription>
            Pick a released song and choose which streaming platforms to push it to.
          </DialogDescription>
        </DialogHeader>

        {noSongs ? (
          <div className="text-center py-8 space-y-3">
            <Music2 className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
            <div>
              <p className="font-semibold">No released music yet</p>
              <p className="text-sm text-muted-foreground">
                Create and release a single, EP, or album first.
              </p>
            </div>
            <Button variant="outline" onClick={() => { handleClose(false); navigate("/release-manager"); }}>
              Go to Release Manager
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Song</Label>
              <Select value={selectedSong} onValueChange={(v) => { setSelectedSong(v); setSelectedPlatformIds([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder={songsLoading ? "Loading..." : "Choose a song"} />
                </SelectTrigger>
                <SelectContent>
                  {releasedSongs?.map((song) => (
                    <SelectItem key={`${song.id}-${song.release_id}`} value={song.id}>
                      {song.title} <span className="text-muted-foreground">({song.release_title})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Platforms</Label>
                {selectedSong && availablePlatforms.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() =>
                      setSelectedPlatformIds(
                        selectedPlatformIds.length === availablePlatforms.length
                          ? []
                          : availablePlatforms.map((p: any) => p.id),
                      )
                    }
                  >
                    {selectedPlatformIds.length === availablePlatforms.length ? "Clear" : "Select all"}
                  </button>
                )}
              </div>

              {!selectedSong ? (
                <p className="text-sm text-muted-foreground py-3 text-center border rounded-md">
                  Select a song to choose platforms.
                </p>
              ) : availablePlatforms.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center border rounded-md">
                  This song is already live on every available platform.
                </p>
              ) : (
                <ScrollArea className="h-56 border rounded-md p-2">
                  <div className="space-y-1">
                    {availablePlatforms.map((platform: any) => {
                      const checked = selectedPlatformIds.includes(platform.id);
                      return (
                        <label
                          key={platform.id}
                          className="flex items-center justify-between gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Checkbox checked={checked} onCheckedChange={() => togglePlatform(platform.id)} />
                            <span className="font-medium truncate">{platform.platform_name}</span>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            ${(platform.base_payout_per_stream * 1000).toFixed(2)}/1K
                          </Badge>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              {existingPlatformIds.length > 0 && selectedSong && (
                <p className="text-xs text-muted-foreground">
                  Already live on {existingPlatformIds.length} platform{existingPlatformIds.length !== 1 ? "s" : ""} (hidden above).
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          {!noSongs && (
            <Button
              onClick={handleSubmit}
              disabled={!selectedSong || selectedPlatformIds.length === 0 || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Release to {selectedPlatformIds.length || ""} Platform{selectedPlatformIds.length !== 1 ? "s" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
