import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  Trophy,
  Calendar,
  Star,
  Play,
  Crown,
  Award,
  Zap,
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
type GenreStatisticRow = Database["public"]["Tables"]["genre_statistics"]["Row"];

const parseNumeric = (value: number | string | null | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const clampPercentage = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
};

const toTrend = (value: string | null): ChartEntry["trend"] => {
  if (value === "up" || value === "down" || value === "same") {
    return value;
  }
  return "same";
};

const mapGlobalChartRow = (row: GlobalChartRow): ChartEntry => ({
  rank: row.rank ?? 0,
  title: row.song_title ?? "Unknown Track",
  artist: row.artist_name ?? "Unknown Artist",
  band: row.band_name ?? "—",
  genre: row.genre ?? "Unknown",
  plays: parseNumeric(row.plays),
  popularity: clampPercentage(parseNumeric(row.popularity)),
  trend: toTrend(row.trend ?? "same"),
  trendChange: row.trend_change ?? 0,
  weeksOnChart: row.weeks_on_chart ?? 0
});

const mapGenreStatisticRow = (row: GenreStatisticRow): GenreStats => ({
  genre: row.genre,
  totalPlays: parseNumeric(row.total_plays),
  totalSongs: row.total_songs ?? 0,
  avgPopularity: clampPercentage(parseNumeric(row.avg_popularity)),
  topSong: row.top_song ?? "—",
  growth: parseNumeric(row.growth)
});

const formatDateLabel = (value: string, prefix?: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return prefix ? `${prefix}${value}` : value;
  }
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
  return prefix ? `${prefix}${formatted}` : formatted;
};

const getWeekLabel = (value: string | null) => {
  if (!value) {
    return "No weekly data";
  }
  return formatDateLabel(value, "Week of ");
};

const getDailyLabel = (value: string | null) => {
  if (!value) {
    return null;
  }
  return formatDateLabel(value);
};

