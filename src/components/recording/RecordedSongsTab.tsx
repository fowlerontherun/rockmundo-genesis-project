import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Music, Calendar, Star, Clock, Disc3 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface RecordedSongsTabProps {
  userId: string;
  bandId?: string | null;
}

export function RecordedSongsTab({ userId, bandId }: RecordedSongsTabProps) {
  const { data: recordedSongs, isLoading } = useQuery({
    queryKey: ["recorded-songs-list", userId, bandId],
    queryFn: async () => {
      // Get all songs with status = 'recorded' for this user
      const { data: songs, error: songsError } = await supabase
        .from("songs")
        .select("*")
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
      <div className="text-sm text-muted-foreground mb-4">
        {recordedSongs.length} song{recordedSongs.length !== 1 ? 's' : ''} recorded
      </div>

      <div className="grid gap-4">
        {recordedSongs.map((item) => (
          <Card key={item.song.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Music className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold truncate">{item.song.title}</h3>
                    <Badge variant="secondary">{item.song.genre}</Badge>
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
                        {item.recordings.map((rec: any, idx: number) => (
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
        ))}
      </div>
    </div>
  );
}
