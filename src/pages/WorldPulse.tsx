import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { format, getISOWeek } from "date-fns";
import {
  TrendingUp,
  Trophy,
  Calendar,
  Star,
  Play,
  Crown,
  Award,
  Zap,
  ChevronLeft,
  ChevronRight,
  Loader2
} from "lucide-react";

interface ChartEntry {
  rank: number;
  title: string;
  artist: string;
  band: string;
  genre: string;
  plays: number;
  popularity: number;
  trend: "up" | "down" | "same";
  trendChange: number;
  weeksOnChart: number;
}

interface GenreStats {
  genre: string;
  totalPlays: number;
  totalSongs: number;
  avgPopularity: number;
  topSong: string;
  growth: number;
}

type GlobalChartRow = Database["public"]["Tables"]["global_charts"]["Row"];
type SongRow = Database["public"]["Tables"]["songs"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const formatDailyValue = (dateString: string) => {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return dateString;
  }

  return format(parsed, "MMMM d, yyyy");
};

const formatWeekValue = (dateString: string) => {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return dateString;
  }

  const weekNumber = getISOWeek(parsed);
  return `Week ${weekNumber}, ${format(parsed, "yyyy")}`;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, value));
};

const WorldPulse = () => {
  const [dailyChart, setDailyChart] = useState<ChartEntry[]>([]);
  const [weeklyChart, setWeeklyChart] = useState<ChartEntry[]>([]);
  const [genreStats, setGenreStats] = useState<GenreStats[]>([]);
  const [currentWeek, setCurrentWeek] = useState("Loading charts...");
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [dailyLabel, setDailyLabel] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const enrichChartEntries = useCallback(async (rows: GlobalChartRow[]): Promise<ChartEntry[]> => {
    if (!rows.length) {
      return [];
    }

    const songIds = Array.from(new Set(rows.map((row) => row.song_id)));
    const { data: songsData, error: songsError } = await supabase
      .from("songs")
      .select("id, title, genre, quality_score, user_id")
      .in("id", songIds);

    if (songsError) {
      throw songsError;
    }

    const songsById = new Map<string, SongRow>();
    (songsData ?? []).forEach((song) => {
      songsById.set(song.id, song as SongRow);
    });

    const userIds = Array.from(
      new Set(
        (songsData ?? [])
          .map((song) => song.user_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const profilesByUserId = new Map<string, ProfileRow>();
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", userIds);

      if (profilesError) {
        throw profilesError;
      }

      (profilesData ?? []).forEach((profile) => {
        profilesByUserId.set(profile.user_id, profile as ProfileRow);
      });
    }

    const maxStreams = rows.reduce((max, row) => Math.max(max, row.total_streams ?? 0), 0);

    return rows
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((row) => {
        const song = songsById.get(row.song_id);
        const profile = song ? profilesByUserId.get(song.user_id) : undefined;

        const streams = row.total_streams ?? 0;
        const streamScore = maxStreams > 0 ? Math.round((streams / maxStreams) * 100) : 0;
        const qualityScore = song?.quality_score ?? 50;
        const popularity = clamp(Math.round(0.6 * streamScore + 0.4 * qualityScore), 0, 100);
        const trendValue: ChartEntry["trend"] =
          row.trend === "up" || row.trend === "down" || row.trend === "same" ? row.trend : "same";

        return {
          rank: row.rank,
          title: song?.title ?? "Unknown Song",
          artist: profile?.display_name || profile?.username || "Unknown Artist",
          band: "Independent",
          genre: song?.genre ?? "Unknown",
          plays: streams,
          popularity,
          trend: trendValue,
          trendChange: row.trend_change ?? 0,
          weeksOnChart: row.weeks_on_chart ?? 1
        };
      });
  }, []);

  const loadDailyChart = useCallback(async () => {
    try {
      const { data: latestDateRows, error: latestDateError } = await supabase
        .from("global_charts")
        .select("chart_date")
        .eq("chart_type", "daily")
        .order("chart_date", { ascending: false })
        .limit(1);

      if (latestDateError) {
        throw latestDateError;
      }

      const latestDate = latestDateRows?.[0]?.chart_date;
      if (!latestDate) {
        setDailyChart([]);
        setDailyLabel("");
        return;
      }

      setDailyLabel(formatDailyValue(latestDate));

      const { data, error } = await supabase
        .from("global_charts")
        .select("*")
        .eq("chart_type", "daily")
        .eq("chart_date", latestDate)
        .order("rank", { ascending: true })
        .limit(100);

      if (error) {
        throw error;
      }

      const chartRows = (data ?? []) as GlobalChartRow[];
      const enriched = await enrichChartEntries(chartRows);
      setDailyChart(enriched.slice(0, 10));
    } catch (error) {
      console.error("Failed to load daily chart:", error);
      setDailyChart([]);
    }
  }, [enrichChartEntries]);

  const loadWeeklyChart = useCallback(async (weekDate: string) => {
    try {
      const { data, error } = await supabase
        .from("global_charts")
        .select("*")
        .eq("chart_type", "weekly")
        .eq("chart_date", weekDate)
        .order("rank", { ascending: true })
        .limit(100);

      if (error) {
        throw error;
      }

      const chartRows = (data ?? []) as GlobalChartRow[];
      const enriched = await enrichChartEntries(chartRows);
      setWeeklyChart(enriched.slice(0, 10));
    } catch (error) {
      console.error("Failed to load weekly chart:", error);
      setWeeklyChart([]);
    }
  }, [enrichChartEntries]);

  const loadAvailableWeeks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("global_charts")
        .select("chart_date")
        .eq("chart_type", "weekly")
        .order("chart_date", { ascending: false });

      if (error) {
        throw error;
      }

      const weeks = Array.from(
        new Set(
          (data ?? [])
            .map((row) => row.chart_date)
            .filter((value): value is string => Boolean(value))
        )
      );

      setAvailableWeeks(weeks);
      setCurrentWeekIndex(0);
    } catch (error) {
      console.error("Failed to load chart weeks:", error);
      setAvailableWeeks([]);
    }
  }, []);

  const loadGenreStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, genre, streams, quality_score");

      if (error) {
        throw error;
      }

      const songs = (data ?? []) as SongRow[];
      if (!songs.length) {
        setGenreStats([]);
        return;
      }

      const genreMap = new Map<
        string,
        {
          totalPlays: number;
          totalSongs: number;
          totalQuality: number;
          topSong: string;
          topStreams: number;
        }
      >();

      songs.forEach((song) => {
        const genre = song.genre ?? "Unknown";
        const current = genreMap.get(genre) ?? {
          totalPlays: 0,
          totalSongs: 0,
          totalQuality: 0,
          topSong: "—",
          topStreams: -1
        };

        const streams = song.streams ?? 0;
        current.totalPlays += streams;
        current.totalSongs += 1;
        current.totalQuality += song.quality_score ?? 0;

        if (streams > current.topStreams) {
          current.topStreams = streams;
          current.topSong = song.title ?? "Unknown Song";
        }

        genreMap.set(genre, current);
      });

      const stats = Array.from(genreMap.entries()).map(([genre, info]) => ({
        genre,
        totalPlays: info.totalPlays,
        totalSongs: info.totalSongs,
        avgPopularity: info.totalSongs > 0 ? Math.round(info.totalQuality / info.totalSongs) : 0,
        topSong: info.topSong,
        growth: 0
      }));

      const totalStreams = stats.reduce((sum, stat) => sum + stat.totalPlays, 0);
      const normalized = stats
        .map((stat) => ({
          ...stat,
          growth: totalStreams > 0 ? Number(((stat.totalPlays / totalStreams) * 100).toFixed(1)) : 0
        }))
        .sort((a, b) => b.totalPlays - a.totalPlays);

      setGenreStats(normalized);
    } catch (error) {
      console.error("Failed to load genre stats:", error);
      setGenreStats([]);
    }
  }, []);

  useEffect(() => {
    loadDailyChart();
    loadAvailableWeeks();
    loadGenreStats();
  }, [loadDailyChart, loadAvailableWeeks, loadGenreStats]);

  useEffect(() => {
    if (!availableWeeks.length) {
      setWeeklyChart([]);
      setCurrentWeek("No weekly data");
      return;
    }

    const safeIndex = Math.min(currentWeekIndex, availableWeeks.length - 1);
    if (safeIndex !== currentWeekIndex) {
      setCurrentWeekIndex(safeIndex);
      return;
    }

    const selectedWeek = availableWeeks[safeIndex];
    setCurrentWeek(formatWeekValue(selectedWeek));
    loadWeeklyChart(selectedWeek);
  }, [availableWeeks, currentWeekIndex, loadWeeklyChart]);

  const handleRefreshCharts = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { error } = await supabase.rpc("refresh_global_charts");
      if (error) {
        console.error("Failed to execute refresh_global_charts:", error);
      }

      await Promise.all([loadDailyChart(), loadAvailableWeeks(), loadGenreStats()]);
    } catch (error) {
      console.error("Failed to refresh charts:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePrevWeek = () => {
    setCurrentWeekIndex((prev) => {
      if (availableWeeks.length === 0) return prev;
      return Math.min(prev + 1, availableWeeks.length - 1);
    });
  };

  const handleNextWeek = () => {
    setCurrentWeekIndex((prev) => {
      if (availableWeeks.length === 0) return prev;
      return Math.max(prev - 1, 0);
    });
  };

  const selectedWeekDate = availableWeeks.length > 0 ? availableWeeks[currentWeekIndex] : null;
  const weekStartLabel = selectedWeekDate ? formatDailyValue(selectedWeekDate) : null;
  const isPrevDisabled = availableWeeks.length === 0 || currentWeekIndex >= availableWeeks.length - 1;
  const isNextDisabled = availableWeeks.length === 0 || currentWeekIndex === 0;

  const getTrendIcon = (trend: string, change: number) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend === 'down') return <TrendingUp className="h-4 w-4 text-destructive rotate-180" />;
    return <span className="h-4 w-4 text-muted-foreground">-</span>;
  };

  const getTrendColor = (trend: ChartEntry["trend"]) => {
    switch (trend) {
      case "up":
        return "text-success";
      case "down":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return <Crown className="h-4 w-4 text-yellow-500" />;
    }
    if (rank === 2) {
      return <Award className="h-4 w-4 text-gray-400" />;
    }
    if (rank === 3) {
      return <Award className="h-4 w-4 text-amber-600" />;
    }
    return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
  };

  const weeklyDescription = selectedWeek
    ? `Most popular songs for ${formatDateLabel(selectedWeek, "Week of ")}`
    : "Select a week to view rankings";
  const dailyDescription = getDailyLabel(latestDailyDate);
  const currentWeekLabel = getWeekLabel(selectedWeek);

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              World Pulse Charts
            </h1>
            <p className="text-muted-foreground">Global music trends and rankings</p>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/20">
              <Calendar className="h-3 w-3 mr-1" />
              {currentWeekLabel}
            </Badge>
            <Button
              variant="outline"
              className="border-primary/20 hover:bg-primary/10"
              onClick={handleRefreshCharts}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              {isRefreshing ? "Refreshing..." : "Refresh Charts"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="daily" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily">Daily Top 10</TabsTrigger>
            <TabsTrigger value="weekly">Weekly Top 10</TabsTrigger>
            <TabsTrigger value="genres">Genre Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Daily Chart - Top 10
                </CardTitle>
                <CardDescription>
                  {dailyLabel
                    ? `Most popular songs on ${dailyLabel}`
                    : "Most popular songs from the latest update"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dailyChart.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No daily chart data available yet. Try refreshing the charts once new streams roll in.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dailyChart.map((entry) => (
                      <div
                        key={`${entry.rank}-${entry.title}`}
                        className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center justify-center w-12">
                          {getRankBadge(entry.rank)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg truncate">{entry.title}</h3>
                            <Badge variant="outline" className="text-xs">
                              {entry.genre}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {entry.artist} • {entry.band}
                          </p>
                        </div>

                        <div className="text-right space-y-1">
                          <div className="flex items-center gap-2">
                            <Play className="h-3 w-3" />
                            <span className="font-mono text-sm">{entry.plays.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getTrendIcon(entry.trend, entry.trendChange)}
                            <span className={`text-sm ${getTrendColor(entry.trend)}`}>
                              {entry.trend === 'same' ? '—' : `${entry.trendChange > 0 ? '+' : ''}${entry.trendChange}`}
                            </span>
                          </div>
                        </div>

                        <div className="w-24">
                          <div className="text-xs text-muted-foreground mb-1">Popularity</div>
                          <Progress value={entry.popularity} className="h-2" />
                          <div className="text-xs text-right mt-1">{entry.popularity}%</div>
                        </div>

                        <div className="text-center text-xs text-muted-foreground">
                          <div>{entry.weeksOnChart}</div>
                          <div>weeks</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="weekly">
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-accent" />
                    Weekly Chart - Top 10
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/20 hover:bg-primary/10"
                      onClick={handlePrevWeek}
                      disabled={isPrevDisabled}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Prev
                    </Button>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {currentWeek}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/20 hover:bg-primary/10"
                      onClick={handleNextWeek}
                      disabled={isNextDisabled}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  {selectedWeekDate
                    ? `Most popular songs for ${currentWeek}${weekStartLabel ? ` (week of ${weekStartLabel})` : ''}`
                    : "Most popular songs this week"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {weeklyChart.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No weekly chart data available yet. Keep releasing music to enter the global rankings.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {weeklyChart.map((entry) => (
                      <div
                        key={`${entry.rank}-${entry.title}`}
                        className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center justify-center w-12">
                          {getRankBadge(entry.rank)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg truncate">{entry.title}</h3>
                            <Badge variant="outline" className="text-xs">
                              {entry.genre}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {entry.artist} • {entry.band}
                          </p>
                        </div>

                        <div className="text-right space-y-1">
                          <div className="flex items-center gap-2">
                            <Play className="h-3 w-3" />
                            <span className="font-mono text-sm">{entry.plays.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getTrendIcon(entry.trend, entry.trendChange)}
                            <span className={`text-sm ${getTrendColor(entry.trend)}`}>
                              {entry.trend === 'same' ? '—' : `${entry.trendChange > 0 ? '+' : ''}${entry.trendChange}`}
                            </span>
                          </div>
                        </div>

                        <div className="w-24">
                          <div className="text-xs text-muted-foreground mb-1">Popularity</div>
                          <Progress value={entry.popularity} className="h-2" />
                          <div className="text-xs text-right mt-1">{entry.popularity}%</div>
                        </div>

                        <div className="text-center text-xs text-muted-foreground">
                          <div>{entry.weeksOnChart}</div>
                          <div>weeks</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="genres">
            {genreStats.length === 0 ? (
              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Genre insights will appear once your catalog starts generating streams and fans.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {genreStats.map((genre) => (
                  <Card key={genre.genre} className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{genre.genre}</span>
                        <Badge
                          variant={genre.growth > 10 ? "default" : "secondary"}
                          className={genre.growth > 10 ? "bg-gradient-primary" : ""}
                        >
                          {genre.growth > 0 ? '+' : ''}{genre.growth.toFixed(1)}%

                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-primary">
                            {genre.totalPlays.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">Total Plays</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-accent">
                            {genre.totalSongs}
                          </div>
                          <div className="text-xs text-muted-foreground">Songs</div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Avg Popularity</span>
                          <span>{genre.avgPopularity}%</span>
                        </div>
                        <Progress value={genre.avgPopularity} className="h-2" />
                      </div>

                      <div className="pt-2 border-t border-border/50">
                        <div className="text-xs text-muted-foreground mb-1">Top Song</div>
                        <div className="font-medium text-sm">{genre.topSong}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WorldPulse;
