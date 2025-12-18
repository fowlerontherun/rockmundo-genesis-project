import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Globe2, ListChecks, Radio, Music, Users, Star, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/dashboard/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";

const YEAR_OPTIONS = ["all", 2025, 2024, 2023] as const;

const formatYearLabel = (value: (typeof YEAR_OPTIONS)[number]) =>
  value === "all" ? "All time" : value.toString();

const OverviewPage = () => {
  const { t } = useTranslation();
  const [year, setYear] = useState<(typeof YEAR_OPTIONS)[number]>("all");

  // Fetch aggregate game stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ["overview-stats", year],
    queryFn: async () => {
      const yearFilter = year !== "all" ? year : null;

      // Get total bands
      const { count: totalBands } = await supabase
        .from("bands")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Get total players
      const { count: totalPlayers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Get total songs
      const { count: totalSongs } = await supabase
        .from("songs")
        .select("*", { count: "exact", head: true });

      // Get total gigs completed
      const { count: totalGigs } = await supabase
        .from("gig_outcomes")
        .select("*", { count: "exact", head: true });

      // Get top bands by fame
      const { data: topBands } = await supabase
        .from("bands")
        .select("id, name, genre, fame, total_fans")
        .eq("status", "active")
        .order("fame", { ascending: false })
        .limit(5);

      // Get top players by fame
      const { data: topPlayers } = await supabase
        .from("profiles")
        .select("id, display_name, username, fame, fans")
        .order("fame", { ascending: false })
        .limit(5);

      // Get radio submissions count
      const { count: radioSubmissions } = await supabase
        .from("radio_submissions")
        .select("*", { count: "exact", head: true });

      // Get chart entries count
      const { count: chartEntries } = await supabase
        .from("chart_entries")
        .select("*", { count: "exact", head: true });

      // Get bands by country (from band members' cities)
      const { data: bandsByGenre } = await supabase
        .from("bands")
        .select("genre")
        .eq("status", "active")
        .not("genre", "is", null);

      const genreCounts = new Map<string, number>();
      bandsByGenre?.forEach(band => {
        if (band.genre) {
          genreCounts.set(band.genre, (genreCounts.get(band.genre) || 0) + 1);
        }
      });

      const topGenres = Array.from(genreCounts.entries())
        .map(([genre, count]) => ({ genre, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalBands: totalBands || 0,
        totalPlayers: totalPlayers || 0,
        totalSongs: totalSongs || 0,
        totalGigs: totalGigs || 0,
        radioSubmissions: radioSubmissions || 0,
        chartEntries: chartEntries || 0,
        topBands: topBands || [],
        topPlayers: topPlayers || [],
        topGenres,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground">
            Game statistics and leaderboards at a glance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">Year</div>
          <Select
            value={year.toString()}
            onValueChange={value =>
              setYear(value === "all" ? "all" : (Number(value) as (typeof YEAR_OPTIONS)[number]))
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map(option => (
                <SelectItem key={option.toString()} value={option.toString()}>
                  {formatYearLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              title="Active Bands"
              value={stats?.totalBands || 0}
              description="Bands currently active"
              icon={<Music className="h-4 w-4" />}
            />
            <StatCard
              title="Total Players"
              value={stats?.totalPlayers || 0}
              description="Registered musicians"
              icon={<Users className="h-4 w-4" />}
            />
            <StatCard
              title="Songs Created"
              value={stats?.totalSongs || 0}
              description="Original compositions"
              icon={<Music className="h-4 w-4" />}
            />
            <StatCard
              title="Gigs Completed"
              value={stats?.totalGigs || 0}
              description="Live performances"
              icon={<Star className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Leaderboards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Bands */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Bands by Fame
            </CardTitle>
            <CardDescription>Most famous bands in the game</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : stats?.topBands && stats.topBands.length > 0 ? (
              <div className="space-y-3">
                {stats.topBands.map((band, index) => (
                  <div
                    key={band.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{band.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {band.genre || "No genre"} • {band.total_fans || 0} fans
                        </p>
                      </div>
                    </div>
                    <div className="text-lg font-semibold">{band.fame || 0}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border p-6 text-center text-muted-foreground">
                No bands found yet. Create a band to get started!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Players */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Top Players by Fame
            </CardTitle>
            <CardDescription>Most famous musicians</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : stats?.topPlayers && stats.topPlayers.length > 0 ? (
              <div className="space-y-3">
                {stats.topPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{player.display_name || player.username || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          {player.fans || 0} fans
                        </p>
                      </div>
                    </div>
                    <div className="text-lg font-semibold">{player.fame || 0}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border p-6 text-center text-muted-foreground">
                No players found yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Genre Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Popular Genres
          </CardTitle>
          <CardDescription>Most common genres among active bands</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : stats?.topGenres && stats.topGenres.length > 0 ? (
            <div className="space-y-2">
              {stats.topGenres.map((item) => (
                <div
                  key={item.genre}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <p className="font-medium">{item.genre}</p>
                  </div>
                  <div className="text-sm font-semibold">{item.count} bands</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">
              No genre data available yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Radio Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.radioSubmissions || 0}</div>
            <p className="text-sm text-muted-foreground">Total radio submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Chart Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.chartEntries || 0}</div>
            <p className="text-sm text-muted-foreground">Songs on the charts</p>
          </CardContent>
        </Card>
      </div>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Data updates automatically as players create content and perform.
      </p>
    </div>
  );
};

export default OverviewPage;
