import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Music,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
  Plus,
  Minus,
  GripVertical,
  ListMusic,
  Timer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Song {
  id: string;
  title: string;
  duration_seconds: number;
  energy_level?: number;
  genre?: string;
  familiarity_percentage?: number;
}

interface FestivalSetlistEditorProps {
  bandId: string;
  slotType: string;
  maxDurationMinutes: number;
  onSetlistChange?: (songs: string[]) => void;
  initialSongIds?: string[];
}

const SLOT_CONFIGS = {
  opening: { minSongs: 4, maxSongs: 6, staminaCost: 20 },
  support: { minSongs: 6, maxSongs: 8, staminaCost: 30 },
  main: { minSongs: 8, maxSongs: 12, staminaCost: 45 },
  headline: { minSongs: 12, maxSongs: 18, staminaCost: 60 },
};

export function FestivalSetlistEditor({
  bandId,
  slotType,
  maxDurationMinutes,
  onSetlistChange,
  initialSongIds = [],
}: FestivalSetlistEditorProps) {
  const [selectedSongs, setSelectedSongs] = useState<string[]>(initialSongIds);
  
  const config = SLOT_CONFIGS[slotType as keyof typeof SLOT_CONFIGS] || SLOT_CONFIGS.support;
  
  // Fetch band's songs
  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["band-songs-festival", bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("songs")
        .select("id, title, duration_seconds, genre")
        .eq("band_id", bandId)
        .eq("is_released", true)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Fetch familiarity data
      const { data: familiarityData } = await (supabase as any)
        .from("band_song_familiarity")
        .select("song_id, familiarity_percentage")
        .eq("band_id", bandId);
      
      const familiarityMap = new Map(
        (familiarityData || []).map((f: any) => [f.song_id, f.familiarity_percentage])
      );
      
      return (data || []).map(song => ({
        ...song,
        energy_level: Math.floor(Math.random() * 40) + 60, // Mock energy level
        familiarity_percentage: familiarityMap.get(song.id) || 0,
      })) as Song[];
    },
    enabled: !!bandId,
  });

  // Calculate setlist stats
  const selectedSongData = songs.filter(s => selectedSongs.includes(s.id));
  const totalDuration = selectedSongData.reduce((sum, s) => sum + (s.duration_seconds || 180), 0);
  const totalDurationMinutes = Math.round(totalDuration / 60);
  const avgEnergy = selectedSongData.length > 0
    ? Math.round(selectedSongData.reduce((sum, s) => sum + (s.energy_level || 70), 0) / selectedSongData.length)
    : 0;
  const avgFamiliarity = selectedSongData.length > 0
    ? Math.round(selectedSongData.reduce((sum, s) => sum + (s.familiarity_percentage || 0), 0) / selectedSongData.length)
    : 0;
  
  // Validation
  const isValidSongCount = selectedSongs.length >= config.minSongs && selectedSongs.length <= config.maxSongs;
  const isValidDuration = totalDurationMinutes <= maxDurationMinutes;
  const isValid = isValidSongCount && isValidDuration;
  
  // Estimated stamina usage
  const staminaUsage = config.staminaCost + (selectedSongs.length * 3);

  useEffect(() => {
    onSetlistChange?.(selectedSongs);
  }, [selectedSongs, onSetlistChange]);

  const toggleSong = (songId: string) => {
    setSelectedSongs(prev => 
      prev.includes(songId)
        ? prev.filter(id => id !== songId)
        : [...prev, songId]
    );
  };

  const moveSong = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedSongs.length) return;
    
    const newOrder = [...selectedSongs];
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    setSelectedSongs(newOrder);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading songs...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <ListMusic className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Songs</span>
              </div>
              <p className={cn(
                "font-bold",
                !isValidSongCount && "text-destructive"
              )}>
                {selectedSongs.length}/{config.minSongs}-{config.maxSongs}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Duration</span>
              </div>
              <p className={cn(
                "font-bold",
                !isValidDuration && "text-destructive"
              )}>
                {totalDurationMinutes}/{maxDurationMinutes} min
              </p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Avg Energy</span>
              </div>
              <p className="font-bold">{avgEnergy}%</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 mb-1">
                <Music className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Stamina</span>
              </div>
              <p className={cn(
                "font-bold",
                staminaUsage > 80 && "text-amber-500",
                staminaUsage > 100 && "text-destructive"
              )}>
                {staminaUsage}%
              </p>
            </div>
          </div>
          
          <Separator className="my-4" />
          
          {/* Validation Status */}
          <div className="flex items-center gap-2">
            {isValid ? (
              <Badge className="bg-green-500/10 text-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Setlist Valid
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {!isValidSongCount && `Need ${config.minSongs}-${config.maxSongs} songs`}
                {isValidSongCount && !isValidDuration && "Exceeds time limit"}
              </Badge>
            )}
            
            {avgFamiliarity < 50 && selectedSongs.length > 0 && (
              <Badge variant="outline" className="text-amber-500">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Low rehearsal ({avgFamiliarity}%)
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Selected Setlist */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListMusic className="h-4 w-4" />
              Festival Setlist ({selectedSongs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              {selectedSongs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Select songs from your catalog
                </p>
              ) : (
                <div className="divide-y">
                  {selectedSongs.map((songId, index) => {
                    const song = songs.find(s => s.id === songId);
                    if (!song) return null;
                    
                    return (
                      <div key={songId} className="flex items-center gap-2 p-2 hover:bg-muted/50">
                        <div className="flex flex-col gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => moveSong(index, "up")}
                            disabled={index === 0}
                          >
                            <span className="text-xs">▲</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5"
                            onClick={() => moveSong(index, "down")}
                            disabled={index === selectedSongs.length - 1}
                          >
                            <span className="text-xs">▼</span>
                          </Button>
                        </div>
                        <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{song.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDuration(song.duration_seconds || 180)}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive"
                          onClick={() => toggleSong(songId)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Available Songs */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Music className="h-4 w-4" />
              Available Songs ({songs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              {songs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No released songs available
                </p>
              ) : (
                <div className="divide-y">
                  {songs.filter(s => !selectedSongs.includes(s.id)).map((song) => (
                    <div key={song.id} className="flex items-center gap-3 p-2 hover:bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{song.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDuration(song.duration_seconds || 180)}</span>
                          {song.familiarity_percentage !== undefined && (
                            <>
                              <span>•</span>
                              <span className={cn(
                                (song.familiarity_percentage || 0) < 50 && "text-amber-500"
                              )}>
                                {song.familiarity_percentage}% rehearsed
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-12">
                          <Progress value={song.energy_level || 70} className="h-1" />
                        </div>
                        <Zap className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-primary"
                        onClick={() => toggleSong(song.id)}
                        disabled={selectedSongs.length >= config.maxSongs}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