const WorldPulse = () => {
  const [dailyChart, setDailyChart] = useState<ChartEntry[]>([]);
  const [weeklyChart, setWeeklyChart] = useState<ChartEntry[]>([]);
  const [genreStats, setGenreStats] = useState<GenreStats[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [latestDailyDate, setLatestDailyDate] = useState<string | null>(null);
  const [isDailyLoading, setIsDailyLoading] = useState(false);
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);
  const [isGenreLoading, setIsGenreLoading] = useState(false);
  const [isWeeksLoading, setIsWeeksLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadLatestDailyChart = useCallback(async () => {
    setIsDailyLoading(true);
    try {
      const { data: latestDateData, error: latestDateError } = await supabase
        .from("global_charts")
        .select("chart_date")
        .eq("chart_type", "daily")
        .order("chart_date", { ascending: false })
        .limit(1);

      if (latestDateError) {
        throw latestDateError;
      }

      const latestDate = latestDateData?.[0]?.chart_date ?? null;
      setLatestDailyDate(latestDate);

      if (!latestDate) {
        setDailyChart([]);
        return;
      }

      const { data, error: dailyError } = await supabase
        .from("global_charts")
        .select("*")
        .eq("chart_type", "daily")
        .eq("chart_date", latestDate)
        .order("rank", { ascending: true });

      if (dailyError) {
        throw dailyError;
      }

      const rows = (data ?? []) as GlobalChartRow[];
      setDailyChart(rows.map(mapGlobalChartRow));
    } catch (dailyLoadError) {
      console.error("Failed to load daily chart:", dailyLoadError);
      setError("Unable to load daily charts right now.");
      setDailyChart([]);
      setLatestDailyDate(null);
    } finally {
      setIsDailyLoading(false);
    }
  }, []);

  const loadAvailableWeeks = useCallback(async () => {
    setIsWeeksLoading(true);
    try {
      const { data, error: weeksError } = await supabase
        .from("global_charts")
        .select("chart_date")
        .eq("chart_type", "weekly")
        .order("chart_date", { ascending: false })
        .limit(120);

      if (weeksError) {
        throw weeksError;
      }

      const weekDates = Array.from(
        new Set((data ?? []).map((row) => row.chart_date).filter((date): date is string => Boolean(date)))
      );

      setAvailableWeeks(weekDates);
      setSelectedWeek((prev) => {
        if (prev && weekDates.includes(prev)) {
          return prev;
        }
        return weekDates[0] ?? null;
      });
    } catch (weeksLoadError) {
      console.error("Failed to load available weeks:", weeksLoadError);
      setError("Unable to load weekly chart periods.");
      setAvailableWeeks([]);
      setSelectedWeek(null);
    } finally {
      setIsWeeksLoading(false);
    }
  }, []);

  const loadWeeklyChart = useCallback(async (week: string) => {
    setIsWeeklyLoading(true);
    try {
      const { data, error: weeklyError } = await supabase
        .from("global_charts")
        .select("*")
        .eq("chart_type", "weekly")
        .eq("chart_date", week)
        .order("rank", { ascending: true });

      if (weeklyError) {
        throw weeklyError;
      }

      const rows = (data ?? []) as GlobalChartRow[];
      setWeeklyChart(rows.map(mapGlobalChartRow));
    } catch (weeklyLoadError) {
      console.error("Failed to load weekly chart:", weeklyLoadError);
      setError("Unable to load weekly chart data.");
      setWeeklyChart([]);
    } finally {
      setIsWeeklyLoading(false);
    }
  }, []);

  const loadGenreStatistics = useCallback(async (week: string) => {
    setIsGenreLoading(true);
    try {
      const { data, error: genreError } = await supabase
        .from("genre_statistics")
        .select("*")
        .eq("chart_type", "weekly")
        .eq("chart_date", week)
        .order("total_plays", { ascending: false });

      if (genreError) {
        throw genreError;
      }

      const rows = (data ?? []) as GenreStatisticRow[];
      setGenreStats(rows.map(mapGenreStatisticRow));
    } catch (genreLoadError) {
      console.error("Failed to load genre statistics:", genreLoadError);
      setError("Unable to load genre statistics.");
      setGenreStats([]);
    } finally {
      setIsGenreLoading(false);
    }
  }, []);

  useEffect(() => {
    setError(null);
    loadLatestDailyChart();
    loadAvailableWeeks();
  }, [loadLatestDailyChart, loadAvailableWeeks]);

  useEffect(() => {
    if (!selectedWeek) {
      setWeeklyChart([]);
      setGenreStats([]);
      return;
    }

    loadWeeklyChart(selectedWeek);
    loadGenreStatistics(selectedWeek);
  }, [selectedWeek, refreshKey, loadWeeklyChart, loadGenreStatistics]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      await Promise.all([loadLatestDailyChart(), loadAvailableWeeks()]);
      setRefreshKey((prev) => prev + 1);
    } catch (refreshError) {
      console.error("Failed to refresh charts:", refreshError);
      setError("Failed to refresh chart data. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  }, [loadLatestDailyChart, loadAvailableWeeks]);

  const getTrendIcon = (trend: ChartEntry["trend"], change: number) => {
    if (trend === "up") {
      return <TrendingUp className="h-4 w-4 text-success" />;
    }
    if (trend === "down") {
      return <TrendingUp className="h-4 w-4 text-destructive rotate-180" />;
    }
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
              onClick={handleRefresh}
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
                  {dailyDescription
                    ? `Most popular songs for ${dailyDescription}`
                    : "Most popular songs from the latest update"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isDailyLoading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Loading daily chart...</div>
                ) : dailyChart.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Daily chart data is not available yet.
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
                            {entry.artist}
                            {entry.band && entry.band !== "—" ? ` • ${entry.band}` : ""}
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
                              {entry.trend === "same"
                                ? "—"
                                : `${entry.trendChange > 0 ? "+" : ""}${entry.trendChange}`}
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
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-accent" />
                    Weekly Chart - Top 10
                  </CardTitle>
                  <CardDescription>{weeklyDescription}</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={selectedWeek ?? undefined}
                    onValueChange={(value) => {
                      setSelectedWeek(value);
                    }}
                    disabled={isWeeksLoading || availableWeeks.length === 0}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder={isWeeksLoading ? "Loading weeks..." : "Select week"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableWeeks.map((week) => (
                        <SelectItem key={week} value={week}>
                          {formatDateLabel(week, "Week of ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isWeeklyLoading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Loading weekly chart...</div>
                ) : weeklyChart.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {selectedWeek
                      ? "No data available for the selected week yet."
                      : "Select a week to view weekly rankings."}
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
                            {entry.artist}
                            {entry.band && entry.band !== "—" ? ` • ${entry.band}` : ""}
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
                              {entry.trend === "same"
                                ? "—"
                                : `${entry.trendChange > 0 ? "+" : ""}${entry.trendChange}`}
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
            {isGenreLoading ? (
              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardContent>
                  <div className="py-6 text-center text-sm text-muted-foreground">Loading genre statistics...</div>
                </CardContent>
              </Card>
            ) : genreStats.length === 0 ? (
              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardContent>
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {selectedWeek
                      ? "No genre analytics available for the selected week yet."
                      : "Select a week to view genre performance."}
                  </div>
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
                          {genre.growth > 0 ? "+" : ""}
                          {genre.growth.toFixed(1)}%
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-primary">
                            {Math.round(genre.totalPlays).toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">Total Plays</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-accent">{genre.totalSongs}</div>
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
