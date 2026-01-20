import React, { useState, useMemo, useCallback } from "react";
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
import { Plus, GripVertical, Trash2, Music, Clock, Star, Sparkles, Guitar, Disc, ArrowUp, ArrowDown } from "lucide-react";
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface EnhancedSetlistSongManagerProps {
  setlistId: string;
  bandId: string;
  onClose: () => void;
}

interface SortableItemProps {
  id: string;
  item: any;
  index: number;
  section: 'main' | 'encore';
  encoreCount: number;
  onMoveToEncore: (id: string, itemType: string) => void;
  onMoveToMain: (id: string) => void;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  isFirst: boolean;
  isLast: boolean;
  isRemoving: boolean;
}

const SortableItem = ({ 
  id, 
  item, 
  index, 
  section, 
  encoreCount, 
  onMoveToEncore, 
  onMoveToMain, 
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  isRemoving
}: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isPerformanceItem = item.item_type === 'performance_item';
  const songVersion = item.songs?.version;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
    >
      <div 
        {...attributes} 
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium">{index + 1}.</span>
          <span className="font-medium truncate">
            {isPerformanceItem ? item.performance_items?.name : item.songs?.title || "Unknown"}
          </span>
          {isPerformanceItem && (
            <Badge variant="secondary" className="text-xs shrink-0">
              <Sparkles className="h-3 w-3 mr-1" />
              Performance
            </Badge>
          )}
          {!isPerformanceItem && songVersion && songVersion !== 'standard' && (
            <Badge variant="outline" className={`text-xs shrink-0 ${songVersion === 'acoustic' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20'}`}>
              {songVersion === 'acoustic' ? <Guitar className="h-3 w-3 mr-1" /> : <Disc className="h-3 w-3 mr-1" />}
              {songVersion === 'acoustic' ? 'Acoustic' : 'Remix'}
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground truncate">
          {isPerformanceItem 
            ? item.performance_items?.category?.replace('_', ' ')
            : `${item.songs?.genre} • Quality: ${item.songs?.quality_score || "N/A"}`
          }
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {/* Manual move buttons for mobile/accessibility */}
        <div className="flex flex-col gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onMoveUp(index)}
            disabled={isFirst}
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onMoveDown(index)}
            disabled={isLast}
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
        </div>
        {section === 'main' && encoreCount < 2 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMoveToEncore(item.id, item.item_type)}
            title="Move to encore"
          >
            <Star className="h-4 w-4" />
          </Button>
        )}
        {section === 'encore' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMoveToMain(item.id)}
          >
            Main
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(item.id)}
          disabled={isRemoving}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

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
  const reorderMutation = useReorderSetlistSongs();

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get user skills and genres for performance item filtering - cached
  const { data: userSkills } = useQuery({
    queryKey: ['user-skills'],
    queryFn: async () => {
      return {} as Record<string, number>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: band } = useQuery({
    queryKey: ['band-details', bandId],
    queryFn: async () => {
      const { data } = await supabase
        .from('bands')
        .select('genre')
        .eq('id', bandId)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const addPerformanceItemMutation = useMutation({
    mutationFn: async (item: PerformanceItem) => {
      const currentPerformanceItems = setlistSongs?.filter(s => s.item_type === 'performance_item') || [];
      if (currentPerformanceItems.length >= 5) {
        throw new Error('Maximum 5 performance items per setlist');
      }
      
      const { data: maxPositionData } = await supabase
        .from("setlist_songs")
        .select("position")
        .eq("setlist_id", setlistId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const nextPosition = Math.floor((maxPositionData?.position || 0) + 1);
      
      const { error } = await supabase
        .from("setlist_songs")
        .insert({
          setlist_id: setlistId,
          item_type: 'performance_item',
          performance_item_id: item.id,
          song_id: null,
          position: nextPosition,
          section: 'main',
        });
      
      if (error) throw error;
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
    mutationFn: async ({ setlistSongId }: { setlistSongId: string; itemType: string }) => {
      const { data: maxPositionData } = await supabase
        .from("setlist_songs")
        .select("position")
        .eq("setlist_id", setlistId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const nextPosition = Math.floor((maxPositionData?.position || 0) + 1);

      const { error } = await supabase
        .from("setlist_songs")
        .update({
          section: 'encore',
          position: nextPosition,
          is_encore: true
        })
        .eq("id", setlistSongId);
      
      if (error) throw error;
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
      const { data: maxPositionData } = await supabase
        .from("setlist_songs")
        .select("position")
        .eq("setlist_id", setlistId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const nextPosition = Math.floor((maxPositionData?.position || 0) + 1);

      const { error } = await supabase
        .from("setlist_songs")
        .update({
          section: 'main',
          position: nextPosition,
          is_encore: false
        })
        .eq("id", setlistSongId);
      
      if (error) throw error;
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

  // Optimized single query for available songs
  const { data: availableSongs, isLoading: songsLoading } = useQuery({
    queryKey: ["band-songs-optimized", bandId],
    queryFn: async () => {
      // Single optimized query using RPC or parallel queries
      const [bandSongsResult, bandMembersResult] = await Promise.all([
        supabase
          .from("songs")
          .select("id, title, genre, quality_score, duration_seconds, duration_display, status, band_id, user_id, version, parent_song_id")
          .eq("band_id", bandId)
          .eq("archived", false)
          .order("title"),
        supabase
          .from("band_members")
          .select("user_id")
          .eq("band_id", bandId)
      ]);

      if (bandSongsResult.error) throw bandSongsResult.error;
      
      const bandSongs = bandSongsResult.data || [];
      const bandMembers = bandMembersResult.data || [];
      
      if (bandMembers.length > 0) {
        const memberUserIds = bandMembers.map(m => m.user_id).filter(Boolean);
        
        if (memberUserIds.length > 0) {
          const { data: memberSongs } = await supabase
            .from("songs")
            .select("id, title, genre, quality_score, duration_seconds, duration_display, status, band_id, user_id, version, parent_song_id")
            .in("user_id", memberUserIds)
            .is("band_id", null)
            .eq("archived", false)
            .order("title");

          return [...bandSongs, ...(memberSongs || [])];
        }
      }

      return bandSongs;
    },
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    gcTime: 5 * 60 * 1000,
  });

  const filteredAvailableSongs = useMemo(() => {
    if (!availableSongs) return [];
    if (versionFilter === "all") return availableSongs;
    return availableSongs.filter(song => (song.version || 'standard') === versionFilter);
  }, [availableSongs, versionFilter]);

  const songsInSetlist = useMemo(() => new Set(
    (setlistSongs ?? [])
      .map((ss) => ss.song_id)
      .filter((id): id is string => Boolean(id))
  ), [setlistSongs]);

  const unaddedSongs = useMemo(() => 
    filteredAvailableSongs?.filter((song) => !songsInSetlist.has(song.id)) || [],
    [filteredAvailableSongs, songsInSetlist]
  );

  const handleAddSong = useCallback(() => {
    if (!selectedSongId) return;

    const maxPos = Math.max(0, ...(setlistSongs?.map(s => s.position || 0) || []));
    
    addSongMutation.mutate({
      setlistId,
      songId: selectedSongId,
      position: maxPos + 1,
      section: 'main',
      itemType: 'song',
    });
    
    setSelectedSongId("");
  }, [selectedSongId, setlistSongs, setlistId, addSongMutation]);

  const handleRemoveSong = useCallback((setlistSongId: string) => {
    removeSongMutation.mutate({ setlistId, setlistSongId });
  }, [removeSongMutation, setlistId]);

  const mainSetlist = useMemo(() => 
    (setlistSongs?.filter(s => s.section === 'main') || []).sort((a, b) => (a.position || 0) - (b.position || 0)),
    [setlistSongs]
  );
  
  const encoreSetlist = useMemo(() => 
    (setlistSongs?.filter(s => s.section === 'encore') || []).sort((a, b) => (a.position || 0) - (b.position || 0)),
    [setlistSongs]
  );

  const handleDragEnd = useCallback((event: DragEndEvent, section: 'main' | 'encore') => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const items = section === 'main' ? mainSetlist : encoreSetlist;
    const oldIndex = items.findIndex(item => item.id === active.id);
    const newIndex = items.findIndex(item => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedItems = arrayMove(items, oldIndex, newIndex);
      const updates = reorderedItems.map((item, index) => ({
        id: item.id,
        position: index + 1 + (section === 'encore' ? 1000 : 0), // Offset encore positions
      }));

      reorderMutation.mutate({ setlistId, songUpdates: updates });
    }
  }, [mainSetlist, encoreSetlist, setlistId, reorderMutation]);

  const handleMoveUp = useCallback((section: 'main' | 'encore', index: number) => {
    if (index === 0) return;
    const items = section === 'main' ? mainSetlist : encoreSetlist;
    const reorderedItems = arrayMove(items, index, index - 1);
    const updates = reorderedItems.map((item, idx) => ({
      id: item.id,
      position: idx + 1 + (section === 'encore' ? 1000 : 0),
    }));
    reorderMutation.mutate({ setlistId, songUpdates: updates });
  }, [mainSetlist, encoreSetlist, setlistId, reorderMutation]);

  const handleMoveDown = useCallback((section: 'main' | 'encore', index: number) => {
    const items = section === 'main' ? mainSetlist : encoreSetlist;
    if (index >= items.length - 1) return;
    const reorderedItems = arrayMove(items, index, index + 1);
    const updates = reorderedItems.map((item, idx) => ({
      id: item.id,
      position: idx + 1 + (section === 'encore' ? 1000 : 0),
    }));
    reorderMutation.mutate({ setlistId, songUpdates: updates });
  }, [mainSetlist, encoreSetlist, setlistId, reorderMutation]);
  
  const songCount = setlistSongs?.length || 0;
  const encoreCount = encoreSetlist.length;

  const totalDuration = useMemo(() => {
    if (!setlistSongs) return null;
    return calculateSetlistDuration(setlistSongs.map(ss => ({
      duration_seconds: ss.songs?.duration_seconds
    })));
  }, [setlistSongs]);

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Manage Setlist</DialogTitle>
            <DialogDescription>
              Drag items to reorder. Add songs and performance items. Move up to 2 items to encore.
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
                  <SelectValue placeholder={songsLoading ? "Loading songs..." : "Select a song to add..."} />
                </SelectTrigger>
                <SelectContent>
                  {songsLoading ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      Loading songs...
                    </div>
                  ) : unaddedSongs.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No songs available to add
                    </div>
                  ) : (
                    unaddedSongs.map((song) => (
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
                  Loading setlist...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Main Setlist */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Music className="h-4 w-4" />
                      Main Setlist ({mainSetlist.length} items)
                    </h3>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(event, 'main')}
                    >
                      <SortableContext
                        items={mainSetlist.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {mainSetlist.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              No items in main setlist yet
                            </div>
                          ) : (
                            mainSetlist.map((ss, index) => (
                              <SortableItem
                                key={ss.id}
                                id={ss.id}
                                item={ss}
                                index={index}
                                section="main"
                                encoreCount={encoreCount}
                                onMoveToEncore={(id, itemType) => moveToEncoreMutation.mutate({ setlistSongId: id, itemType })}
                                onMoveToMain={(id) => moveToMainMutation.mutate({ setlistSongId: id })}
                                onRemove={handleRemoveSong}
                                onMoveUp={(idx) => handleMoveUp('main', idx)}
                                onMoveDown={(idx) => handleMoveDown('main', idx)}
                                isFirst={index === 0}
                                isLast={index === mainSetlist.length - 1}
                                isRemoving={removeSongMutation.isPending}
                              />
                            ))
                          )}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>

                  {/* Encore Section */}
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Star className="h-4 w-4 fill-current" />
                      Encore ({encoreSetlist.length}/2 items)
                    </h3>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(event, 'encore')}
                    >
                      <SortableContext
                        items={encoreSetlist.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {encoreSetlist.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              Move items here for your encore performance
                            </div>
                          ) : (
                            encoreSetlist.map((ss, index) => (
                              <SortableItem
                                key={ss.id}
                                id={ss.id}
                                item={ss}
                                index={index}
                                section="encore"
                                encoreCount={encoreCount}
                                onMoveToEncore={(id, itemType) => moveToEncoreMutation.mutate({ setlistSongId: id, itemType })}
                                onMoveToMain={(id) => moveToMainMutation.mutate({ setlistSongId: id })}
                                onRemove={handleRemoveSong}
                                onMoveUp={(idx) => handleMoveUp('encore', idx)}
                                onMoveDown={(idx) => handleMoveDown('encore', idx)}
                                isFirst={index === 0}
                                isLast={index === encoreSetlist.length - 1}
                                isRemoving={removeSongMutation.isPending}
                              />
                            ))
                          )}
                        </div>
                      </SortableContext>
                    </DndContext>
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
