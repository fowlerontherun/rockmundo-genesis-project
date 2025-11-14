import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ArrowUpDown, Globe2, LineChart as LineChartIcon, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchChartAggregates } from "@/lib/api/charts";
import type { ChartAggregate, ChartFilters } from "@/lib/api/charts";

const chartTypeLabels: Record<string, string> = {
  streaming: "Streaming",
  digital_sales: "Digital Sales",
  cd_sales: "CD Sales",
  vinyl_sales: "Vinyl Sales",
  record_sales: "Record Store",
};

const timeframeOptions = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const chartTypeOptions = [
  { value: "all", label: "All chart types" },
  { value: "streaming", label: "Streaming" },
  { value: "digital_sales", label: "Digital Sales" },
  { value: "cd_sales", label: "CD Sales" },
  { value: "vinyl_sales", label: "Vinyl Sales" },
  { value: "record_sales", label: "Record Store" },
];

const countryOptions = [
  { value: "all", label: "All countries" },
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "jp", label: "Japan" },
  { value: "de", label: "Germany" },
  { value: "kr", label: "South Korea" },
];

const genreOptions = [
  { value: "all", label: "All genres" },
  { value: "Rock", label: "Rock" },
  { value: "Pop", label: "Pop" },
  { value: "Electronic", label: "Electronic" },
  { value: "Hip Hop", label: "Hip Hop" },
  { value: "Jazz", label: "Jazz" },
  { value: "Indie", label: "Indie" },
  { value: "Metal", label: "Metal" },
];

type SortKey = "chartType" | "averageRank" | "totalPlays" | "momentum" | "entryCount";
type SortDirection = "asc" | "desc";

const numberFormatter = new Intl.NumberFormat();

const formatChartType = (value: string) => chartTypeLabels[value] ?? value.replace(/_/g, " ");

const buildFilters = (
  chartType: string,
  country: string,
  genre: string,
  timeframe: string,
): ChartFilters => {
  const now = new Date();
  const endDate = now.toISOString().split("T")[0];
  let startDate: string | undefined;

  if (timeframe !== "all") {
    const offset = parseInt(timeframe, 10);
    const start = new Date(now);
    start.setDate(start.getDate() - offset);
    startDate = start.toISOString().split("T")[0];
  }

  return {
    chartType,
    country,
    genre,
    startDate,
    endDate,
  };
};

const getTrendConfig = () => ({
  totalPlays: {
    label: "Total Plays",
    color: "hsl(var(--primary))",
  },
  averageRank: {
    label: "Average Rank",
    color: "hsl(142 76% 36%)",
  },
});

