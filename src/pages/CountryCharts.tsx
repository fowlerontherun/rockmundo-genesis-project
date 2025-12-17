import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, Sparkles, Music, Disc, Radio, Download, PlaySquare, BarChart3, Globe, Filter } from "lucide-react";
import { useCountryCharts, useAvailableGenres, useAvailableCountries, ChartType, ChartEntry, GENRES, COUNTRIES } from "@/hooks/useCountryCharts";
import { cn } from "@/lib/utils";

const CHART_TYPES: { value: ChartType; label: string; icon: React.ReactNode }[] = [
  { value: "combined", label: "Combined", icon: <BarChart3 className="h-4 w-4" /> },
  { value: "streaming", label: "Streaming", icon: <Radio className="h-4 w-4" /> },
  { value: "digital_sales", label: "Digital", icon: <Download className="h-4 w-4" /> },
  { value: "cd_sales", label: "CD Sales", icon: <Disc className="h-4 w-4" /> },
  { value: "vinyl_sales", label: "Vinyl", icon: <Disc className="h-4 w-4" /> },
  { value: "cassette_sales", label: "Cassette", icon: <PlaySquare className="h-4 w-4" /> },
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

const ChartTable = ({ entries, isLoading }: { entries: ChartEntry[]; isLoading: boolean }) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
        <div className="col-span-1">#</div>
        <div className="col-span-5 sm:col-span-4">Song</div>
        <div className="col-span-3 sm:col-span-2 hidden sm:block">Genre</div>
        <div className="col-span-3 sm:col-span-2 text-right">Plays</div>
        <div className="col-span-2 text-center hidden sm:block">Trend</div>
        <div className="col-span-3 sm:col-span-1 text-right">Weeks</div>
      </div>

      {/* Entries */}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={cn(
            "grid grid-cols-12 gap-2 px-3 py-3 rounded-lg hover:bg-accent/50 transition-colors items-center",
            entry.rank <= 3 && "bg-accent/30",
            entry.is_fake && "opacity-70"
          )}
        >
          {/* Rank */}
          <div className="col-span-1">
            <span
              className={cn(
                "font-bold text-lg",
                entry.rank === 1 && "text-yellow-500",
                entry.rank === 2 && "text-slate-400",
                entry.rank === 3 && "text-amber-600"
              )}
            >
              {entry.rank}
            </span>
          </div>

          {/* Song & Artist */}
          <div className="col-span-5 sm:col-span-4 min-w-0">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate text-sm">{entry.title}</p>
                <p className="text-xs text-muted-foreground truncate">{entry.artist}</p>
              </div>
              {entry.is_fake && (
                <Badge variant="outline" className="text-[10px] px-1 shrink-0">
                  SIM
                </Badge>
              )}
            </div>
          </div>

          {/* Genre */}
          <div className="col-span-3 sm:col-span-2 hidden sm:block">
            <Badge variant="secondary" className="text-xs">
              {entry.genre}
            </Badge>
          </div>

          {/* Plays */}
          <div className="col-span-3 sm:col-span-2 text-right">
            <span className="font-mono text-sm">{formatNumber(entry.plays_count)}</span>
          </div>

          {/* Trend */}
          <div className="col-span-2 hidden sm:flex items-center justify-center gap-1">
            {getTrendIcon(entry.trend)}
            {entry.trend !== "new" && entry.trend_change !== 0 && (
              <span
                className={cn(
                  "text-xs font-medium",
                  entry.trend_change > 0 && "text-green-500",
                  entry.trend_change < 0 && "text-red-500"
                )}
              >
                {entry.trend_change > 0 ? "+" : ""}
                {entry.trend_change}
              </span>
            )}
            {entry.trend === "new" && (
              <span className="text-xs text-yellow-500 font-medium">NEW</span>
            )}
          </div>

          {/* Weeks */}
          <div className="col-span-3 sm:col-span-1 text-right">
            <span className="text-sm text-muted-foreground">{entry.weeks_on_chart}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function CountryCharts() {
  const [country, setCountry] = useState("Global");
  const [genre, setGenre] = useState("All");
  const [chartType, setChartType] = useState<ChartType>("combined");

  const { data: entries = [], isLoading } = useCountryCharts(country, genre, chartType);
  const { data: genres = ["All", ...GENRES] } = useAvailableGenres();
  const { data: countries = COUNTRIES } = useAvailableCountries();

  const realSongsCount = entries.filter((e) => !e.is_fake).length;

  return (
    <div className="container mx-auto py-6 space-y-6 px-4">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Music className="h-8 w-8 text-primary" />
            Country Charts
          </h1>
          <p className="text-muted-foreground mt-1">
            Top 50 songs by country, genre, and sales type
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="w-[180px]">
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
              <SelectTrigger className="w-[150px]">
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

          {realSongsCount < 50 && (
            <Badge variant="outline" className="text-xs">
              {realSongsCount} real / {50 - realSongsCount} simulated
            </Badge>
          )}
        </div>
      </div>

      {/* Chart Type Tabs */}
      <Tabs value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto">
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
                </CardTitle>
                <CardDescription>
                  Top 50 songs ranked by {type.value === "streaming" ? "streams" : type.value === "combined" ? "total sales & streams" : "sales"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartTable entries={entries} isLoading={isLoading} />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
