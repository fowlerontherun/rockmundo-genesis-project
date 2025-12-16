import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Music, Disc, Mic2, Radio, TrendingUp, Play } from "lucide-react";

export function MusicStats() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["music-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get songs written
      const { count: songsWritten } = await supabase
        .from("songs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Get songs recorded
      const { count: songsRecorded } = await supabase
        .from("recording_sessions")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      // Get releases
      const { data: releases } = await supabase
        .from("releases")
        .select("id, release_type, release_status")
        .eq("release_status", "released");

      const releasesCount = releases?.length || 0;
      const albumCount = releases?.filter(r => r.release_type === "album").length || 0;
      const singleCount = releases?.filter(r => r.release_type === "single").length || 0;

      // Get chart entries
      const { data: chartEntries } = await supabase
        .from("chart_entries")
        .select("rank, songs!inner(user_id)")
        .eq("songs.user_id", user.id);

      const chartAppearances = chartEntries?.length || 0;
      const highestRank = chartEntries?.length
        ? Math.min(...chartEntries.map(e => e.rank))
        : 0;

      // Get total streams
      const { data: streamData } = await supabase
        .from("streaming_analytics_daily")
        .select("stream_count");

      const totalStreams = streamData?.reduce((sum, s) => sum + ((s as any).stream_count || 0), 0) || 0;

      // Get radio plays
      const { data: radioData } = await supabase
        .from("radio_plays")
        .select("plays");

      const totalRadioPlays = radioData?.reduce((sum, r) => sum + ((r as any).plays || 0), 0) || 0;

      return {
        songsWritten: songsWritten || 0,
        songsRecorded: songsRecorded || 0,
        releasesCount,
        albumCount,
        singleCount,
        chartAppearances,
        highestRank,
        totalStreams,
        totalRadioPlays,
      };
    },
    enabled: !!user?.id,
  });

  if (!stats) return <div>Loading music stats...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Music className="h-4 w-4 text-muted-foreground" />
              Songs Written
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.songsWritten}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mic2 className="h-4 w-4 text-muted-foreground" />
              Songs Recorded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.songsRecorded}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Disc className="h-4 w-4 text-muted-foreground" />
              Releases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.releasesCount}</p>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-xs">{stats.albumCount} albums</Badge>
              <Badge variant="outline" className="text-xs">{stats.singleCount} singles</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Chart Appearances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.chartAppearances}</p>
            {stats.highestRank > 0 && (
              <p className="text-xs text-muted-foreground">Highest: #{stats.highestRank}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Play className="h-4 w-4 text-muted-foreground" />
              Total Streams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalStreams.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Radio className="h-4 w-4 text-muted-foreground" />
              Radio Plays
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalRadioPlays.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