const ChartsPage = () => {
  const [chartType, setChartType] = useState("all");
  const [country, setCountry] = useState("all");
  const [genre, setGenre] = useState("all");
  const [timeframe, setTimeframe] = useState("30d");
  const [sortKey, setSortKey] = useState<SortKey>("averageRank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const filters = useMemo(
    () => buildFilters(chartType, country, genre, timeframe),
    [chartType, country, genre, timeframe],
  );

  const { data, isLoading, isError, error } = useQuery<ChartAggregate[]>({
    queryKey: ["chart-aggregates", filters],
    queryFn: () => fetchChartAggregates(filters),
    staleTime: 1000 * 60 * 5,
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "chartType" ? "asc" : "desc");
  };

  const sortedAggregates = useMemo(() => {
    if (!data) return [] as ChartAggregate[];

    return [...data].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      switch (sortKey) {
        case "chartType":
          return direction * formatChartType(a.chartType).localeCompare(formatChartType(b.chartType));
        case "averageRank":
          return direction * (a.averageRank - b.averageRank);
        case "totalPlays":
          return direction * (a.totalPlays - b.totalPlays);
        case "momentum":
          return direction * (a.momentum - b.momentum);
        case "entryCount":
          return direction * (a.entryCount - b.entryCount);
        default:
          return 0;
      }
    });
  }, [data, sortKey, sortDirection]);

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    }

    return sortDirection === "asc" ? (
      <TrendingUp className="h-4 w-4 text-emerald-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    );
  };

  const renderTrendChart = (aggregate: ChartAggregate) => {
    if (!aggregate.trendSeries.length) {
      return (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Not enough data to chart trends yet.
        </div>
      );
    }

    const chartData = aggregate.trendSeries.map(point => ({
      ...point,
      dateLabel: new Date(point.date).toLocaleDateString(),
    }));

    return (
      <ChartContainer config={getTrendConfig()} className="h-64 w-full">
        <ComposedChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
          <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={value => numberFormatter.format(Number(value))}
          />
          <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="totalPlays"
            stroke="var(--color-totalPlays)"
            fill="var(--color-totalPlays)"
            fillOpacity={0.25}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="averageRank"
            stroke="var(--color-averageRank)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ChartContainer>
    );
  };

  return (
    <div className="container mx-auto flex flex-col gap-8 p-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <LineChartIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Music Performance Charts</h1>
            <p className="text-muted-foreground">
              Monitor aggregated performance metrics across charts, territories, and genres.
            </p>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Refine the aggregated view to focus on the right market slices.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Chart type</label>
              <Select value={chartType} onValueChange={setChartType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select chart type" />
                </SelectTrigger>
                <SelectContent>
                  {chartTypeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Country</label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countryOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Genre</label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger>
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent>
                  {genreOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Timeframe</label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  {timeframeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Unable to load charts</CardTitle>
            <CardDescription>{error instanceof Error ? error.message : "Unknown error."}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        {isLoading &&
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="p-6">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-4 h-4 w-64" />
              <Skeleton className="mt-6 h-48 w-full" />
            </Card>
          ))}

        {!isLoading && !data?.length && !isError && (
          <Card className="lg:col-span-2">
            <CardContent className="flex h-48 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Globe2 className="h-10 w-10" />
              <p>No aggregated chart data matches your filters yet.</p>
            </CardContent>
          </Card>
        )}

        {sortedAggregates.map(aggregate => {
          const momentumPositive = aggregate.momentum > 0;
          const momentumNegative = aggregate.momentum < 0;

          return (
            <Card key={aggregate.chartType} className="flex flex-col">
              <CardHeader className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{formatChartType(aggregate.chartType)}</CardTitle>
                    <CardDescription>
                      {aggregate.entryCount} entries • Avg rank {aggregate.averageRank.toFixed(2)}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {aggregate.dominantCountry ? aggregate.dominantCountry.toUpperCase() : "Global"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium">
                    {numberFormatter.format(aggregate.totalPlays)} total plays
                  </span>
                  <span className="text-muted-foreground">{aggregate.totalWeeks} cumulative weeks</span>
                  {aggregate.dominantGenre && (
                    <Badge variant="secondary">{aggregate.dominantGenre}</Badge>
                  )}
                  <span
                    className={
                      momentumPositive
                        ? "flex items-center gap-1 text-emerald-500"
                        : momentumNegative
                        ? "flex items-center gap-1 text-red-500"
                        : "flex items-center gap-1 text-muted-foreground"
                    }
                  >
                    {momentumPositive ? <TrendingUp className="h-4 w-4" /> : null}
                    {momentumNegative ? <TrendingDown className="h-4 w-4" /> : null}
                    {!momentumPositive && !momentumNegative ? <ArrowUpDown className="h-4 w-4" /> : null}
                    {aggregate.momentum.toFixed(2)} momentum
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderTrendChart(aggregate)}

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Top songs</h4>
                  <ul className="space-y-2">
                    {aggregate.topSongs.map(song => (
                      <li key={`${aggregate.chartType}-${song.rank}-${song.title}`} className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          #{song.rank} {song.title}
                        </span>
                        <span className="text-muted-foreground">{song.artist}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Top countries</h4>
                  <div className="flex flex-wrap gap-2">
                    {aggregate.topCountries.map(countryStat => (
                      <Badge key={`${aggregate.chartType}-${countryStat.country}`} variant="outline">
                        {countryStat.country.toUpperCase()} • {countryStat.count}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {sortedAggregates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aggregated summary</CardTitle>
            <CardDescription>Sortable overview of key performance signals for each chart group.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      type="button"
                      className="flex items-center gap-2 font-medium"
                      onClick={() => handleSort("chartType")}
                    >
                      Chart
                      {renderSortIndicator("chartType")}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      className="flex items-center gap-2 font-medium"
                      onClick={() => handleSort("averageRank")}
                    >
                      Avg rank
                      {renderSortIndicator("averageRank")}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      className="flex items-center gap-2 font-medium"
                      onClick={() => handleSort("totalPlays")}
                    >
                      Total plays
                      {renderSortIndicator("totalPlays")}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      className="flex items-center gap-2 font-medium"
                      onClick={() => handleSort("momentum")}
                    >
                      Momentum
                      {renderSortIndicator("momentum")}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      type="button"
                      className="flex items-center gap-2 font-medium"
                      onClick={() => handleSort("entryCount")}
                    >
                      Entries
                      {renderSortIndicator("entryCount")}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Lead country</TableHead>
                  <TableHead className="text-right">Lead genre</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAggregates.map(aggregate => (
                  <TableRow key={`table-${aggregate.chartType}`}>
                    <TableCell className="font-medium">{formatChartType(aggregate.chartType)}</TableCell>
                    <TableCell className="text-right">{aggregate.averageRank.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{numberFormatter.format(aggregate.totalPlays)}</TableCell>
                    <TableCell
                      className={
                        aggregate.momentum > 0
                          ? "text-right text-emerald-500"
                          : aggregate.momentum < 0
                          ? "text-right text-red-500"
                          : "text-right text-muted-foreground"
                      }
                    >
                      {aggregate.momentum.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{aggregate.entryCount}</TableCell>
                    <TableCell className="text-right">
                      {aggregate.dominantCountry?.toUpperCase() ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{aggregate.dominantGenre ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ChartsPage;
