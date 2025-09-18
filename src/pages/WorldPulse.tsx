import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Loader2,
  Disc,
  ShoppingCart,
  Download
} from "lucide-react";

type TrendDirection = "up" | "down" | "same";

interface StreamingChartEntry {
  rank: number;
  title: string;
  artist: string;
  band: string;
  genre: string;
  plays: number;
  popularity: number;
  trend: TrendDirection;
  trendChange: number;
  weeksOnChart: number;
}

interface RecordSalesEntry {
  rank: number;
  title: string;
  artist: string;
  genre: string;
  physicalSales: number;
  digitalSales: number;
  totalSales: number;
  salesShare: number;
  trend: TrendDirection;
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

interface SalesSummary {
  totalPhysical: number;
  totalDigital: number;
  totalCombined: number;
  averageSales: number;
  topSeller: RecordSalesEntry;
  trendLeader: RecordSalesEntry;
}

type GlobalChartRow = Database["public"]["Tables"]["global_charts"]["Row"];
type SongRow = Database["public"]["Tables"]["songs"]["Row"];
type PublicProfileRow = Database["public"]["Views"]["public_profiles"]["Row"];

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

const buildSalesSummary = (entries: RecordSalesEntry[]): SalesSummary | null => {
  if (!entries.length) {
    return null;
  }

  const totals = entries.reduce(
    (acc, entry) => {
      return {
        physical: acc.physical + entry.physicalSales,
        digital: acc.digital + entry.digitalSales
      };
    },
    { physical: 0, digital: 0 }
  );

  const totalCombined = totals.physical + totals.digital;
  const averageSales = entries.length > 0 ? Math.round(totalCombined / entries.length) : 0;
  const topSeller = entries[0];
  const trendLeader =
    entries.reduce<RecordSalesEntry | null>((current, entry) => {
      if (entry.trend !== "up") {
        return current;
      }

      if (!current || entry.trendChange > current.trendChange) {
        return entry;
      }

      return current;
    }, null) ?? topSeller;

  return {
    totalPhysical: totals.physical,
    totalDigital: totals.digital,
    totalCombined,
    averageSales,
    topSeller,
    trendLeader
  };
};

const WorldPulse = () => {
  const [dailyStreamingChart, setDailyStreamingChart] = useState<StreamingChartEntry[]>([]);
  const [weeklyStreamingChart, setWeeklyStreamingChart] = useState<StreamingChartEntry[]>([]);
  const [dailySalesChart, setDailySalesChart] = useState<RecordSalesEntry[]>([]);
  const [weeklySalesChart, setWeeklySalesChart] = useState<RecordSalesEntry[]>([]);
  const [genreStats, setGenreStats] = useState<GenreStats[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [latestDailyDate, setLatestDailyDate] = useState<string | null>(null);
  const [dailyLabel, setDailyLabel] = useState("");
  const [currentWeekLabel, setCurrentWeekLabel] = useState("Loading charts...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildChartData = useCallback(
    async (rows: GlobalChartRow[]): Promise<{ streaming: StreamingChartEntry[]; sales: RecordSalesEntry[] }> => {
      if (!rows.length) {
        return { streaming: [], sales: [] };
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

      const profilesByUserId = new Map<string, PublicProfileRow>();
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("public_profiles")
          .select("user_id, display_name, username")
          .in("user_id", userIds);

        if (profilesError) {
          throw profilesError;
        }

        (profilesData ?? []).forEach((profile) => {
          profilesByUserId.set(profile.user_id, profile as PublicProfileRow);
        });
      }

      const maxStreams = rows.reduce((max, row) => Math.max(max, Number(row.total_streams ?? 0)), 0);
      const maxSales = rows.reduce((max, row) => Math.max(max, Number(row.total_sales ?? 0)), 0);

      const streamingEntries: StreamingChartEntry[] = [];
      const salesEntries: RecordSalesEntry[] = [];

      rows
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .forEach((row) => {
          const song = songsById.get(row.song_id);
          const profile = song ? profilesByUserId.get(song.user_id) : undefined;

          const streams = Number(row.total_streams ?? 0);
          const streamScore = maxStreams > 0 ? Math.round((streams / maxStreams) * 100) : 0;
          const qualityScore = song?.quality_score ?? 50;
          const popularity = clamp(Math.round(0.6 * streamScore + 0.4 * qualityScore), 0, 100);
          const trendValue: TrendDirection =
            row.trend === "up" || row.trend === "down" || row.trend === "same" ? row.trend : "same";

          streamingEntries.push({
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
          });

          const physicalSales = Number(row.physical_sales ?? 0);
          const digitalSales = Number(row.digital_sales ?? 0);
          const totalSales =
            row.total_sales !== undefined && row.total_sales !== null
              ? Number(row.total_sales)
              : physicalSales + digitalSales;
          const salesShare = maxSales > 0 ? Math.round((totalSales / maxSales) * 100) : 0;

          salesEntries.push({
            rank: row.rank,
            title: song?.title ?? "Unknown Song",
            artist: profile?.display_name || profile?.username || "Unknown Artist",
            genre: song?.genre ?? "Unknown",
            physicalSales,
            digitalSales,
            totalSales,
            salesShare,
            trend: trendValue,
            trendChange: row.trend_change ?? 0,
            weeksOnChart: row.weeks_on_chart ?? 1
          });
        });

      return { streaming: streamingEntries, sales: salesEntries };
    },
    []
  );

  const loadDailyChart = useCallback(async () => {
    try {
      setError(null);
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
        setDailyStreamingChart([]);
        setDailySalesChart([]);
        setLatestDailyDate(null);
        setDailyLabel("");
        return;
      }

      setLatestDailyDate(latestDate);
      setDailyLabel(formatDailyValue(latestDate));

      const { data, error: chartError } = await supabase
        .from("global_charts")
        .select("*")
        .eq("chart_type", "daily")
        .eq("chart_date", latestDate)
        .order("rank", { ascending: true })
        .limit(100);

      if (chartError) {
        throw chartError;
      }

      const chartRows = (data ?? []) as GlobalChartRow[];
      const { streaming, sales } = await buildChartData(chartRows);
      setDailyStreamingChart(streaming.slice(0, 10));
      setDailySalesChart(sales.slice(0, 10));
      setError(null);
    } catch (caught) {
      console.error("Failed to load daily chart:", caught);
      setDailyStreamingChart([]);
      setDailySalesChart([]);
      setLatestDailyDate(null);
      setDailyLabel("");
      setError("Failed to load the daily charts. Please try again.");
    }
  }, [buildChartData]);

  const loadWeeklyChart = useCallback(
    async (weekDate: string) => {
      try {
        const { data, error: chartError } = await supabase
          .from("global_charts")
          .select("*")
          .eq("chart_type", "weekly")
          .eq("chart_date", weekDate)
          .order("rank", { ascending: true })
          .limit(100);

        if (chartError) {
          throw chartError;
        }

        const chartRows = (data ?? []) as GlobalChartRow[];
        const { streaming, sales } = await buildChartData(chartRows);
        setWeeklyStreamingChart(streaming.slice(0, 10));
        setWeeklySalesChart(sales.slice(0, 10));
        setCurrentWeekLabel(formatWeekValue(weekDate));
        setError(null);
      } catch (caught) {
        console.error("Failed to load weekly chart:", caught);
        setWeeklyStreamingChart([]);
        setWeeklySalesChart([]);
        setError("Failed to load the weekly charts. Please try again.");
      }
    },
    [buildChartData]
  );

  const loadAvailableWeeks = useCallback(async () => {
    try {
      const { data, error: weeksError } = await supabase
        .from("global_charts")
        .select("chart_date")
        .eq("chart_type", "weekly")
        .order("chart_date", { ascending: false });

      if (weeksError) {
        throw weeksError;
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
    } catch (caught) {
      console.error("Failed to load chart weeks:", caught);
      setAvailableWeeks([]);
      setWeeklyStreamingChart([]);
      setWeeklySalesChart([]);
      setCurrentWeekLabel("No weekly data");
      setError("Failed to load available weeks. Please try again.");
    }
  }, []);

  const loadGenreStats = useCallback(async () => {
    try {
      const { data, error: songsError } = await supabase
        .from("songs")
        .select("id, title, genre, streams, quality_score");

      if (songsError) {
        throw songsError;
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
    } catch (caught) {
      console.error("Failed to load genre stats:", caught);
      setGenreStats([]);
      setError("Failed to load genre statistics. Please try again later.");
    }
  }, []);

  useEffect(() => {
    loadDailyChart();
    loadAvailableWeeks();
    loadGenreStats();
  }, [loadDailyChart, loadAvailableWeeks, loadGenreStats]);

  useEffect(() => {
    if (!availableWeeks.length) {
      setWeeklyStreamingChart([]);
      setWeeklySalesChart([]);
      setCurrentWeekLabel("No weekly data");
      return;
    }

    const safeIndex = Math.min(currentWeekIndex, availableWeeks.length - 1);
    if (safeIndex !== currentWeekIndex) {
      setCurrentWeekIndex(safeIndex);
      return;
    }

    const selectedWeek = availableWeeks[safeIndex];
    loadWeeklyChart(selectedWeek);
  }, [availableWeeks, currentWeekIndex, loadWeeklyChart]);

  const handleRefreshCharts = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const { error: refreshError } = await supabase.rpc("refresh_global_charts");
      if (refreshError) {
        console.error("Failed to execute refresh_global_charts:", refreshError);
        setError("Supabase could not refresh the charts. Showing the latest cached data.");
      }

      const weekToReload = availableWeeks.length > 0 ? availableWeeks[currentWeekIndex] : null;
      await Promise.all([loadDailyChart(), loadAvailableWeeks(), loadGenreStats()]);
      if (weekToReload) {
        await loadWeeklyChart(weekToReload);
      }
      setError(null);
    } catch (caught) {
      console.error("Failed to refresh charts:", caught);
      setError("Failed to refresh the charts. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  }, [
    availableWeeks,
    currentWeekIndex,
    loadDailyChart,
    loadAvailableWeeks,
    loadGenreStats,
    loadWeeklyChart
  ]);

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
  const isPrevDisabled = availableWeeks.length === 0 || currentWeekIndex >= availableWeeks.length - 1;
  const isNextDisabled = availableWeeks.length === 0 || currentWeekIndex === 0;

  const dailyDescription = latestDailyDate
    ? `Most streamed songs for ${formatDailyValue(latestDailyDate)}`
    : "Daily streaming stats from the latest update";

  const dailySalesSummary = useMemo(() => buildSalesSummary(dailySalesChart), [dailySalesChart]);
  const weeklySalesSummary = useMemo(() => buildSalesSummary(weeklySalesChart), [weeklySalesChart]);

  const getTrendIcon = (trend: TrendDirection, change: number) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend === "down") return <TrendingUp className="h-4 w-4 rotate-180 text-destructive" />;
    return <span className="h-4 w-4 text-muted-foreground">-</span>;
  };

