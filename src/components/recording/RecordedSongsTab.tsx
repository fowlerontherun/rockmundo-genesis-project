import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Music, Calendar, Star, Clock, Disc3, Volume2, Flame, Search, Filter, ArrowUpDown } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { SongPlayer } from "@/components/audio/SongPlayer";
import { SongShareButtons } from "@/components/audio/SongShareButtons";

interface RecordedSongsTabProps {
  userId: string;
  bandId?: string | null;
}

type SortOption = "newest" | "oldest" | "quality_high" | "quality_low" | "hype" | "fame" | "title";

export function RecordedSongsTab({ userId, bandId }: RecordedSongsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  const { data: recordedSongs, isLoading } = useQuery({
    queryKey: ["recorded-songs-list", userId, bandId],
    queryFn: async () => {
      // Get all songs with status = 'recorded' for this user
      const { data: songs, error: songsError } = await supabase
        .from("songs")
        .select("*, bands(name, artist_name)")
        .eq("user_id", userId)
        .eq("status", "recorded")
        .order("updated_at", { ascending: false });

      if (songsError) throw songsError;

      // Get recording sessions for these songs
      const songIds = songs?.map(s => s.id) || [];
      let sessions: any[] = [];

      if (songIds.length > 0) {
        const { data: sessionData, error: sessionsError } = await supabase
          .from("recording_sessions")
          .select(`
            id,
            song_id,
            status,
            quality_improvement,
            completed_at,
            created_at,
            duration_hours,
            total_cost,
            recording_version,
            city_studios (name),
            recording_producers (name)
          `)
          .in("song_id", songIds)
          .eq("status", "completed")
          .order("completed_at", { ascending: false });

        if (sessionsError) throw sessionsError;
        sessions = sessionData || [];
      }

      // Build result combining songs with their recording history
      return songs?.map(song => {
        const songRecordings = sessions.filter(s => s.song_id === song.id);
        const totalQualityGained = songRecordings.reduce((sum, r) => sum + (r.quality_improvement || 0), 0);
        const latestRecording = songRecordings[0]?.completed_at || song.updated_at;

        return {
          song,
          recordings: songRecordings,
          totalQualityGained,
          latestRecording
        };
      }) || [];
    },
    enabled: !!userId
  });

  // Extract unique genres for filter dropdown
  const availableGenres = useMemo(() => {
    if (!recordedSongs) return [];
    const genres = new Set(recordedSongs.map(item => item.song.genre).filter(Boolean));
    return Array.from(genres).sort();
  }, [recordedSongs]);

  // Filter and sort songs
  const filteredSongs = useMemo(() => {
    if (!recordedSongs) return [];

    let filtered = [...recordedSongs];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.song.title.toLowerCase().includes(query) ||
        (item.song.bands?.name || "").toLowerCase().includes(query)
      );
    }

    // Genre filter
    if (genreFilter !== "all") {
      filtered = filtered.filter(item => item.song.genre === genreFilter);
    }

    // Sort
    switch (sortBy) {
      case "newest":
        filtered.sort((a, b) => new Date(b.latestRecording).getTime() - new Date(a.latestRecording).getTime());
        break;
      case "oldest":
        filtered.sort((a, b) => new Date(a.latestRecording).getTime() - new Date(b.latestRecording).getTime());
        break;
      case "quality_high":
        filtered.sort((a, b) => (b.song.quality_score || 0) - (a.song.quality_score || 0));
        break;
      case "quality_low":
        filtered.sort((a, b) => (a.song.quality_score || 0) - (b.song.quality_score || 0));
        break;
      case "hype":
        filtered.sort((a, b) => (b.song.hype || 0) - (a.song.hype || 0));
        break;
      case "fame":
        filtered.sort((a, b) => (b.song.fame || 0) - (a.song.fame || 0));
        break;
      case "title":
        filtered.sort((a, b) => a.song.title.localeCompare(b.song.title));
        break;
    }

    return filtered;
  }, [recordedSongs, searchQuery, genreFilter, sortBy]);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading recorded songs...</div>;
  }

  if (!recordedSongs || recordedSongs.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <Disc3 className="h-12 w-12 text-muted-foreground mx-auto" />
        <div>
          <p className="text-muted-foreground font-medium">No recorded songs yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Start a new recording session to record your songs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or artist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={genreFilter} onValueChange={setGenreFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genres</SelectItem>
              {availableGenres.map(genre => (
                <SelectItem key={genre} value={genre}>{genre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[160px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="quality_high">Quality (High)</SelectItem>
              <SelectItem value="quality_low">Quality (Low)</SelectItem>
              <SelectItem value="hype">Most Hype</SelectItem>
              <SelectItem value="fame">Most Fame</SelectItem>
              <SelectItem value="title">Title A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {filteredSongs.length} of {recordedSongs.length} song{recordedSongs.length !== 1 ? 's' : ''} shown
      </div>

      <div className="grid gap-4">
        {filteredSongs.map((item) => {
          const hasAudio = item.song.audio_url && item.song.audio_generation_status === 'completed';
          const artistName = item.song.bands?.artist_name || item.song.bands?.name || 'Unknown Artist';
          
          return (
            <Card key={item.song.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Music className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold truncate">{item.song.title}</h3>
                      <Badge variant="secondary" className="text-xs">{item.song.genre}</Badge>
                      {hasAudio && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                          <Volume2 className="h-3 w-3 mr-1" />
                          AI Audio
                        </Badge>
                      )}
                      {(item.song.hype || 0) > 0 && (
                        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20">
                          <Flame className="h-3 w-3 mr-1" />
                          {item.song.hype} Hype
                        </Badge>
                      )}
                      {(item.song.fame || 0) > 0 && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
                          <Star className="h-3 w-3 mr-1" />
                          {item.song.fame} Fame
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Star className="h-3.5 w-3.5 text-yellow-500" />
                        <span>Quality: <span className="font-medium text-foreground">{item.song.quality_score || 0}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Disc3 className="h-3.5 w-3.5" />
                        <span>{item.recordings.length} recording{item.recordings.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{format(new Date(item.latestRecording), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatDistanceToNow(new Date(item.latestRecording))} ago</span>
                      </div>
                    </div>

                    {/* Recording versions */}
                    {item.recordings.length > 1 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Recording history:</p>
                        <div className="flex flex-wrap gap-2">
                          {item.recordings.map((rec: any) => (
                            <Badge key={rec.id} variant="outline" className="text-xs">
                              {rec.recording_version || 'Standard'}
                              {rec.quality_improvement > 0 && (
                                <span className="ml-1 text-green-600">+{rec.quality_improvement}</span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Audio Player & Share for AI-generated songs */}
                    {hasAudio && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Listen & Share:</p>
                          <SongShareButtons 
                            songId={item.song.id}
                            songTitle={item.song.title}
                            artistName={artistName}
                            audioUrl={item.song.audio_url}
                            compact
                          />
                        </div>
                        <SongPlayer
                          audioUrl={item.song.audio_url}
                          title={item.song.title}
                          artist={artistName}
                          compact
                          showShare={false}
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">{item.song.quality_score || 0}</div>
                    <div className="text-xs text-muted-foreground">Quality</div>
                    {item.totalQualityGained > 0 && (
                      <div className="text-xs text-green-600 mt-1">
                        +{item.totalQualityGained} total
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}