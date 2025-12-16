import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Trophy, Music, Radio, Video } from "lucide-react";
import { SongPlayer } from "@/components/audio/SongPlayer";

interface MyChartPositionsProps {
  userId: string;
}

export function MyChartPositions({ userId }: MyChartPositionsProps) {
  const { data: chartPositions, isLoading } = useQuery({
    queryKey: ["my-chart-positions", userId],
    queryFn: async () => {
      // Get user's songs
      const { data: userSongs } = await supabase
        .from("songs")
        .select("id, title, audio_url, audio_generation_status")
        .eq("user_id", userId);

      if (!userSongs?.length) return [];

      const songIds = userSongs.map((s) => s.id);

      // Get chart entries for user's songs
      const { data: entries } = await supabase
        .from("chart_entries")
        .select("*")
        .in("song_id", songIds)
        .order("chart_date", { ascending: false });

      if (!entries?.length) return [];

      // Group by song and get latest position per chart type
      const songCharts: Record<string, any[]> = {};
      entries.forEach((entry) => {
        const key = `${entry.song_id}-${entry.chart_type}`;
        if (!songCharts[key]) {
          songCharts[key] = [];
        }
        songCharts[key].push(entry);
      });

      // Build result with song info
      const results: any[] = [];
      Object.entries(songCharts).forEach(([key, chartEntries]) => {
        const [songId] = key.split("-");
        const song = userSongs.find((s) => s.id === songId);
        const latest = chartEntries[0];
        const previous = chartEntries[1];

        results.push({
          songId,
          songTitle: song?.title || "Unknown",
          audioUrl: song?.audio_url,
          audioStatus: song?.audio_generation_status,
          chartType: latest.chart_type,
          rank: latest.rank,
          previousRank: previous?.rank || null,
          trend: latest.trend,
          trendChange: latest.trend_change,
          weeksOnChart: latest.weeks_on_chart,
          playsCount: latest.plays_count,
          chartDate: latest.chart_date,
        });
      });

      return results.sort((a, b) => a.rank - b.rank);
    },
    enabled: !!userId,
  });

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      case "new":
        return <Badge className="bg-primary text-xs">NEW</Badge>;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getChartIcon = (chartType: string) => {
    if (chartType.includes("radio")) return <Radio className="h-4 w-4" />;
    if (chartType.includes("video")) return <Video className="h-4 w-4" />;
    return <Music className="h-4 w-4" />;
  };

  const formatChartType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!chartPositions?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-lg font-medium">No Chart Positions Yet</p>
          <p className="text-sm text-muted-foreground">
            Release music, get radio airplay, and make music videos to chart!
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group by song
  const songGroups: Record<string, any[]> = {};
  chartPositions.forEach((pos) => {
    if (!songGroups[pos.songId]) {
      songGroups[pos.songId] = [];
    }
    songGroups[pos.songId].push(pos);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">My Chart Positions</h3>
        <Badge variant="outline">{chartPositions.length} chart entries</Badge>
      </div>

      {Object.entries(songGroups).map(([songId, positions]) => {
        const firstPos = positions[0];
        const highestRank = Math.min(...positions.map((p) => p.rank));

        return (
          <Card key={songId}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Music className="h-4 w-4" />
                    {firstPos.songTitle}
                  </CardTitle>
                  <CardDescription>
                    Highest position: #{highestRank}
                  </CardDescription>
                </div>
                {highestRank <= 10 && (
                  <Badge className="bg-amber-500">
                    <Trophy className="h-3 w-3 mr-1" />
                    Top 10
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Audio Player */}
              {(firstPos.audioUrl || firstPos.audioStatus) && (
                <SongPlayer
                  audioUrl={firstPos.audioUrl}
                  generationStatus={firstPos.audioStatus}
                  compact
                />
              )}

              <div className="grid gap-2">
                {positions.map((pos) => (
                  <div
                    key={`${pos.songId}-${pos.chartType}`}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {getChartIcon(pos.chartType)}
                      <div>
                        <p className="text-sm font-medium">{formatChartType(pos.chartType)}</p>
                        <p className="text-xs text-muted-foreground">
                          {pos.weeksOnChart || 1} week{(pos.weeksOnChart || 1) !== 1 ? "s" : ""} on chart
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {pos.previousRank && pos.previousRank !== pos.rank && (
                        <span className="text-xs text-muted-foreground">
                          was #{pos.previousRank}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        {getTrendIcon(pos.trend)}
                        {pos.trendChange > 0 && (
                          <span className="text-xs text-emerald-500">+{pos.trendChange}</span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-lg font-bold">
                        #{pos.rank}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
