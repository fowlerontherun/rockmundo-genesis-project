import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";
import { Card, CardContent } from "@/components/ui/card";
import { SongFilters } from "@/components/songs/SongFilters";
import { SongCard } from "@/components/songs/SongCard";
import { SongDetailDialog } from "@/components/songs/SongDetailDialog";
import { Music, Sparkles } from "lucide-react";

const SongManager = () => {
  const { profile } = useGameData();
  const user = { id: profile?.user_id };
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date_desc");
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

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

  const availableGenres = useMemo(() => {
    if (!songs) return [];
    const genres = new Set(songs.map((song) => song.genre));
    return Array.from(genres).sort();
  }, [songs]);

  const filteredSongs = useMemo(() => {
    if (!songs) return [];

    let filtered = [...songs];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((song) =>
        song.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Genre filter
    if (genreFilter !== "all") {
      filtered = filtered.filter((song) => song.genre === genreFilter);
    }

    // Sort
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
  }, [songs, searchQuery, genreFilter, sortBy]);

  const stats = useMemo(() => {
    if (!songs) return { total: 0, avgQuality: 0, genres: 0 };

    const total = songs.length;
    const avgQuality = total > 0
      ? Math.round(songs.reduce((sum, s) => sum + (s.quality_score || 0), 0) / total)
      : 0;
    const genres = new Set(songs.map((s) => s.genre)).size;

    return { total, avgQuality, genres };
  }, [songs]);

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Music className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Song Manager</h1>
            <p className="text-muted-foreground">
              Manage your complete song catalog
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Songs</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary">
                {stats.avgQuality}
              </div>
              <div className="text-sm text-muted-foreground">
                Average Quality
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary">{stats.genres}</div>
              <div className="text-sm text-muted-foreground">Genres</div>
            </CardContent>
          </Card>
        </div>
      </div>

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

      {/* Song Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading your song catalog...
        </div>
      ) : filteredSongs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 text-center space-y-4">
            <Sparkles className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-lg">
                {songs && songs.length > 0
                  ? "No songs match your filters"
                  : "No songs yet"}
              </h3>
              <p className="text-sm text-muted-foreground mt-2">
                {songs && songs.length > 0
                  ? "Try adjusting your search or filters"
                  : "Create your first song in the Songwriting section"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            Showing {filteredSongs.length} of {songs?.length || 0} songs
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSongs.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                onViewDetails={setSelectedSongId}
              />
            ))}
          </div>
        </>
      )}

      {/* Detail Dialog */}
      <SongDetailDialog
        songId={selectedSongId}
        onClose={() => setSelectedSongId(null)}
      />
    </div>
  );
};

export default SongManager;
