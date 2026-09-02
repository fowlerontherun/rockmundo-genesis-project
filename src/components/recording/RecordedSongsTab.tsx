import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asAny } from "@/lib/type-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Music, Calendar, Star, Clock, Disc3, Volume2, Flame, Search, Filter, ArrowUpDown, AlertTriangle, Sparkles } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { SongPlayer } from "@/components/audio/SongPlayer";
import { SongShareButtons } from "@/components/audio/SongShareButtons";
import { ActiveRecordingDialog } from "@/components/recording/ActiveRecordingDialog";

interface RecordedSongsTabProps {
  userId: string;
  profileId?: string | null;
  bandId?: string | null;
}

type SortOption = "newest" | "oldest" | "quality_high" | "quality_low" | "hype" | "fame" | "title";

type RecordedSong = {
  id: string;
  title: string;
  genre: string | null;
  quality_score: number | null;
  updated_at: string;
  audio_url: string | null;
  audio_generation_status: string | null;
  hype: number | null;
  fame: number | null;
  bands: {
    name: string | null;
    artist_name: string | null;
  } | null;
};

type RecordingSessionSummary = {
  id: string;
  song_id: string | null;
  quality_improvement: number | null;
  completed_at: string | null;
  recording_version: string | null;
};

type ActiveRecordingSessionSummary = {
  recording_session_id: string;
};

const recordedSongSelect = `
  id, user_id, profile_id, band_id, title, genre, quality_score, status, updated_at, created_at, audio_url, audio_generation_status, hype, fame,
  bands(name, artist_name)
` as string;

