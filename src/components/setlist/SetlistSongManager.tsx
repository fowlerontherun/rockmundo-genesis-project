import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useSetlistSongs,
  useAddSetlistItem,
  useRemoveSetlistItem,
  SetlistSpecialItem,
  SetlistSong,
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Plus, GripVertical, Trash2, Music, Clock, Star, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { calculateSetlistDuration } from "@/utils/setlistDuration";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGameData } from "@/hooks/useGameData";

const toTitleCase = (value?: string | null) => {
  if (!value) return "this skill";
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

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
  const [specialSearch, setSpecialSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { skillProgress } = useGameData();
  const { data: setlistItems, isLoading } = useSetlistSongs(setlistId);
  const addItemMutation = useAddSetlistItem();
  const removeItemMutation = useRemoveSetlistItem();

  const toggleEncoreMutation = useMutation({
    mutationFn: async ({ entryId, isEncore }: { entryId: string; isEncore: boolean }) => {
      const { error } = await supabase
        .from("setlist_songs")
        .update({ is_encore: isEncore })
        .eq("id", entryId);

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
      const { data: bandSongs, error: bandError } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score, duration_seconds, duration_display")
        .eq("band_id", bandId)
        .in("status", ["draft", "recorded"])
        .order("title");

      if (bandError) throw bandError;

      const { data: bandMembers } = await supabase
        .from("band_members")
        .select("user_id")
        .eq("band_id", bandId);

      if (bandMembers && bandMembers.length > 0) {
        const memberUserIds = bandMembers.map((m) => m.user_id);
        const { data: memberSongs, error: memberError } = await supabase
          .from("songs")
          .select("id, title, genre, quality_score, duration_seconds, duration_display")
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

  const { data: specialItems } = useQuery<SetlistSpecialItem[]>({
    queryKey: ["setlist-special-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setlist_special_items")
        .select("*")
        .order("name");

      if (error) throw error;
      return (data || []) as SetlistSpecialItem[];
    },
  });

  const skillLevelMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!skillProgress) return map;

    for (const entry of skillProgress) {
      if (!entry?.skill_slug) continue;
      map.set(entry.skill_slug, entry.current_level ?? 0);
    }

    return map;
  }, [skillProgress]);

  const songEntries = useMemo(
    () => (setlistItems || []).filter((item) => item.item_type === "song"),
    [setlistItems]
  );
  const specialEntries = useMemo(
    () => (setlistItems || []).filter((item) => item.item_type === "special"),
    [setlistItems]
  );
  const encoreSongs = useMemo(
    () => songEntries.filter((item) => item.is_encore),
    [songEntries]
  );
  const mainSetSongs = useMemo(
    () => songEntries.filter((item) => !item.is_encore),
    [songEntries]
  );

  const addedSpecialItemIds = useMemo(() => {
    const ids = specialEntries
      .map((entry) => entry.special_item_id)
      .filter((id): id is string => Boolean(id));
    return new Set(ids);
  }, [specialEntries]);

  const songsInSetlist = useMemo(() => {
    const ids = songEntries
      .map((entry) => entry.song_id)
      .filter((id): id is string => Boolean(id));
    return new Set(ids);
  }, [songEntries]);

  const unaddedSongs = availableSongs?.filter((song) => !songsInSetlist.has(song.id));

  const genreQualityMap = useMemo(() => {
    const totals = new Map<string, { sum: number; count: number }>();
    (availableSongs || []).forEach((song) => {
      if (!song.genre) return;
      const quality = song.quality_score ?? 50;
      const entry = totals.get(song.genre) ?? { sum: 0, count: 0 };
      entry.sum += quality;
      entry.count += 1;
      totals.set(song.genre, entry);
    });

    const averages = new Map<string, number>();
    totals.forEach((value, key) => {
      averages.set(key, value.count > 0 ? value.sum / value.count : 0);
    });
    return averages;
  }, [availableSongs]);

  const specialItemMeta = useMemo(() => {
    const map = new Map<string, { rating: number; locked: boolean; requirementLabel: string }>();

    (specialItems || []).forEach((item) => {
      const requiredLevel = item.required_level ?? 1;
      let locked = false;
      let rating = item.base_rating ?? 50;
      let requirementLabel = "";

      if (item.item_type === "skill") {
        const level = item.skill_slug ? skillLevelMap.get(item.skill_slug) ?? 0 : 0;
        locked = level < requiredLevel;
        rating = Math.min(100, Math.round(rating + level * (item.scaling ?? 1)));
        requirementLabel = `Requires level ${requiredLevel} in ${toTitleCase(item.skill_slug)}`;
      } else {
        const genre = item.genre ?? "";
        const genreRating = genre ? genreQualityMap.get(genre) ?? 0 : 0;
        locked = genreRating <= 0;
        rating = Math.min(100, Math.round(rating + genreRating * (item.scaling ?? 1)));
        requirementLabel = genre
          ? `Perform songs in the ${genre} genre to unlock.`
          : "Perform matching genre songs to unlock.";
      }

      map.set(item.id, { rating, locked, requirementLabel });
    });

    return map;
  }, [specialItems, skillLevelMap, genreQualityMap]);

  const filteredSpecialItems = useMemo(() => {
    const term = specialSearch.trim().toLowerCase();

    return (specialItems || [])
      .filter((item) => {
        if (!term) return true;
        return (
          item.name.toLowerCase().includes(term) ||
          (item.description ?? "").toLowerCase().includes(term) ||
          (item.genre ?? "").toLowerCase().includes(term) ||
          (item.skill_slug ?? "").toLowerCase().includes(term)
        );
      })
      .map((item) => {
        const meta =
          specialItemMeta.get(item.id) ?? ({
            rating: item.base_rating ?? 50,
            locked: true,
            requirementLabel: "",
          } as const);

        return {
          ...item,
          rating: meta.rating,
          locked: meta.locked,
          requirementLabel: meta.requirementLabel,
          alreadyAdded: addedSpecialItemIds.has(item.id),
        };
      })
      .sort((a, b) => {
        if (a.locked !== b.locked) {
          return a.locked ? 1 : -1;
        }
        return b.rating - a.rating;
      });
  }, [specialItems, specialSearch, specialItemMeta, addedSpecialItemIds]);

  const totalEntries = setlistItems?.length ?? 0;
  const songCount = songEntries.length;
  const specialCount = specialEntries.length;
  const encoreCount = encoreSongs.length;
  const encoreLimitReached = encoreCount >= 2;

  const totalDuration = useMemo(() => {
    if (songEntries.length === 0) return null;
    return calculateSetlistDuration(
      songEntries.map((ss) => ({ duration_seconds: ss.songs?.duration_seconds }))
    );
  }, [songEntries]);

  const handleAddSong = useCallback(() => {
    if (!selectedSongId) return;

    addItemMutation.mutate({
      setlistId,
      itemType: "song",
      songId: selectedSongId,
      position: totalEntries + 1,
    });
    setSelectedSongId("");
  }, [selectedSongId, addItemMutation, setlistId, totalEntries]);

  const handleRemoveItem = useCallback(
    (entryId: string) => {
      removeItemMutation.mutate({ setlistId, entryId });
    },
    [removeItemMutation, setlistId]
  );

  const handleToggleEncore = useCallback(
    (entryId: string, nextEncore: boolean) => {
      if (nextEncore && encoreLimitReached) {
        toast({
          title: "Encore limit reached",
          description: "You can only mark two songs as encore.",
          variant: "destructive",
        });
        return;
      }

      toggleEncoreMutation.mutate({ entryId, isEncore: nextEncore });
    },
    [encoreLimitReached, toggleEncoreMutation, toast]
  );

  const handleAddSpecialItem = useCallback(
    (item: SetlistSpecialItem) => {
      const meta = specialItemMeta.get(item.id);

      if (addedSpecialItemIds.has(item.id)) {
        toast({
          title: "Already added",
          description: "This stage moment is already in the setlist.",
        });
        return;
      }

      if (meta?.locked) {
        toast({
          title: "Stage moment locked",
          description: meta.requirementLabel || "Meet the requirements to add this moment.",
          variant: "destructive",
        });
        return;
      }

      addItemMutation.mutate({
        setlistId,
        itemType: "special",
        specialItemId: item.id,
        position: totalEntries + 1,
      });
    },
    [addedSpecialItemIds, addItemMutation, setlistId, specialItemMeta, totalEntries, toast]
  );

  const renderSongRow = useCallback(
    (ss: SetlistSong) => {
      const disableEncore = !ss.is_encore && encoreLimitReached;
      const qualityScore = ss.songs?.quality_score;

      return (
        <div
          key={ss.id}
          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
            ss.is_encore ? "bg-primary/5 border-primary/30" : "bg-card hover:bg-accent"
          }`}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">#{ss.position}</span>
              <span className="font-medium">{ss.songs?.title || "Unknown Song"}</span>
              {ss.songs?.duration_display && (
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {ss.songs.duration_display}
                </Badge>
              )}
              {ss.is_encore && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  Encore
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {ss.songs?.genre || "Unknown genre"}
              {typeof qualityScore === "number" && ` • Quality: ${qualityScore}`}
            </div>
            {ss.notes && (
              <div className="text-xs text-muted-foreground">Note: {ss.notes}</div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Checkbox
                checked={!!ss.is_encore}
                onCheckedChange={(checked) => handleToggleEncore(ss.id, Boolean(checked))}
                disabled={toggleEncoreMutation.isPending || disableEncore}
              />
              Encore
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveItem(ss.id)}
              disabled={removeItemMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      );
    },
    [encoreLimitReached, handleRemoveItem, handleToggleEncore, removeItemMutation.isPending, toggleEncoreMutation.isPending]
  );

  const renderSpecialEntry = useCallback(
    (entry: SetlistSong) => {
      if (!entry.special_item) return null;
      const item = entry.special_item as SetlistSpecialItem;
      const meta = specialItemMeta.get(item.id);
      const rating = Math.round(meta?.rating ?? item.base_rating ?? 0);

      return (
        <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
          <Sparkles className="h-4 w-4 text-primary mt-1" />
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{item.name}</span>
              <Badge variant="outline">{item.item_type === "skill" ? "Skill" : "Genre"}</Badge>
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                <Star className="h-3 w-3" />
                {rating}
              </Badge>
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground">{item.description}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {item.item_type === "skill"
                ? `Linked skill: ${toTitleCase(item.skill_slug)}`
                : `Linked genre: ${item.genre}`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRemoveItem(entry.id)}
            disabled={removeItemMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    },
    [handleRemoveItem, removeItemMutation.isPending, specialItemMeta]
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Manage Setlist Flow</DialogTitle>
          <DialogDescription>
            Build your show with songs, encore highlights, and skill-driven stage moments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">
              {songCount} {songCount === 1 ? "song" : "songs"}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {specialCount} moments
            </Badge>
            {totalDuration && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {totalDuration.displayTime}
              </Badge>
            )}
            <Badge variant="secondary" className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {encoreCount}/2 encore
            </Badge>
            <span className="text-xs text-muted-foreground">
              Kids/Opening: 30min • Support: 45min • Headline: 75min
            </span>
          </div>

          <div className="flex flex-col gap-2 md:flex-row">
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
              disabled={!selectedSongId || addItemMutation.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Song
            </Button>
          </div>

          <div className="border rounded-md p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-sm uppercase text-muted-foreground">
                  Stage Moments & Breaks
                </h3>
                <p className="text-xs text-muted-foreground">
                  Unlock these by training skills or performing matching genres. Higher ratings scale with your expertise.
                </p>
              </div>
              <Badge variant="outline">{filteredSpecialItems.length} available</Badge>
            </div>
            <Input
              value={specialSearch}
              onChange={(event) => setSpecialSearch(event.target.value)}
              placeholder="Search stage moments..."
            />
            <ScrollArea className="h-48 rounded-md border bg-background/60 p-2">
              {filteredSpecialItems.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {specialItems === undefined
                    ? "Loading stage moments..."
                    : "No stage moments match your search."}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSpecialItems.map((item) => {
                    const rating = Math.round(item.rating);
                    return (
                      <div key={item.id} className="flex items-start gap-3 rounded-md border bg-card p-3">
                        <Sparkles className="h-4 w-4 text-primary mt-1" />
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            <Badge variant="outline">{item.item_type === "skill" ? "Skill" : "Genre"}</Badge>
                            <Badge
                              variant={item.locked ? "secondary" : "default"}
                              className="flex items-center gap-1 text-xs"
                            >
                              <Star className="h-3 w-3" />
                              {rating}
                            </Badge>
                            {item.alreadyAdded && <Badge variant="secondary">Added</Badge>}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {item.item_type === "skill"
                              ? `Linked skill: ${toTitleCase(item.skill_slug)}`
                              : `Linked genre: ${item.genre}`}
                          </p>
                          {item.locked && (
                            <p className="text-xs text-destructive">{item.requirementLabel}</p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddSpecialItem(item)}
                          disabled={item.locked || item.alreadyAdded || addItemMutation.isPending}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          <ScrollArea className="h-[420px] rounded-md border">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground">Loading setlist...</div>
            ) : totalEntries === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <Music className="mx-auto h-12 w-12" />
                <p>Start building your show by adding songs or stage moments.</p>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm uppercase text-muted-foreground">Main Set</h3>
                    <span className="text-xs text-muted-foreground">{mainSetSongs.length} songs</span>
                  </div>
                  {mainSetSongs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No main set songs yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {mainSetSongs.map((ss) => renderSongRow(ss))}
                    </div>
                  )}
                </div>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm uppercase text-muted-foreground">Encore</h3>
                    <span className="text-xs text-muted-foreground">{encoreCount}/2 songs</span>
                  </div>
                  {encoreSongs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Select up to two songs for the encore.</p>
                  ) : (
                    <div className="space-y-2">
                      {encoreSongs.map((ss) => renderSongRow(ss))}
                    </div>
                  )}
                </div>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm uppercase text-muted-foreground">Stage Moments</h3>
                    <span className="text-xs text-muted-foreground">{specialEntries.length} added</span>
                  </div>
                  {specialEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No stage moments added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {specialEntries.map((entry) => renderSpecialEntry(entry))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
