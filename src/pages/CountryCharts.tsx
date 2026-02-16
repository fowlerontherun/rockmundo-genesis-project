import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, Sparkles, Music, Disc, Radio, Download, PlaySquare, BarChart3, Globe, Filter, HelpCircle, Calendar, Album } from "lucide-react";
import { useCountryCharts, useAvailableGenres, useAvailableCountries, ChartType, ChartEntry, GENRES, COUNTRIES, ReleaseCategory, ChartTimeRange, ChartYear, getMetricLabels } from "@/hooks/useCountryCharts";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { TrackableSongPlayer } from "@/components/audio/TrackableSongPlayer";
import { ChartHistoryDialog } from "@/components/charts/ChartHistoryDialog";

const CHART_TYPES: { value: ChartType; label: string; icon: React.ReactNode; description: string; hasAlbumData: boolean }[] = [
  { value: "combined", label: "Top 50", icon: <BarChart3 className="h-4 w-4" />, description: "Official chart combining streams & all sales", hasAlbumData: true },
  { value: "streaming", label: "Streaming", icon: <Radio className="h-4 w-4" />, description: "Ranked by weekly streams", hasAlbumData: true },
  { value: "digital_sales", label: "Digital", icon: <Download className="h-4 w-4" />, description: "Digital download sales", hasAlbumData: true },
  { value: "physical_sales", label: "Physical", icon: <Disc className="h-4 w-4" />, description: "CD, Vinyl & Cassette sales combined", hasAlbumData: false },
  { value: "radio_airplay", label: "Radio", icon: <Radio className="h-4 w-4" />, description: "Radio airplay chart", hasAlbumData: false },
];

const TIME_RANGES: { value: ChartTimeRange; label: string }[] = [
  { value: "daily", label: "Today" },
  { value: "weekly", label: "This Week" },
  { value: "monthly", label: "This Month" },
  { value: "yearly", label: "This Year" },
];

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case "up":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "down":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case "new":
      return <Sparkles className="h-4 w-4 text-yellow-500" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
};

interface ChartTableProps {
  entries: ChartEntry[];
  isLoading: boolean;
  chartType: ChartType;
  timeRange: ChartTimeRange;
  releaseCategory: ReleaseCategory;
}

