import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SongFilters } from "@/components/songs/SongFilters";
import { SongDetailDialog } from "@/components/songs/SongDetailDialog";
import { Music, ArrowLeft, Star, Calendar, Music2, Archive, Headphones, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { SongArchiveButton } from "@/components/song/SongArchiveButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SongPlayer } from "@/components/audio/SongPlayer";

const SongManager = () => {
  const navigate = useNavigate();
  const { profile } = useGameData();
  const user = { id: profile?.user_id };
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: songs, isLoading } = useQuery({
    queryKey: ["user-songs", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("songs")
        .select(`
          *,
          bands (
            name,
            genre
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch rehearsal levels for songs
  const { data: rehearsalData } = useQuery({
    queryKey: ["song-rehearsals", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: bandMembers } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", user.id);

      if (!bandMembers || bandMembers.length === 0) return [];

      const bandIds = bandMembers.map(bm => bm.band_id);

      const { data, error } = await supabase
        .from("band_song_familiarity")
        .select("song_id, familiarity_percentage, familiarity_minutes, last_rehearsed_at")
        .in("band_id", bandIds);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const availableGenres = useMemo(() => {
    if (!songs) return [];
    const genres = new Set(songs.map((song) => song.genre));
    return Array.from(genres).sort();
  }, [songs]);

  const filteredSongs = useMemo(() => {
    if (!songs) return [];

    let filtered = [...songs];

    // Filter by archived status
    filtered = filtered.filter((song) => 
      showArchived ? song.archived === true : song.archived !== true
    );

    if (searchQuery) {
      filtered = filtered.filter((song) =>
        song.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (genreFilter !== "all") {
      filtered = filtered.filter((song) => song.genre === genreFilter);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "date_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "quality_desc":
          return (b.quality_score || 0) - (a.quality_score || 0);
        case "quality_asc":
          return (a.quality_score || 0) - (b.quality_score || 0);
        case "title_asc":
          return a.title.localeCompare(b.title);
        case "title_desc":
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    return filtered;
  }, [songs, searchQuery, genreFilter, sortBy, showArchived]);

  const stats = useMemo(() => {
    if (!songs) return { total: 0, avgQuality: 0, genres: 0 };

    const total = songs.length;
    const avgQuality = total > 0
      ? Math.round(songs.reduce((sum, s) => sum + (s.quality_score || 0), 0) / total)
      : 0;
    const genres = new Set(songs.map((s) => s.genre)).size;

    return { total, avgQuality, genres };
  }, [songs]);

  const getRehearsalLevel = (songId: string) => {
    if (!rehearsalData) return null;
    return rehearsalData.find(r => r.song_id === songId);
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/music")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Music Hub
        </Button>
        
        <div className="flex items-center gap-3">
          <Music className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Song Catalog</h1>
            <p className="text-muted-foreground">
              All your songs with rehearsal status
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Songs</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Quality</p>
                <p className="text-2xl font-bold">{stats.avgQuality}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Music2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Genres</p>
                <p className="text-2xl font-bold">{stats.genres}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Archive Toggle */}
      <Tabs defaultValue="active" className="w-full" onValueChange={(v) => setShowArchived(v === "archived")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="active">
            Active Songs ({songs?.filter(s => !s.archived).length || 0})
          </TabsTrigger>
          <TabsTrigger value="archived">
            <Archive className="h-4 w-4 mr-2" />
            Archived ({songs?.filter(s => s.archived).length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {/* Filters */}
          <SongFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            genreFilter={genreFilter}
            onGenreChange={setGenreFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            availableGenres={availableGenres}
          />
        </TabsContent>

        <TabsContent value="archived" className="space-y-6">
          {/* Filters */}
          <SongFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            genreFilter={genreFilter}
            onGenreChange={setGenreFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            availableGenres={availableGenres}
          />
        </TabsContent>
      </Tabs>

      {/* Songs Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading your song catalog...
        </div>
      ) : filteredSongs.length === 0 ? (
        <Card className="p-12 text-center">
          <Music className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No songs found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || genreFilter !== "all"
              ? "Try adjusting your filters"
              : "Start creating songs to see them here"}
          </p>
          <Button onClick={() => navigate("/songwriting")}>
            Create Song
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSongs.map((song) => {
            const rehearsal = getRehearsalLevel(song.id);
            return (
              <Card 
                key={song.id} 
                className="p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => setSelectedSongId(song.id)}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{song.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {song.bands?.name || "Solo"}
                      </p>
                    </div>
                    <Badge variant="secondary">{song.genre}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500" />
                      <span>Quality: {song.quality_score || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Music2 className="h-3 w-3" />
                      <span>
                        {rehearsal 
                          ? `${rehearsal.familiarity_percentage}% rehearsed`
                          : "Not rehearsed"
                        }
                      </span>
                    </div>
                    {(song.hype || 0) > 0 && (
                      <div className="flex items-center gap-1">
                        <Flame className="h-3 w-3 text-orange-500" />
                        <span className="text-orange-500">{song.hype} Hype</span>
                      </div>
                    )}
                    {(song.fame || 0) > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-purple-500" />
                        <span className="text-purple-500">{song.fame} Fame</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 col-span-2">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(song.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>

                  {rehearsal && (
                    <div className="pt-2 border-t">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Rehearsal Progress</span>
                        <span className="font-medium">{rehearsal.familiarity_percentage}%</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${rehearsal.familiarity_percentage}%` }}
                        />
                      </div>
                      {rehearsal.last_rehearsed_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last: {format(new Date(rehearsal.last_rehearsed_at), "MMM d")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Audio Player Preview */}
                  {(song.audio_url || song.audio_generation_status) && (
                    <div className="pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2 mb-2">
                        <Headphones className="h-3 w-3 text-primary" />
                        <span className="text-xs text-muted-foreground">Audio Available</span>
                      </div>
                      <SongPlayer
                        audioUrl={song.audio_url}
                        generationStatus={song.audio_generation_status}
                        compact
                      />
                    </div>
                  )}

                  {song.catalog_status && (
                    <Badge variant="outline" className="text-xs">
                      {song.catalog_status}
                    </Badge>
                  )}

                  {/* Archive Button */}
                  <div className="pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                    <SongArchiveButton 
                      songId={song.id} 
                      isArchived={song.archived || false}
                      variant="ghost"
                      size="sm"
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Song Detail Dialog */}
      {selectedSongId && (
        <SongDetailDialog
          songId={selectedSongId}
          onClose={() => setSelectedSongId(null)}
        />
      )}
    </div>
  );
};

export default SongManager;
