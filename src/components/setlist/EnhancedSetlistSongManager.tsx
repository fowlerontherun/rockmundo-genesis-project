import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useSetlistSongs,
  useAddSongToSetlist,
  useRemoveSongFromSetlist,
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
import { Plus, GripVertical, Trash2, Music, Clock, Star, Sparkles, Guitar, Disc } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { calculateSetlistDuration, formatDuration } from "@/utils/setlistDuration";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PerformanceItemSelector } from "./PerformanceItemSelector";
import type { PerformanceItem } from "@/hooks/usePerformanceItems";

interface EnhancedSetlistSongManagerProps {
  setlistId: string;
  bandId: string;
  onClose: () => void;
}

export const EnhancedSetlistSongManager = ({
  setlistId,
  bandId,
  onClose,
}: EnhancedSetlistSongManagerProps) => {
  const [selectedSongId, setSelectedSongId] = useState<string>("");
  const [showPerformanceSelector, setShowPerformanceSelector] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: setlistSongs, isLoading } = useSetlistSongs(setlistId);
  const addSongMutation = useAddSongToSetlist();
  const removeSongMutation = useRemoveSongFromSetlist();

  // Get user skills and genres for performance item filtering
  const { data: userSkills } = useQuery({
    queryKey: ['user-skills'],
    queryFn: async () => {
      console.log('[EnhancedSetlistSongManager] Fetching user skills - currently returning empty object');
      // Return empty object for now - skills integration can be added later
      return {} as Record<string, number>;
    },
  });

  const { data: band } = useQuery({
    queryKey: ['band-details', bandId],
    queryFn: async () => {
      const { data } = await supabase
        .from('bands')
        .select('genre')
        .eq('id', bandId)
        .single();
      
      console.log('[EnhancedSetlistSongManager] Fetched band data:', {
        bandId,
        genre: data?.genre
      });
      return data;
    },
  });

  const addPerformanceItemMutation = useMutation({
    mutationFn: async (item: PerformanceItem) => {
      // Check if we already have 5 performance items
      const currentPerformanceItems = setlistSongs?.filter(s => s.item_type === 'performance_item') || [];
      if (currentPerformanceItems.length >= 5) {
        throw new Error('Maximum 5 performance items per setlist');
      }
      
      const nextPosition = getNextPosition();
      
      console.log('[EnhancedSetlistSongManager] Adding performance item:', {
        itemId: item.id,
        itemName: item.name,
        setlistId,
        nextPosition,
        currentMainSectionCount: setlistSongs?.filter(s => s.section === 'main').length || 0,
        currentPerformanceItemCount: currentPerformanceItems.length
      });
      
      const { error } = await supabase
        .from("setlist_songs")
        .insert({
          setlist_id: setlistId,
          item_type: 'performance_item',
          performance_item_id: item.id,
          position: nextPosition,
          section: 'main',
        });
      
      if (error) {
        console.error('[EnhancedSetlistSongManager] Error adding performance item:', error);
        throw error;
      }
      
      console.log('[EnhancedSetlistSongManager] Successfully added performance item');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlist-songs", setlistId] });
      toast({ title: "Performance item added to setlist" });
      setShowPerformanceSelector(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveToEncoreMutation = useMutation({
    mutationFn: async ({ setlistSongId, itemType }: { setlistSongId: string; itemType: string }) => {
      const encoreCount = setlistSongs?.filter(s => s.section === 'encore').length || 0;
      
      console.log('[moveToEncore] Moving item:', {
        setlistSongId,
        itemType,
        currentEncoreCount: encoreCount
      });
      
      const nextPosition = getNextPosition();

      const { data, error } = await supabase
        .from("setlist_songs")
        .update({
          section: 'encore',
          position: nextPosition,
          is_encore: true
        })
        .eq("id", setlistSongId)
        .select();
      
      if (error) {
        console.error('[moveToEncore] Error:', error);
        throw error;
      }
      
      console.log('[moveToEncore] Successfully moved to encore:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlist-songs", setlistId] });
      toast({ title: "Moved to encore section" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to move to encore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveToMainMutation = useMutation({
    mutationFn: async ({ setlistSongId }: { setlistSongId: string }) => {
      const mainCount = setlistSongs?.filter(s => s.section === 'main').length || 0;

      console.log('[moveToMain] Moving item:', {
        setlistSongId,
        currentMainCount: mainCount
      });

      const nextPosition = getNextPosition();

      const { data, error } = await supabase
        .from("setlist_songs")
        .update({
          section: 'main',
          position: nextPosition,
          is_encore: false
        })
        .eq("id", setlistSongId)
        .select();
      
      if (error) {
        console.error('[moveToMain] Error:', error);
        throw error;
      }
      
      console.log('[moveToMain] Successfully moved to main:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlist-songs", setlistId] });
      toast({ title: "Moved to main setlist" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to move to main",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [versionFilter, setVersionFilter] = useState<string>("all");

  const { data: availableSongs } = useQuery({
    queryKey: ["band-songs", bandId],
    queryFn: async () => {
      console.log('[EnhancedSetlistSongManager] Fetching available songs for bandId:', bandId);
      
      const { data: bandSongs, error: bandError } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score, duration_seconds, duration_display, status, band_id, user_id, version, parent_song_id")
        .eq("band_id", bandId)
        .eq("archived", false)
        .order("title");

      if (bandError) {
        console.error('[EnhancedSetlistSongManager] Error fetching band songs:', bandError);
        throw bandError;
      }
      
      console.log('[EnhancedSetlistSongManager] Found band songs:', bandSongs?.length || 0, bandSongs);

      const { data: bandMembers } = await supabase
        .from("band_members")
        .select("user_id")
        .eq("band_id", bandId);

      if (bandMembers && bandMembers.length > 0) {
        const memberUserIds = bandMembers.map(m => m.user_id).filter(Boolean);
        console.log('[EnhancedSetlistSongManager] Fetching member songs for users:', memberUserIds);
        
        const { data: memberSongs, error: memberError } = await supabase
          .from("songs")
          .select("id, title, genre, quality_score, duration_seconds, duration_display, status, band_id, user_id, version, parent_song_id")
          .in("user_id", memberUserIds)
          .is("band_id", null)
          .eq("archived", false)
          .order("title");

        if (!memberError && memberSongs) {
          console.log('[EnhancedSetlistSongManager] Found member songs:', memberSongs.length, memberSongs);
          const allSongs = [...(bandSongs || []), ...memberSongs];
          console.log('[EnhancedSetlistSongManager] Total available songs:', allSongs.length);
          return allSongs;
        }
      }

      console.log('[EnhancedSetlistSongManager] Returning only band songs:', bandSongs?.length || 0);
      return bandSongs || [];
    },
  });

  const filteredAvailableSongs = useMemo(() => {
    if (!availableSongs) return [];
    if (versionFilter === "all") return availableSongs;
    return availableSongs.filter(song => (song.version || 'standard') === versionFilter);
  }, [availableSongs, versionFilter]);

  const songsInSetlist = new Set(
    (setlistSongs ?? [])
      .map((ss) => ss.song_id)
      .filter((id): id is string => Boolean(id))
  );
  const unaddedSongs = filteredAvailableSongs?.filter((song) => !songsInSetlist.has(song.id));

  const getNextPosition = () =>
    Math.max(0, ...(setlistSongs?.map(song => song.position || 0) || [])) + 1;

  const handleAddSong = () => {
    if (!selectedSongId) return;

    const nextPosition = getNextPosition();
    
    addSongMutation.mutate({
      setlistId,
      songId: selectedSongId,
      position: nextPosition,
      section: 'main',
      itemType: 'song',
    });
    
    setSelectedSongId("");
  };

  const handleRemoveSong = (setlistSongId: string) => {
    removeSongMutation.mutate({ setlistId, setlistSongId });
  };

  const mainSetlist = setlistSongs?.filter(s => s.section === 'main') || [];
  const encoreSetlist = setlistSongs?.filter(s => s.section === 'encore') || [];
  
  const songCount = setlistSongs?.length || 0;
  const encoreCount = encoreSetlist.length;

  const totalDuration = useMemo(() => {
    if (!setlistSongs) return null;
    return calculateSetlistDuration(setlistSongs.map(ss => ({
      duration_seconds: ss.songs?.duration_seconds
    })));
  }, [setlistSongs]);

  const renderSetlistItem = (ss: any, index: number, section: 'main' | 'encore') => {
    const isPerformanceItem = ss.item_type === 'performance_item';
    const songVersion = ss.songs?.version;
    
    return (
      <div
        key={ss.id}
        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
        <div className="flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium">{index + 1}.</span>
            <span className="font-medium">
              {isPerformanceItem ? ss.performance_items?.name : ss.songs?.title || "Unknown"}
            </span>
            {isPerformanceItem && (
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Performance
              </Badge>
            )}
            {!isPerformanceItem && songVersion && songVersion !== 'standard' && (
              <Badge variant="outline" className={`text-xs ${songVersion === 'acoustic' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20'}`}>
                {songVersion === 'acoustic' ? <Guitar className="h-3 w-3 mr-1" /> : <Disc className="h-3 w-3 mr-1" />}
                {songVersion === 'acoustic' ? 'Acoustic' : 'Remix'}
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {isPerformanceItem 
              ? ss.performance_items?.category?.replace('_', ' ')
              : `${ss.songs?.genre} • Quality: ${ss.songs?.quality_score || "N/A"}`
            }
          </div>
        </div>
        <div className="flex items-center gap-2">
          {section === 'main' && encoreCount < 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => moveToEncoreMutation.mutate({ 
                setlistSongId: ss.id,
                itemType: ss.item_type
              })}
            >
              <Star className="h-4 w-4" />
            </Button>
          )}
          {section === 'encore' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => moveToMainMutation.mutate({ 
                setlistSongId: ss.id
              })}
            >
              Move to Main
            </Button>
          )}
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
    );
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Manage Setlist</DialogTitle>
            <DialogDescription>
              Add songs and performance items. Move up to 2 items to the encore section.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default">
                {songCount} {songCount === 1 ? "item" : "items"}
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
            </div>

            <div className="flex gap-2 flex-wrap">
              <Select value={versionFilter} onValueChange={setVersionFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Versions</SelectItem>
                  <SelectItem value="standard">Original</SelectItem>
                  <SelectItem value="acoustic">🎸 Acoustic</SelectItem>
                  <SelectItem value="remix">🎧 Remix</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedSongId} onValueChange={setSelectedSongId}>
                <SelectTrigger className="flex-1 min-w-[200px]">
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
                        {song.version && song.version !== 'standard' && ` [${song.version === 'acoustic' ? '🎸' : '🎧'}]`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddSong}
                disabled={!selectedSongId || addSongMutation.isPending}
              >
                <Music className="mr-2 h-4 w-4" />
                Add Song
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowPerformanceSelector(true)}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Add Performance
              </Button>
            </div>

            <ScrollArea className="h-[500px] rounded-md border p-4">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Main Setlist */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Music className="h-4 w-4" />
                      Main Setlist ({mainSetlist.length} items)
                    </h3>
                    <div className="space-y-2">
                      {mainSetlist.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No items in main setlist yet
                        </div>
                      ) : (
                        mainSetlist.map((ss, index) => renderSetlistItem(ss, index, 'main'))
                      )}
                    </div>
                  </div>

                  {/* Encore Section */}
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Star className="h-4 w-4 fill-current" />
                      Encore ({encoreSetlist.length}/2 items)
                    </h3>
                    <div className="space-y-2">
                      {encoreSetlist.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          Move items here for your encore performance
                        </div>
                      ) : (
                        encoreSetlist.map((ss, index) => renderSetlistItem(ss, index, 'encore'))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <PerformanceItemSelector
        open={showPerformanceSelector}
        onClose={() => setShowPerformanceSelector(false)}
        onSelect={(item) => addPerformanceItemMutation.mutate(item)}
        userSkills={userSkills || {}}
        userGenres={band?.genre ? [band.genre] : []}
      />
    </>
  );
};