const ChartTable = ({ entries, isLoading, chartType, timeRange, releaseCategory }: ChartTableProps) => {
  const labels = getMetricLabels(chartType, timeRange);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const isAlbumView = releaseCategory === "album" || releaseCategory === "ep";
  
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (entries.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Music className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground">No Chart Data Available</h3>
        <p className="text-sm text-muted-foreground/70 max-w-md mt-2">
          No {isAlbumView ? "albums" : "songs"} are currently charting for the selected filters. This may happen for physical formats like vinyl or cassette if there haven't been recent sales.
        </p>
      </div>
    );
  }

  // Get the correct values to display based on chart type
  const getWeeklyValue = (entry: ChartEntry) => {
    if (chartType === "combined") {
      return entry.combined_score;
    }
    if (chartType === "streaming") {
      return entry.weekly_plays;
    }
    return entry.plays_count; // For sales, plays_count IS the weekly sales
  };

  const getTotalValue = (entry: ChartEntry) => {
    if (chartType === "combined") {
      return entry.plays_count; // Show streams as "total" for combined
    }
    return entry.total_sales;
  };

  return (
    <>
      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-8 sm:grid-cols-12 gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
          <div className="col-span-1">#</div>
          <div className="col-span-4 sm:col-span-3">{isAlbumView ? "Album" : "Song"}</div>
          <div className="col-span-2 hidden sm:block">Genre</div>
          <div className="col-span-3 sm:col-span-2 text-right hidden sm:flex items-center justify-end gap-1">
            {labels.weekly}
            {chartType === "combined" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      <strong>Chart Points Formula:</strong><br/>
                      (Weekly Streams ÷ 150) + Digital Sales + CD Sales + Vinyl Sales + Cassette Sales
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="col-span-3 sm:hidden text-right">Sales</div>
          <div className="col-span-2 text-right hidden sm:block">{labels.total}</div>
          <div className="col-span-1 text-center hidden sm:block">Trend</div>
          <div className="col-span-1 text-right hidden sm:block">Wks</div>
        </div>

        {/* Entries */}
        {entries.map((entry) => {
          const isAlbumEntry = entry.entry_type === "album";
          
          return (
            <div
              key={entry.id}
              className={cn(
                "grid grid-cols-8 sm:grid-cols-12 gap-1 sm:gap-2 px-2 sm:px-3 py-2 sm:py-3 rounded-lg hover:bg-accent/50 transition-colors items-start cursor-pointer",
                entry.rank <= 3 && "bg-accent/30",
                entry.is_fake && "opacity-70"
              )}
              onClick={() => setSelectedSongId(entry.song_id)}
            >
              {/* Rank */}
              <div className="col-span-1">
                <span
                  className={cn(
                    "font-bold text-base sm:text-lg",
                    entry.rank === 1 && "text-yellow-500",
                    entry.rank === 2 && "text-slate-400",
                    entry.rank === 3 && "text-amber-600"
                  )}
                >
                  {entry.rank}
                </span>
              </div>

              {/* Song/Album & Artist */}
              <div className="col-span-4 sm:col-span-3 min-w-0">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      {isAlbumEntry && (
                        <Album className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary shrink-0" />
                      )}
                      <p className="font-medium truncate text-xs sm:text-sm">{entry.title}</p>
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{entry.artist}</p>
                  </div>
                  {entry.is_fake && (
                    <Badge variant="outline" className="text-[10px] px-1 shrink-0">
                      SIM
                    </Badge>
                  )}
                  {isAlbumEntry && (
                    <Badge variant="secondary" className="text-[10px] px-1 shrink-0 hidden sm:inline-flex">
                      Album
                    </Badge>
                  )}
                </div>
                {/* Audio Player for real songs (only for song entries) */}
                {!entry.is_fake && entry.audio_url && !isAlbumEntry && (
                  <div className="mt-1 sm:mt-2" onClick={(e) => e.stopPropagation()}>
                    <TrackableSongPlayer
                      songId={entry.song_id}
                      audioUrl={entry.audio_url}
                      title={entry.title}
                      artist={entry.artist}
                      generationStatus={entry.audio_generation_status}
                      compact
                      source="country_charts"
                    />
                  </div>
                )}
              </div>

              {/* Genre */}
              <div className="col-span-2 hidden sm:block">
                <Badge variant="secondary" className="text-xs">
                  {entry.genre}
                </Badge>
              </div>

              {/* Mobile: Stacked weekly + total */}
              <div className="col-span-3 sm:hidden text-right">
                <div className="flex flex-col gap-0.5">
                  <div>
                    <span className="text-[9px] text-muted-foreground block">{labels.weekly}</span>
                    <span className="font-mono text-xs">{formatNumber(getWeeklyValue(entry))}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-foreground block">{labels.total}</span>
                    <span className="font-mono text-xs">{formatNumber(getTotalValue(entry))}</span>
                  </div>
                </div>
              </div>

              {/* Desktop: Weekly/Chart Points */}
              <div className="col-span-2 text-right hidden sm:block">
                <span className="font-mono text-sm">{formatNumber(getWeeklyValue(entry))}</span>
              </div>

              {/* Desktop: Total */}
              <div className="col-span-2 text-right hidden sm:block">
                <span className="font-mono text-sm">{formatNumber(getTotalValue(entry))}</span>
              </div>

              {/* Trend */}
              <div className="col-span-1 hidden sm:flex items-center justify-center gap-1">
                {getTrendIcon(entry.trend)}
              </div>

              {/* Weeks */}
              <div className="col-span-1 text-right hidden sm:block">
                <span className="text-sm text-muted-foreground">{entry.weeks_on_chart}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart History Dialog */}
      {selectedSongId && (
        <ChartHistoryDialog
          songId={selectedSongId}
          chartType={chartType}
          isOpen={!!selectedSongId}
          onClose={() => setSelectedSongId(null)}
        />
      )}
    </>
  );
};

export default function CountryCharts() {
  const [country, setCountry] = useState("Global");
  const [genre, setGenre] = useState("All");
  const [chartType, setChartType] = useState<ChartType>("combined");
  const [releaseCategory, setReleaseCategory] = useState<ReleaseCategory>("single"); // Default to singles
  const [timeRange, setTimeRange] = useState<ChartTimeRange>("weekly");
  const [selectedYear, setSelectedYear] = useState<ChartYear>("current");

  // Generate available years (current year back to 2020)
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years: { value: ChartYear; label: string }[] = [
      { value: "current", label: "Last 12 Months" }
    ];
    for (let year = currentYear; year >= 2020; year--) {
      years.push({ value: year, label: String(year) });
    }
    return years;
  }, [currentYear]);

  const { data: entries = [], isLoading } = useCountryCharts(country, genre, chartType, releaseCategory, timeRange, selectedYear);
  const { data: genres = ["All", ...GENRES] } = useAvailableGenres();
  const { data: countries = COUNTRIES } = useAvailableCountries();

  const realSongsCount = entries.filter((e) => !e.is_fake).length;
  const currentChartInfo = CHART_TYPES.find(t => t.value === chartType);
  const isAlbumView = releaseCategory === "album" || releaseCategory === "ep";

  return (
    <div className="container mx-auto py-6 space-y-6 px-4">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Music className="h-8 w-8 text-primary" />
            Charts
          </h1>
          <p className="text-muted-foreground mt-1">
            Top 50 {isAlbumView ? "albums" : "songs"} by region, genre, and sales type
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={timeRange} onValueChange={(v) => {
              setTimeRange(v as ChartTimeRange);
              // Reset year selection when changing away from yearly
              if (v !== "yearly") {
                setSelectedYear("current");
              }
            }}>
              <SelectTrigger className="w-[110px] sm:w-[130px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Year selector - only show when yearly time range is selected */}
          {timeRange === "yearly" && (
            <div className="flex items-center gap-2">
              <Select 
                value={String(selectedYear)} 
                onValueChange={(v) => setSelectedYear(v === "current" ? "current" : parseInt(v))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={String(y.value)} value={String(y.value)}>
                      {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="w-[130px] sm:w-[180px]">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="w-[110px] sm:w-[150px]">
                <SelectValue placeholder="Select genre" />
              </SelectTrigger>
              <SelectContent>
                {genres.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Only show release category for chart types with album data */}
          {currentChartInfo?.hasAlbumData && (
            <div className="flex items-center gap-2">
              <Disc className="h-4 w-4 text-muted-foreground" />
              <Select value={releaseCategory} onValueChange={(v) => setReleaseCategory(v as ReleaseCategory)}>
                <SelectTrigger className="w-[110px] sm:w-[150px]">
                  <SelectValue placeholder="Release type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Singles</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ep">EPs</SelectItem>
                  <SelectItem value="album">Albums</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {realSongsCount < 50 && realSongsCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {realSongsCount} {isAlbumView ? "albums" : "songs"} charting
            </Badge>
          )}
        </div>
      </div>

      {/* Chart Type Tabs */}
      <Tabs value={chartType} onValueChange={(v) => {
        setChartType(v as ChartType);
        // Reset to singles for chart types without album data
        const newType = CHART_TYPES.find(t => t.value === v);
        if (newType && !newType.hasAlbumData && (releaseCategory === "album" || releaseCategory === "ep")) {
          setReleaseCategory("single");
        }
      }}>
        <TabsList className="grid w-full grid-cols-5 h-auto">
          {CHART_TYPES.map((type) => (
            <TabsTrigger
              key={type.value}
              value={type.value}
              className="flex items-center gap-1.5 text-xs sm:text-sm py-2"
            >
              {type.icon}
              <span className="hidden sm:inline">{type.label}</span>
              <span className="sm:hidden">{type.label.split(" ")[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {CHART_TYPES.map((type) => (
          <TabsContent key={type.value} value={type.value} className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {type.icon}
                  {country} - {genre === "All" ? "All Genres" : genre} - {type.label} Chart
                  {isAlbumView && (
                    <Badge variant="secondary" className="ml-2">
                      {releaseCategory === "album" ? "Albums" : "EPs"}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {type.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartTable 
                  entries={entries} 
                  isLoading={isLoading} 
                  chartType={chartType} 
                  timeRange={timeRange} 
                  releaseCategory={releaseCategory}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