  const getTrendColor = (trend: TrendDirection) => {
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

  const renderStreamingEntries = (entries: StreamingChartEntry[], emptyMessage: string) => {
    if (!entries.length) {
      return <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>;
    }

    return (
      <div className="space-y-3">
        {entries.map((entry) => (
          <div
            key={`${entry.rank}-${entry.title}`}
            className="flex items-center gap-4 rounded-lg bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"
          >
            <div className="flex items-center justify-center w-12">{getRankBadge(entry.rank)}</div>

            <div className="flex-1 min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <h3 className="truncate text-lg font-semibold">{entry.title}</h3>
                <Badge variant="outline" className="text-xs">
                  {entry.genre}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {entry.artist} • {entry.band}
              </p>
            </div>

            <div className="space-y-1 text-right">
              <div className="flex items-center gap-2">
                <Play className="h-3 w-3" />
                <span className="font-mono text-sm">{entry.plays.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                {getTrendIcon(entry.trend, entry.trendChange)}
                <span className={`text-sm ${getTrendColor(entry.trend)}`}>
                  {entry.trend === "same" ? "—" : `${entry.trendChange > 0 ? "+" : ""}${entry.trendChange}`}
                </span>
              </div>
            </div>

            <div className="w-24">
              <div className="mb-1 text-xs text-muted-foreground">Popularity</div>
              <Progress value={entry.popularity} className="h-2" />
              <div className="mt-1 text-right text-xs">{entry.popularity}%</div>
            </div>

            <div className="text-center text-xs text-muted-foreground">
              <div>{entry.weeksOnChart}</div>
              <div>weeks</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSalesSummary = (summary: SalesSummary | null) => {
    if (!summary) {
      return null;
    }

    return (
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-primary/20 bg-secondary/30 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Units</div>
          <div className="mt-2 flex items-center gap-2">
            <Disc className="h-4 w-4 text-primary" />
            <span className="text-2xl font-bold">{summary.totalCombined.toLocaleString()}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {summary.totalPhysical.toLocaleString()} physical • {summary.totalDigital.toLocaleString()} digital
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Avg per song: {summary.averageSales.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-primary/20 bg-secondary/30 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Top Seller</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center justify-center">{getRankBadge(summary.topSeller.rank)}</div>
            <div className="min-w-0">
              <div className="truncate font-semibold">{summary.topSeller.title}</div>
              <div className="truncate text-xs text-muted-foreground">{summary.topSeller.artist}</div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {summary.topSeller.totalSales.toLocaleString()} total units sold
          </p>
        </div>
        <div className="rounded-lg border border-primary/20 bg-secondary/30 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Momentum Leader</div>
          <div className="mt-2 flex items-center gap-3">
            {getTrendIcon(summary.trendLeader.trend, summary.trendLeader.trendChange)}
            <div>
              <div className="font-semibold">{summary.trendLeader.title}</div>
              <div className="text-xs text-muted-foreground">
                {summary.trendLeader.trend === "same"
                  ? "Holding steady"
                  : `${summary.trendLeader.trendChange > 0 ? "+" : ""}${summary.trendLeader.trendChange} places`}
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {summary.trendLeader.totalSales.toLocaleString()} total units • {summary.trendLeader.weeksOnChart} weeks on chart
          </p>
        </div>
      </div>
    );
  };

  const renderSalesEntries = (entries: RecordSalesEntry[], emptyMessage: string) => {
    if (!entries.length) {
      return <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>;
    }

    return (
      <div className="space-y-4">
        {entries.map((entry) => (
          <div
            key={`${entry.rank}-${entry.title}`}
            className="rounded-lg bg-secondary/30 p-4 transition-colors hover:bg-secondary/50"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12">{getRankBadge(entry.rank)}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-lg font-semibold">{entry.title}</h3>
                    <Badge variant="outline" className="text-xs">
                      {entry.genre}
                    </Badge>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{entry.artist}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {getTrendIcon(entry.trend, entry.trendChange)}
                  <span className={`text-sm ${getTrendColor(entry.trend)}`}>
                    {entry.trend === "same" ? "—" : `${entry.trendChange > 0 ? "+" : ""}${entry.trendChange}`}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {entry.weeksOnChart} weeks
                </Badge>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-center justify-between rounded-md bg-secondary/40 p-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <ShoppingCart className="h-3 w-3" />
                  Physical
                </span>
                <span className="font-mono">{entry.physicalSales.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-secondary/40 p-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Download className="h-3 w-3" />
                  Digital
                </span>
                <span className="font-mono">{entry.digitalSales.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-secondary/40 p-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Disc className="h-3 w-3" />
                  Total
                </span>
                <span className="font-mono font-semibold">{entry.totalSales.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Sales momentum</span>
                <span>{entry.salesShare}%</span>
              </div>
              <Progress value={entry.salesShare} className="h-2" />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="bg-gradient-primary bg-clip-text text-3xl font-bold text-transparent">World Pulse Charts</h1>
            <p className="text-muted-foreground">Global music trends, streams, and record sales</p>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/20">
              <Calendar className="mr-1 h-3 w-3" />
              {currentWeekLabel}
            </Badge>
            <Button
              variant="outline"
              className="border-primary/20 hover:bg-primary/10"
              onClick={handleRefreshCharts}
              disabled={isRefreshing}
            >
              {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              {isRefreshing ? "Refreshing..." : "Refresh Charts"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="streaming-daily" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 gap-2 md:grid-cols-5">
            <TabsTrigger value="streaming-daily">Streaming Daily</TabsTrigger>
            <TabsTrigger value="streaming-weekly">Streaming Weekly</TabsTrigger>
            <TabsTrigger value="sales-daily">Record Sales Daily</TabsTrigger>
            <TabsTrigger value="sales-weekly">Record Sales Weekly</TabsTrigger>
            <TabsTrigger value="genres">Genre Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="streaming-daily">
            <Card className="border-primary/20 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Daily Streaming Chart - Top 10
                </CardTitle>
                <CardDescription>{dailyDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                {renderStreamingEntries(
                  dailyStreamingChart,
                  "No daily chart data available yet. Try refreshing the charts once new streams roll in."
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="streaming-weekly">
            <Card className="border-primary/20 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-accent" />
                    Weekly Streaming Chart - Top 10
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/20 hover:bg-primary/10"
                      onClick={handlePrevWeek}
                      disabled={isPrevDisabled}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Prev
                    </Button>
                    <span className="whitespace-nowrap text-sm text-muted-foreground">{currentWeekLabel}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/20 hover:bg-primary/10"
                      onClick={handleNextWeek}
                      disabled={isNextDisabled}
                    >
                      Next
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  {selectedWeekDate
                    ? `Most popular songs for ${formatWeekValue(selectedWeekDate)}`
                    : "Select a week to view rankings"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderStreamingEntries(
                  weeklyStreamingChart,
                  "No weekly chart data available yet. Keep releasing music to enter the global rankings."
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales-daily">
            <Card className="border-primary/20 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Disc className="h-5 w-5 text-primary" />
                  Record Sales - Daily Top 10
                </CardTitle>
                <CardDescription>
                  {dailyLabel
                    ? `Record sales snapshot for ${dailyLabel}`
                    : "Record sales from the latest update"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderSalesSummary(dailySalesSummary)}
                {renderSalesEntries(
                  dailySalesChart,
                  "No record sales data available for this day yet. Keep building momentum to see your tracks here."
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales-weekly">
            <Card className="border-primary/20 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Disc className="h-5 w-5 text-accent" />
                  Record Sales - Weekly Top 10
                </CardTitle>
                <CardDescription>
                  {selectedWeekDate
                    ? `Record sales for ${formatWeekValue(selectedWeekDate)}`
                    : "Record sales will appear once weekly data is available"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderSalesSummary(weeklySalesSummary)}
                {renderSalesEntries(
                  weeklySalesChart,
                  "No weekly record sales data available yet. Keep building momentum to see your tracks here."
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="genres">
            {genreStats.length === 0 ? (
              <Card className="border-primary/20 bg-card/80 backdrop-blur-sm">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Genre insights will appear once your catalog starts generating streams and fans.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {genreStats.map((genre) => (
                  <Card key={genre.genre} className="border-primary/20 bg-card/80 backdrop-blur-sm">
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
                          <div className="text-2xl font-bold text-primary">{genre.totalPlays.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">Total Plays</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-accent">{genre.totalSongs}</div>
                          <div className="text-xs text-muted-foreground">Songs</div>
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 flex justify-between text-sm">
                          <span>Avg Popularity</span>
                          <span>{genre.avgPopularity}%</span>
                        </div>
                        <Progress value={genre.avgPopularity} className="h-2" />
                      </div>

                      <div className="border-border/50 pt-2">
                        <div className="mb-1 text-xs text-muted-foreground">Top Song</div>
                        <div className="text-sm font-medium">{genre.topSong}</div>
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
