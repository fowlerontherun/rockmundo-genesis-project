import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeGrid } from "@/components/achievements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  fetchLeaderboardSeasons,
  fetchSeasonBadges,
  fetchSeasonStandings,
  fetchSeasonSummary,
  type LeaderboardBadge,
  type LeaderboardSeasonRecord,
  type LeaderboardStanding,
  type LeaderboardSeasonSummary,
} from "@/lib/api/leaderboards";
import { cn } from "@/lib/utils";
import { Calendar, Crown, Filter, Sparkles, Trophy, TrendingUp, Users } from "lucide-react";

const DIVISION_OPTIONS = [
  { value: "global", label: "Global" },
  { value: "regional", label: "Regional" },
  { value: "instrument", label: "Instrument" },
];

const REGION_OPTIONS = [
  { value: "global", label: "All Regions" },
  { value: "americas", label: "Americas" },
  { value: "europe", label: "Europe" },
  { value: "asia", label: "Asia" },
  { value: "oceania", label: "Oceania" },
];

const INSTRUMENT_OPTIONS = [
  { value: "all", label: "All Instruments" },
  { value: "vocals", label: "Vocals" },
  { value: "guitar", label: "Guitar" },
  { value: "bass", label: "Bass" },
  { value: "drums", label: "Drums" },
  { value: "keys", label: "Keys" },
];

