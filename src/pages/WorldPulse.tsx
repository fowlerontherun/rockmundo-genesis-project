import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Music,
  Globe,
  Activity,
  Building2,
  Coins,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { WorldNewsList } from "@/components/world/WorldNewsList";

const fmtNum = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString();
const fmtMoney = (n: number | null | undefined) =>
  `$${Number(n ?? 0).toLocaleString()}`;

const EmptyState = ({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) => (
  <div className="text-center py-10 text-muted-foreground">
    <Icon className="h-10 w-10 mx-auto mb-3 opacity-50" />
    <p className="font-medium text-foreground">{title}</p>
    <p className="text-xs mt-1 max-w-sm mx-auto">{body}</p>
  </div>
);

const WorldPulse = () => {
  // ---- Trending artists: real bands ordered by weekly_fans then fame ----
  const { data: trendingArtists = [] } = useQuery({
    queryKey: ["world-pulse-trending"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bands")
        .select("id, name, genre, fame, weekly_fans")
        .order("weekly_fans", { ascending: false, nullsFirst: false })
        .order("fame", { ascending: false, nullsFirst: false })
        .limit(10);
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  // ---- Genre trends: real songs grouped by genre, last 14 days ----
  const { data: genreTrends = [] } = useQuery({
    queryKey: ["world-pulse-genres"],
    queryFn: async () => {
      const now = Date.now();
      const fourteenAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
      const sevenAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: recent } = await supabase
        .from("songs")
        .select("genre, streams, created_at")
        .gte("created_at", fourteenAgo)
        .not("genre", "is", null)
        .limit(2000);

      const buckets = new Map<
        string,
        { recent: number; prior: number; releases: number; streams: number }
      >();
      for (const row of recent ?? []) {
        const g = (row.genre as string) || "Unknown";
        const b =
          buckets.get(g) ??
          { recent: 0, prior: 0, releases: 0, streams: 0 };
        const isRecent = (row.created_at ?? "") >= sevenAgo;
        if (isRecent) b.recent += 1;
        else b.prior += 1;
        b.releases += 1;
        b.streams += Number(row.streams ?? 0);
        buckets.set(g, b);
      }
      return Array.from(buckets.entries())
        .map(([genre, b]) => {
          const change = b.recent - b.prior;
          const direction: "rising" | "falling" | "flat" =
            change > 0 ? "rising" : change < 0 ? "falling" : "flat";
          return { genre, ...b, change, direction };
        })
        .sort((a, b) => b.releases - a.releases)
        .slice(0, 12);
    },
    refetchInterval: 5 * 60_000,
  });

  // ---- City treasuries: real city_treasury joined to cities ----
  const { data: treasuries = [] } = useQuery({
    queryKey: ["world-pulse-treasuries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("city_treasury")
        .select("balance, total_tax_collected, total_spent, cities!inner(name, country, population)")
        .order("balance", { ascending: false })
        .limit(15);
      return data ?? [];
    },
    refetchInterval: 5 * 60_000,
  });

  // ---- Latest global chart entries ----
  const { data: topCharts = [] } = useQuery({
    queryKey: ["world-pulse-charts"],
    queryFn: async () => {
      const { data: latest } = await supabase
        .from("chart_entries")
        .select("chart_date")
        .eq("chart_type", "global")
        .order("chart_date", { ascending: false })
        .limit(1);
      const latestDate = latest?.[0]?.chart_date;
      if (!latestDate) return [];
      const { data } = await supabase
        .from("chart_entries")
        .select("id, rank, plays_count, trend, chart_date, song:songs(title, genre)")
        .eq("chart_type", "global")
        .eq("chart_date", latestDate)
        .order("rank", { ascending: true })
        .limit(10);
      return data ?? [];
    },
    refetchInterval: 5 * 60_000,
  });

  // ---- Real activity feed ----
  const { data: recentActivity = [] } = useQuery({
    queryKey: ["world-pulse-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_feed")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const directionIcon = (d: "rising" | "falling" | "flat") =>
    d === "rising" ? (
      <TrendingUp className="h-3 w-3 text-green-500" />
    ) : d === "falling" ? (
      <TrendingDown className="h-3 w-3 text-red-500" />
    ) : (
      <Minus className="h-3 w-3 text-muted-foreground" />
    );

  return (
    <FMPageScaffold
      title="World Pulse"
      subtitle="Live signals from the Rockmundo world — pulled directly from current game data."
      icon={Globe}
      backTo="/hub/world-social"
    >
      <WorldNewsList limit={8} showViewAllLink={false} />

      <Tabs defaultValue="trending" className="w-full">
        <TabsList>
          <TabsTrigger value="trending">Trending artists</TabsTrigger>
          <TabsTrigger value="genres">Genre trends</TabsTrigger>
          <TabsTrigger value="treasuries">City treasuries</TabsTrigger>
          <TabsTrigger value="charts">Global charts</TabsTrigger>
          <TabsTrigger value="activity">Recent activity</TabsTrigger>
        </TabsList>

        {/* Trending artists */}
        <TabsContent value="trending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Trending artists
              </CardTitle>
              <CardDescription>
                Bands ranked by weekly fans gained, then lifetime fame. Updates as the world plays.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trendingArtists.length > 0 ? (
                <div className="space-y-2">
                  {trendingArtists.map((artist, index) => (
                    <div
                      key={artist.id ?? index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold tabular-nums">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{artist.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {artist.genre ?? "Unknown genre"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium tabular-nums">
                          {fmtNum(artist.weekly_fans)} weekly fans
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {fmtNum(artist.fame)} fame
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Activity}
                  title="No bands gaining traction yet"
                  body="When players start forming bands and playing gigs, the top movers will surface here."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Genre trends */}
        <TabsContent value="genres" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" /> Genre trends
              </CardTitle>
              <CardDescription>
                Real release activity over the last 14 days — current 7 days vs the prior 7.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {genreTrends.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {genreTrends.map((t) => (
                    <div
                      key={t.genre}
                      className="flex items-center justify-between p-2.5 border rounded-lg"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {directionIcon(t.direction)}
                        <span className="font-medium truncate text-sm">{t.genre}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="tabular-nums">
                          {t.releases} releases
                        </span>
                        <Badge variant="outline" className="tabular-nums">
                          {t.change > 0 ? `+${t.change}` : t.change} wow
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Music}
                  title="No recent releases to trend"
                  body="Genre momentum is calculated from real songs released in the last two weeks. Once players start shipping music, the chart fills in."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* City treasuries */}
        <TabsContent value="treasuries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" /> City treasuries
              </CardTitle>
              <CardDescription>
                Top cities by treasury balance — actual funds collected and spent by each mayor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {treasuries.length > 0 ? (
                <div className="space-y-1.5">
                  {treasuries.map((row: any, i: number) => {
                    const city = Array.isArray(row.cities) ? row.cities[0] : row.cities;
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 border rounded-lg"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-medium text-sm truncate w-32">
                            {city?.name ?? "Unknown"}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {city?.country ?? "—"}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            pop {fmtNum(city?.population)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Coins className="h-3 w-3" />
                            <strong className="text-foreground tabular-nums">
                              {fmtMoney(row.balance)}
                            </strong>
                          </span>
                          <span className="tabular-nums">
                            +{fmtMoney(row.total_tax_collected)} in
                          </span>
                          <span className="tabular-nums">
                            -{fmtMoney(row.total_spent)} out
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={Building2}
                  title="No city treasuries seeded yet"
                  body="Once mayors collect taxes from gigs and businesses, the wealthiest cities will rank here."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts */}
        <TabsContent value="charts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" /> Global charts
              </CardTitle>
              <CardDescription>
                Latest published global chart. Filters to the most recent chart date, not just today.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topCharts.length > 0 ? (
                <div className="space-y-2">
                  {topCharts.map((entry: any) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold tabular-nums">
                          {entry.rank}
                        </div>
                        <div>
                          <p className="font-medium">
                            {entry.song?.title ?? "Unknown"}
                          </p>
                          <Badge variant="outline" className="text-[10px]">
                            {entry.song?.genre ?? "Unknown"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
                        {entry.trend === "up" && (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        )}
                        {entry.trend === "down" && (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        {fmtNum(entry.plays_count)} plays
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Music}
                  title="Charts haven't been published yet"
                  body="The global chart runs once enough songs have streaming activity. Check back after the next chart cycle."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" /> Recent activity
              </CardTitle>
              <CardDescription>
                Latest events recorded in the world activity feed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {recentActivity.map((activity: any) => (
                    <div key={activity.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{activity.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">
                              {activity.activity_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(
                                new Date(activity.created_at || ""),
                                { addSuffix: true },
                              )}
                            </span>
                          </div>
                        </div>
                        {activity.earnings ? (
                          <Badge variant="secondary">
                            +{fmtMoney(activity.earnings)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No activity in the feed"
                  body="Player actions like gigs, releases and milestones show up here as they happen."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </FMPageScaffold>
  );
};

export default WorldPulse;