export function RecordedSongsTab({ userId, profileId, bandId }: RecordedSongsTabProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [activeRecording, setActiveRecording] = useState<{ id: string; songTitle: string } | null>(null);

  const queryKey = ["recorded-songs-list", userId, profileId, bandId] as const;

  const { data: recordedSongs, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const songResponses = bandId
        ? [await supabase
            .from("songs")
            .select(recordedSongSelect)
            .eq("status", "recorded")
            .eq("band_id", bandId)
            .order("updated_at", { ascending: false })
            .limit(200)]
        : await Promise.all([
            profileId
              ? supabase
                  .from("songs")
                  .select(recordedSongSelect)
                  .eq("status", "recorded")
                  .eq("profile_id", profileId)
                  .is("band_id", null)
                  .order("updated_at", { ascending: false })
                  .limit(200)
              : Promise.resolve({ data: [] as RecordedSong[], error: null }),
            userId
              ? profileId
                ? supabase
                    .from("songs")
                    .select(recordedSongSelect)
                    .eq("status", "recorded")
                    .eq("user_id", userId)
                    .is("profile_id", null)
                    .is("band_id", null)
                    .order("updated_at", { ascending: false })
                    .limit(200)
                : supabase
                    .from("songs")
                    .select(recordedSongSelect)
                    .eq("status", "recorded")
                    .eq("user_id", userId)
                    .is("band_id", null)
                    .order("updated_at", { ascending: false })
                    .limit(200)
              : Promise.resolve({ data: [] as RecordedSong[], error: null }),
          ]);

      for (const response of songResponses) {
        if (response.error) throw response.error;
      }

      const songs = Array.from(
        new Map<string, RecordedSong>(
          songResponses
            .flatMap((response) => (response.data || []) as RecordedSong[])
            .map((song) => [song.id, song] as const),
        ).values(),
      ).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );

      const songIds = songs.map((song) => song.id);
      let sessions: RecordingSessionSummary[] = [];
      let polishedSessionIds = new Set<string>();

      if (songIds.length > 0) {
        const { data: sessionData, error: sessionsError } = await supabase
          .from("recording_sessions")
          .select(`
            id,
            song_id,
            status,
            quality_improvement,
            final_master_quality,
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
        sessions = (sessionData || []) as RecordingSessionSummary[];

        const sessionIds = sessions.map((session) => session.id);
        if (sessionIds.length > 0) {
          const { data: activeRows, error: activeRowsError } = await asAny(supabase)
            .from("active_recording_sessions")
            .select("recording_session_id")
            .in("recording_session_id", sessionIds);

          if (activeRowsError) throw activeRowsError;
          polishedSessionIds = new Set(
            ((activeRows || []) as ActiveRecordingSessionSummary[]).map((row) => row.recording_session_id),
          );
        }
      }

      return songs.map((song) => {
        const songRecordings = sessions.filter((session) => session.song_id === song.id);
        const totalQualityGained = songRecordings.reduce(
          (sum, recording) => sum + (recording.quality_improvement || 0),
          0,
        );
        const latestRecording = songRecordings[0]?.completed_at || song.updated_at;
        const eligibleActiveRecording = songRecordings.find(
          (recording) =>
            (recording.recording_version || "standard") === "standard" &&
            !polishedSessionIds.has(recording.id),
        ) || null;

        return {
          song,
          recordings: songRecordings,
          totalQualityGained,
          latestRecording,
          eligibleActiveRecording,
        };
      });
    },
    enabled: !!userId || !!profileId || !!bandId,
  });

  const availableGenres = useMemo(() => {
    if (!recordedSongs) return [];
    const genres = recordedSongs
      .map((item) => item.song.genre)
      .filter((genre): genre is string => Boolean(genre));
    return Array.from(new Set(genres)).sort();
  }, [recordedSongs]);

  const filteredSongs = useMemo(() => {
    if (!recordedSongs) return [];

    const filtered = recordedSongs.filter((item) => {
      const matchesSearch = !searchQuery.trim() ||
        item.song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.song.bands?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGenre = genreFilter === "all" || item.song.genre === genreFilter;
      return matchesSearch && matchesGenre;
    });

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

  if (error) {
    return (
      <div className="text-center py-12 space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <div>
          <p className="font-medium text-destructive">Could not load recorded songs</p>
          <p className="text-sm text-muted-foreground mt-2">
            {error instanceof Error ? error.message : "Please try again from the Recording Studio."}
          </p>
        </div>
      </div>
    );
  }

  if (!recordedSongs || recordedSongs.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <Disc3 className="h-12 w-12 text-muted-foreground mx-auto" />
        <div>
          <p className="text-muted-foreground font-medium">No recorded songs yet</p>
          <p className="text-sm text-muted-foreground mt-2">Start a new recording session to record your songs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or artist..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Select value={genreFilter} onValueChange={setGenreFilter}>
            <SelectTrigger className="w-full">
              <Filter className="h-4 w-4 mr-2 shrink-0" />
              <SelectValue placeholder="Genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genres</SelectItem>
              {availableGenres.map((genre) => (
                <SelectItem key={genre} value={genre}>{genre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-full">
              <ArrowUpDown className="h-4 w-4 mr-2 shrink-0" />
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
        {filteredSongs.length} of {recordedSongs.length} song{recordedSongs.length !== 1 ? "s" : ""} shown
      </div>

      <div className="grid gap-4 max-w-full">
        {filteredSongs.map((item) => {
          const hasAudio = item.song.audio_url && item.song.audio_generation_status === "completed";
          const artistName = item.song.bands?.artist_name || item.song.bands?.name || "Unknown Artist";

          return (
            <Card key={item.song.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Music className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="font-semibold break-words min-w-0">{item.song.title}</h3>
                      <Badge variant="secondary" className="text-xs">{item.song.genre}</Badge>
                      {hasAudio && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                          <Volume2 className="h-3 w-3 mr-1" />AI Audio
                        </Badge>
                      )}
                      {(item.song.hype || 0) > 0 && (
                        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-500 border-orange-500/20">
                          <Flame className="h-3 w-3 mr-1" />{item.song.hype} Hype
                        </Badge>
                      )}
                      {(item.song.fame || 0) > 0 && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/20">
                          <Star className="h-3 w-3 mr-1" />{item.song.fame} Fame
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Star className="h-3.5 w-3.5 text-yellow-500" />
                        <span>Quality: <span className="font-medium text-foreground">{item.song.quality_score || 0}</span></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Disc3 className="h-3.5 w-3.5" />
                        <span>{item.recordings.length} recording{item.recordings.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{format(new Date(item.latestRecording), "MMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatDistanceToNow(new Date(item.latestRecording))} ago</span>
                      </div>
                    </div>

                    {item.eligibleActiveRecording && (
                      <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium">Active Recording available</p>
                          <p className="text-xs text-muted-foreground">
                            Capture five keeper takes for a one-time polish of up to +2 quality.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => setActiveRecording({ id: item.eligibleActiveRecording.id, songTitle: item.song.title })}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Active Recording
                        </Button>
                      </div>
                    )}

                    {item.recordings.length > 1 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Recording history:</p>
                        <div className="flex flex-wrap gap-2">
                          {item.recordings.map((recording) => (
                            <Badge key={recording.id} variant="outline" className="text-xs">
                              {recording.recording_version || "Standard"}
                              {(recording.quality_improvement || 0) > 0 && (
                                <span className="ml-1 text-green-600">+{recording.quality_improvement}</span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasAudio && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
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

                  <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 lg:min-w-[96px] lg:flex-col lg:items-end lg:justify-start lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
                    <div className="text-left lg:text-right">
                      <div className="text-xl sm:text-2xl font-bold text-primary">{item.song.quality_score || 0}</div>
                      <div className="text-xs text-muted-foreground">Quality</div>
                    </div>
                    {item.totalQualityGained > 0 && (
                      <div className="text-xs text-green-600 lg:mt-1">+{item.totalQualityGained} total</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeRecording && (
        <ActiveRecordingDialog
          open
          onOpenChange={(open) => {
            if (!open) setActiveRecording(null);
          }}
          recordingSessionId={activeRecording.id}
          songTitle={activeRecording.songTitle}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey });
          }}
        />
      )}
    </div>
  );
}