const TIER_OPTIONS = [
  { value: "all", label: "All Tiers" },
  { value: "bronze", label: "Bronze" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
  { value: "platinum", label: "Platinum" },
  { value: "diamond", label: "Diamond" },
];

const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
  return new Intl.NumberFormat("en-US", options).format(value);
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDateRange = (season: LeaderboardSeasonRecord) => {
  const start = new Date(season.start_date).toLocaleDateString();
  const end = new Date(season.end_date).toLocaleDateString();
  return `${start} – ${end}`;
};

const getInitials = (displayName?: string | null, username?: string | null) => {
  const source = displayName || username || "";
  if (!source) return "?";
  return source
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const FilterSelect = ({
  label,
  value,
  onValueChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) => {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const SummaryMetric = ({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <Icon className="h-5 w-5 text-primary" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-semibold">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

const StandingsSkeleton = () => (
  <div className="space-y-2">
    {Array.from({ length: 6 }).map((_, index) => (
      <Skeleton key={index} className="h-16 w-full rounded-lg" />
    ))}
  </div>
);

const BadgeSection = ({ badges, loading }: { badges: LeaderboardBadge[]; loading: boolean }) => {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return <BadgeGrid badges={badges} showSeasonLabel />;
};

const CompetitiveLeaderboards = () => {
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [division, setDivision] = useState("global");
  const [region, setRegion] = useState("global");
  const [instrument, setInstrument] = useState("all");
  const [tier, setTier] = useState("all");

  const {
    data: seasons,
    isLoading: seasonsLoading,
    isError: seasonsError,
  } = useQuery({
    queryKey: ["leaderboard-seasons"],
    queryFn: fetchLeaderboardSeasons,
  });

  useEffect(() => {
    if (!activeSeasonId && seasons && seasons.length) {
      const activeSeason = seasons.find(season => (season as any).status === "active");
      setActiveSeasonId(activeSeason?.id ?? seasons[0].id);
    }
  }, [seasons, activeSeasonId]);

  const seasonFilters = useMemo(
    () => ({ division, region, instrument, tier }),
    [division, region, instrument, tier]
  );

  const {
    data: standings,
    isLoading: standingsLoading,
  } = useQuery({
    queryKey: ["leaderboard-standings", activeSeasonId, seasonFilters],
    queryFn: () =>
      activeSeasonId
        ? fetchSeasonStandings(activeSeasonId, seasonFilters)
        : Promise.resolve<LeaderboardStanding[]>([]),
    enabled: Boolean(activeSeasonId),
  });

  const {
    data: summary,
    isLoading: summaryLoading,
  } = useQuery({
    queryKey: ["leaderboard-summary", activeSeasonId, seasonFilters],
    queryFn: () =>
      activeSeasonId
        ? fetchSeasonSummary(activeSeasonId, seasonFilters)
        : Promise.resolve<LeaderboardSeasonSummary>({
            totalPlayers: 0,
            averageScore: 0,
            averageFame: 0,
            averageExperience: 0,
            totalRevenue: 0,
            totalGigs: 0,
            totalAchievements: 0,
          }),
    enabled: Boolean(activeSeasonId),
  });

  const {
    data: badges,
    isLoading: badgesLoading,
  } = useQuery({
    queryKey: ["leaderboard-badges", activeSeasonId],
    queryFn: () => (activeSeasonId ? fetchSeasonBadges(activeSeasonId) : Promise.resolve<LeaderboardBadge[]>([])),
    enabled: Boolean(activeSeasonId),
  });

  const activeSeason = seasons?.find(season => season.id === activeSeasonId) ?? null;

  const seasonBadges = useMemo(
    () => (badges ?? []).filter(badge => badge.season_id === activeSeasonId),
    [badges, activeSeasonId]
  );
  const lifetimeBadges = useMemo(
    () => (badges ?? []).filter(badge => badge.season_id === null),
    [badges]
  );

  const resetFilters = () => {
    setDivision("global");
    setRegion("global");
    setInstrument("all");
    setTier("all");
  };

  return (
    <div className="container mx-auto space-y-8 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Competitive Leaderboards</h1>
          <p className="text-muted-foreground">
            Track seasonal standings, analyze rivals, and chase exclusive prestige badges across Rockmundo competitions.
          </p>
        </div>
        {activeSeason && (
          <Badge variant="secondary" className="w-fit gap-2">
            <Calendar className="h-4 w-4" />
            {formatDateRange(activeSeason)}
          </Badge>
        )}
      </div>

      {seasonsLoading && (
        <Card>
          <CardContent className="space-y-4 py-6">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      )}

      {seasonsError && (
        <Card>
          <CardContent className="py-6 text-center text-red-500">
            Failed to load leaderboard seasons. Please try again later.
          </CardContent>
        </Card>
      )}

      {seasons && seasons.length > 0 && (
        <Tabs value={activeSeasonId ?? ""} onValueChange={setActiveSeasonId}>
          <TabsList className="flex h-auto flex-wrap gap-2 overflow-x-auto bg-transparent p-0">
            {seasons.map(season => (
              <TabsTrigger
                key={season.id}
                value={season.id}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm",
                  season.id === activeSeasonId ? "border-primary bg-primary/10" : "border-border"
                )}
              >
                <span className="font-medium">{season.name}</span>
                {(season as any).status === "active" && <Badge className="ml-2" variant="secondary">Active</Badge>}
                {(season as any).status === "upcoming" && <Badge className="ml-2" variant="outline">Upcoming</Badge>}
              </TabsTrigger>
            ))}
          </TabsList>

          {seasons.map(season => (
            <TabsContent key={season.id} value={season.id} className="mt-6 space-y-8">
              {season.id !== activeSeasonId ? (
                <div className="py-12 text-center text-muted-foreground">Switching seasons…</div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                    <Card className="h-full">
                      <CardHeader className="border-b pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Filter className="h-4 w-4" />
                          Filters
                        </CardTitle>
                        <CardDescription>Fine-tune the standings to analyze your competition.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 py-4">
                        <FilterSelect label="Division" value={division} onValueChange={setDivision} options={DIVISION_OPTIONS} />
                        <FilterSelect
                          label="Region"
                          value={region}
                          onValueChange={setRegion}
                          options={REGION_OPTIONS}
                          disabled={division !== "regional"}
                        />
                        <FilterSelect
                          label="Instrument"
                          value={instrument}
                          onValueChange={setInstrument}
                          options={INSTRUMENT_OPTIONS}
                          disabled={division !== "instrument"}
                        />
                        <FilterSelect label="Tier" value={tier} onValueChange={setTier} options={TIER_OPTIONS} />
                        <Button variant="ghost" onClick={resetFilters} className="w-full">
                          Reset filters
                        </Button>
                      </CardContent>
                    </Card>

                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {summaryLoading ? (
                          Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} className="h-32 w-full rounded-xl" />
                          ))
                        ) : summary ? (
                          <>
                            <SummaryMetric
                              title="Total competitors"
                              value={formatNumber(summary.totalPlayers)}
                              description="Profiles tracked in this bracket"
                              icon={Users}
                            />
                            <SummaryMetric
                              title="Average score"
                              value={formatNumber(Math.round(summary.averageScore))}
                              description="Composite leaderboard rating"
                              icon={TrendingUp}
                            />
                            <SummaryMetric
                              title="Revenue generated"
                              value={formatCurrency(Math.round(summary.totalRevenue))}
                              description="Seasonal earnings across competitors"
                              icon={Crown}
                            />
                            <SummaryMetric
                              title="Achievements unlocked"
                              value={formatNumber(summary.totalAchievements)}
                              description="Total badges earned during the season"
                              icon={Sparkles}
                            />
                          </>
                        ) : (
                          <SummaryMetric
                            title="Total competitors"
                            value="0"
                            description="Profiles tracked in this bracket"
                            icon={Users}
                          />
                        )}
                      </div>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Trophy className="h-5 w-5" />
                            Standings
                          </CardTitle>
                          <CardDescription>
                            Live placement snapshots pulled from the season scoreboard view and aggregated performance metrics.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {standingsLoading ? (
                            <StandingsSkeleton />
                          ) : standings && standings.length > 0 ? (
                            <ScrollArea className="h-[480px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-16">Rank</TableHead>
                                    <TableHead>Competitor</TableHead>
                                    <TableHead className="text-right">Score</TableHead>
                                    <TableHead className="text-right">Revenue</TableHead>
                                    <TableHead className="text-right">Gigs</TableHead>
                                    <TableHead className="text-right">Achievements</TableHead>
                                    <TableHead className="text-right">Fame</TableHead>
                                    <TableHead className="text-right">Experience</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {standings.map((standing, index) => {
                                    const rank = standing.finalRank ?? index + 1;
                                    return (
                                      <TableRow key={standing.id}>
                                        <TableCell className="font-semibold">#{rank}</TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                              <AvatarImage src={standing.profile?.avatarUrl ?? undefined} alt={standing.profile?.displayName ?? standing.profile?.username ?? "Competitor"} />
                                              <AvatarFallback>
                                                {getInitials(standing.profile?.displayName, standing.profile?.username)}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div className="space-y-1">
                                              <p className="text-sm font-semibold leading-none">
                                                {standing.profile?.displayName || standing.profile?.username || "Unknown competitor"}
                                              </p>
                                              <p className="text-xs text-muted-foreground capitalize">
                                                {standing.division} • {standing.region}
                                              </p>
                                            </div>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                          {standing.finalScore !== null && standing.finalScore !== undefined
                                            ? formatNumber(Math.round(standing.finalScore))
                                            : "–"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {standing.totalRevenue !== null && standing.totalRevenue !== undefined
                                            ? formatCurrency(Math.round(standing.totalRevenue))
                                            : "–"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {standing.totalGigs !== null && standing.totalGigs !== undefined
                                            ? formatNumber(standing.totalGigs)
                                            : "–"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {standing.totalAchievements !== null && standing.totalAchievements !== undefined
                                            ? formatNumber(standing.totalAchievements)
                                            : "–"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {standing.fame !== null && standing.fame !== undefined
                                            ? formatNumber(Math.round(standing.fame))
                                            : "–"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {standing.experience !== null && standing.experience !== undefined
                                            ? formatNumber(Math.round(standing.experience))
                                            : "–"}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          ) : (
                            <div className="py-12 text-center text-muted-foreground">
                              No standings data is available for this filter set yet.
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-semibold">Season-exclusive badges</h2>
                      </div>
                      <BadgeSection badges={seasonBadges} loading={badgesLoading} />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <h2 className="text-xl font-semibold">Lifetime prestige badges</h2>
                      </div>
                      <BadgeSection badges={lifetimeBadges} loading={badgesLoading} />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

export default CompetitiveLeaderboards;
