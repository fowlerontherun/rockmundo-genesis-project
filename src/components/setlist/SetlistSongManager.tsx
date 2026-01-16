import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useSetlistSongs,
  useAddSongToSetlist,
  useRemoveSongFromSetlist,
  useReorderSetlistSongs,
} from "@/hooks/useSetlists";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, GripVertical, Trash2, Music, Clock, Star, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { calculateSetlistDuration, formatDuration } from "@/utils/setlistDuration";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SetlistSongManagerProps {
  setlistId: string;
  bandId: string;
  onClose: () => void;
}

export const SetlistSongManager = ({
  setlistId,
  bandId,
  onClose,
}: SetlistSongManagerProps) => {
  const [selectedSongId, setSelectedSongId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: setlistSongs, isLoading } = useSetlistSongs(setlistId);
  const addSongMutation = useAddSongToSetlist();
  const removeSongMutation = useRemoveSongFromSetlist();
  const reorderMutation = useReorderSetlistSongs();

  const toggleEncoreMutation = useMutation({
    mutationFn: async ({ songId, isEncore }: { songId: string; isEncore: boolean }) => {
      const { error } = await supabase
        .from("setlist_songs")
        .update({ is_encore: isEncore })
        .eq("setlist_id", setlistId)
        .eq("song_id", songId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlist-songs", setlistId] });
      toast({ title: "Encore status updated" });
    },
  });

  const { data: availableSongs } = useQuery({
    queryKey: ["band-songs", bandId],
    queryFn: async () => {
      // Fetch both band songs and user songs that belong to band members
      const { data: bandSongs, error: bandError } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score, duration_seconds, duration_display, version, parent_song_id")
        .eq("band_id", bandId)
        .in("status", ["draft", "recorded"])
        .order("title");

      if (bandError) throw bandError;

      // Also fetch songs from band members (solo songs they wrote)
      const { data: bandMembers } = await supabase
        .from("band_members")
        .select("user_id")
        .eq("band_id", bandId);

      if (bandMembers && bandMembers.length > 0) {
        const memberUserIds = bandMembers.map(m => m.user_id);
        const { data: memberSongs, error: memberError } = await supabase
          .from("songs")
          .select("id, title, genre, quality_score, duration_seconds, duration_display, version, parent_song_id")
          .in("user_id", memberUserIds)
          .is("band_id", null)
          .in("status", ["draft", "recorded"])
          .order("title");

        if (!memberError && memberSongs) {
          return [...(bandSongs || []), ...memberSongs];
        }
      }

      return bandSongs || [];
    },
  });

  const songsInSetlist = new Set(setlistSongs?.map((ss) => ss.song_id));
  const unaddedSongs = availableSongs?.filter((song) => !songsInSetlist.has(song.id));

  const handleAddSong = async () => {
    if (!selectedSongId) return;

    const nextPosition = (setlistSongs?.length || 0) + 1;
    addSongMutation.mutate({
      setlistId,
      songId: selectedSongId,
      position: nextPosition,
    });
    setSelectedSongId("");
  };

  const handleRemoveSong = (setlistSongId: string) => {
    removeSongMutation.mutate({ setlistId, setlistSongId });
  };

  const handleToggleEncore = (songId: string, currentEncore: boolean) => {
    toggleEncoreMutation.mutate({ songId, isEncore: !currentEncore });
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    if (!setlistSongs || reorderMutation.isPending) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= setlistSongs.length) return;

    const newOrder = [...setlistSongs];
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];

    reorderMutation.mutate({
      setlistId,
      songUpdates: newOrder.map((song, idx) => ({
        id: song.id,
        position: idx + 1,
      })),
    });
  };

  const songCount = setlistSongs?.length || 0;
  const encoreCount = setlistSongs?.filter(ss => ss.is_encore).length || 0;

  const totalDuration = useMemo(() => {
    if (!setlistSongs) return null;
    return calculateSetlistDuration(setlistSongs.map(ss => ({
      duration_seconds: ss.songs?.duration_seconds
    })));
  }, [setlistSongs]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manage Setlist Songs</DialogTitle>
          <DialogDescription>
            Add songs and mark up to 2 as encore. Setlist duration determines slot eligibility.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default">
              {songCount} {songCount === 1 ? "song" : "songs"}
            </Badge>
            {totalDuration && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {totalDuration.displayTime}
              </Badge>
            )}
            {encoreCount > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {encoreCount} encore
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Kids/Opening: 30min • Support: 45min • Headline: 75min
            </span>
          </div>

          <div className="flex gap-2">
            <Select value={selectedSongId} onValueChange={setSelectedSongId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a song to add..." />
              </SelectTrigger>
              <SelectContent>
                {unaddedSongs?.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No songs available to add
                  </div>
                ) : (
                  unaddedSongs?.map((song) => (
                    <SelectItem key={song.id} value={song.id}>
                      {song.title} ({song.genre})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAddSong}
              disabled={!selectedSongId || addSongMutation.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Song
            </Button>
          </div>

          <ScrollArea className="h-[400px] rounded-md border p-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading songs...
              </div>
            ) : setlistSongs && setlistSongs.length === 0 ? (
              <div className="text-center py-8">
                <Music className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No songs in this setlist yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {setlistSongs?.map((ss, index) => (
                  <div
                    key={ss.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      ss.is_encore ? 'bg-primary/5 border-primary/20' : 'bg-card hover:bg-accent'
                    }`}
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium">{index + 1}.</span>
                        <span className="font-medium">{ss.songs?.title || "Unknown Song"}</span>
                        {ss.is_encore && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Encore
                          </Badge>
                        )}
                        {ss.songs?.duration_display && (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {ss.songs.duration_display}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {ss.songs?.genre} • Quality: {ss.songs?.quality_score || "N/A"}
                      </div>
                      {ss.notes && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Note: {ss.notes}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleMove(index, "up")}
                          disabled={index === 0 || reorderMutation.isPending}
                          title="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleMove(index, "down")}
                          disabled={index === (setlistSongs?.length || 0) - 1 || reorderMutation.isPending}
                          title="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleEncore(ss.song_id, ss.is_encore || false)}
                        disabled={toggleEncoreMutation.isPending || (!ss.is_encore && encoreCount >= 2)}
                        title={!ss.is_encore && encoreCount >= 2 ? "Maximum 2 encore songs" : "Mark as encore"}
                      >
                        <Star className={`h-4 w-4 ${ss.is_encore ? 'fill-current' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSong(ss.id)}
                        disabled={removeSongMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
