import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateInGameDate, getMonthName } from "@/utils/gameCalendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Trophy, Gift, Music, Star, Snowflake, Crown, TrendingUp, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const ChristmasCharts = () => {
  const gameDate = useMemo(() => calculateInGameDate(), []);
  const isDecember = gameDate.gameMonth === 12;
  const daysUntilChristmas = isDecember ? Math.max(0, 25 - gameDate.gameDay) : null;
  const isChristmasDay = isDecember && gameDate.gameDay === 25;
  const isAfterChristmas = isDecember && gameDate.gameDay > 25;

  // Fetch current December sales race (aggregate sales per release during this December)
  const { data: decemberRace = [], isLoading: raceLoading } = useQuery({
    queryKey: ["christmas-race", gameDate.gameYear, gameDate.gameMonth],
    queryFn: async () => {
      // We need to compute the real-world date range for in-game December of the current game year
      // Each game month = 10 real days. December is month 12.
      // Game Year Y starts at epoch + (Y-1)*120 real days
      // Month M within that year starts at (M-1)*10 real days into the year
      const epochMs = new Date("2026-01-01T00:00:00Z").getTime();
      const yearStartRealDays = (gameDate.gameYear - 1) * 120;
      const decStartRealDays = yearStartRealDays + (12 - 1) * 10; // month 12
      const decEndRealDays = decStartRealDays + 10; // 10 real days

      const startDate = new Date(epochMs + decStartRealDays * 86400000).toISOString().split("T")[0];
      const endDate = new Date(epochMs + decEndRealDays * 86400000).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("release_sales")
        .select(`
          release_format_id,
          quantity_sold,
          total_amount,
          release_format:release_formats!release_sales_release_format_id_fkey(
            release_id,
            release:releases(
              id, title, artist_name, artwork_url, band_id,
              band:bands(name, artist_name)
            )
          )
        `)
        .gte("sale_date", startDate)
        .lt("sale_date", endDate)
        .order("sale_date", { ascending: false });

      if (error) throw error;

      // Aggregate by release
      const releaseMap = new Map<string, {
        releaseId: string;
        title: string;
        artistName: string;
        artworkUrl: string | null;
        totalUnits: number;
        totalRevenue: number;
      }>();

      for (const sale of data || []) {
        const fmt = sale.release_format as any;
        const rel = fmt?.release;
        if (!rel) continue;

        const key = rel.id;
        const existing = releaseMap.get(key);
        const artist = rel.artist_name || rel.band?.artist_name || rel.band?.name || "Unknown Artist";

        if (existing) {
          existing.totalUnits += sale.quantity_sold || 0;
          existing.totalRevenue += sale.total_amount || 0;
        } else {
          releaseMap.set(key, {
            releaseId: rel.id,
            title: rel.title,
            artistName: artist,
            artworkUrl: rel.artwork_url,
            totalUnits: sale.quantity_sold || 0,
            totalRevenue: sale.total_amount || 0,
          });
        }
      }

      return Array.from(releaseMap.values())
        .sort((a, b) => b.totalUnits - a.totalUnits)
        .slice(0, 50);
    },
    enabled: isDecember,
    refetchInterval: 60000,
  });

  // Fetch past Christmas Number Ones
  const { data: pastWinners = [], isLoading: winnersLoading } = useQuery({
    queryKey: ["christmas-number-ones-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("christmas_number_ones" as any)
        .select("*")
        .order("game_year", { ascending: false });

      if (error) {
        // Table may not exist yet
        console.warn("christmas_number_ones table not available:", error.message);
        return [];
      }
      return data || [];
    },
  });

  const topRelease = decemberRace[0];
  const maxUnits = topRelease?.totalUnits || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/music/charts"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Gift className="h-6 w-6 text-red-500" />
            <h1 className="text-2xl font-bold">Christmas Charts Race</h1>
            <Badge variant="outline" className="border-red-500/40 text-red-400 text-xs">
              Year {gameDate.gameYear}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isDecember
              ? isChristmasDay
                ? "🎄 It's Christmas Day! The Christmas Number One has been crowned!"
                : isAfterChristmas
                  ? "Christmas Number One has been decided for this year!"
                  : `${daysUntilChristmas} game day${daysUntilChristmas !== 1 ? "s" : ""} until Christmas Day — who will be #1?`
              : `The Christmas Charts race begins in ${getMonthName(12)}. Current month: ${getMonthName(gameDate.gameMonth)}.`}
          </p>
        </div>
      </div>

      {!isDecember ? (
        /* Off-season message */
        <Card className="border-dashed border-muted-foreground/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Snowflake className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground">Not December Yet</h2>
            <p className="text-sm text-muted-foreground/70 mt-2 max-w-md">
              The Christmas Charts race runs during in-game December. Release your tracks, build hype,
              and boost sales to compete for the coveted Christmas Number One!
            </p>
            <p className="text-xs text-muted-foreground/50 mt-4">
              Current date: {getMonthName(gameDate.gameMonth)} {gameDate.gameDay}, Year {gameDate.gameYear}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Countdown / Status Banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-xl p-6 border text-center",
              isChristmasDay
                ? "bg-gradient-to-r from-red-500/20 via-green-500/20 to-red-500/20 border-yellow-500/40"
                : "bg-gradient-to-r from-red-500/10 via-background to-green-500/10 border-red-500/20"
            )}
          >
            {isChristmasDay ? (
              <div className="space-y-2">
                <Crown className="h-10 w-10 text-yellow-400 mx-auto" />
                <h2 className="text-2xl font-bold">🎄 Christmas Number One! 🎄</h2>
                {topRelease && (
                  <p className="text-lg">
                    <span className="font-bold text-primary">{topRelease.title}</span>
                    {" by "}
                    <span className="text-muted-foreground">{topRelease.artistName}</span>
                    {" — "}
                    <span className="font-mono font-bold">{topRelease.totalUnits.toLocaleString()} units</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">
                  {daysUntilChristmas === 0 ? "🎅 Christmas Eve!" : `${daysUntilChristmas} days to go`}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Sales during December determine the Christmas Number One. Boost your release hype!
                </p>
                <Progress value={((gameDate.gameDay) / 25) * 100} className="max-w-xs mx-auto h-2" />
              </div>
            )}
          </motion.div>

          {/* Current Race Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                December Sales Race
              </CardTitle>
              <CardDescription>
                Top-selling releases this December — updated live
              </CardDescription>
            </CardHeader>
            <CardContent>
              {raceLoading ? (
                <div className="space-y-3">
                  {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : decemberRace.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Music className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No sales recorded yet this December.</p>
                  <p className="text-xs mt-1">Release a single or album to start competing!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {decemberRace.map((release, index) => {
                      const barWidth = (release.totalUnits / maxUnits) * 100;
                      const isTop = index === 0;
                      const isTopThree = index < 3;

                      return (
                        <motion.div
                          key={release.releaseId}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className={cn(
                            "relative flex items-center gap-3 rounded-lg px-3 py-3 transition-colors",
                            isTop && "bg-yellow-500/10 border border-yellow-500/30",
                            !isTop && isTopThree && "bg-muted/40",
                            !isTopThree && "hover:bg-muted/20"
                          )}
                        >
                          {/* Position */}
                          <div className={cn(
                            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                            isTop && "bg-yellow-500 text-yellow-950",
                            index === 1 && "bg-gray-300 text-gray-800",
                            index === 2 && "bg-amber-700 text-amber-100",
                            index > 2 && "bg-muted text-muted-foreground"
                          )}>
                            {index + 1}
                          </div>

                          {/* Artwork */}
                          {release.artworkUrl ? (
                            <img
                              src={release.artworkUrl}
                              alt={release.title}
                              className="h-10 w-10 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <Music className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={cn("font-semibold truncate text-sm", isTop && "text-yellow-400")}>
                                {release.title}
                              </p>
                              {isTop && <Crown className="h-4 w-4 text-yellow-400 flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{release.artistName}</p>
                            {/* Sales bar */}
                            <div className="mt-1 h-1.5 w-full max-w-[200px] rounded-full bg-muted overflow-hidden">
                              <motion.div
                                className={cn(
                                  "h-full rounded-full",
                                  isTop ? "bg-yellow-500" : isTopThree ? "bg-primary" : "bg-primary/50"
                                )}
                                initial={{ width: 0 }}
                                animate={{ width: `${barWidth}%` }}
                                transition={{ duration: 0.6, delay: index * 0.05 }}
                              />
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="text-right flex-shrink-0">
                            <p className="font-mono font-bold text-sm">{release.totalUnits.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">units</p>
                          </div>
                          <div className="text-right flex-shrink-0 hidden sm:block">
                            <p className="font-mono text-xs text-muted-foreground">
                              ${release.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Past Christmas Number Ones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Christmas Number One History
          </CardTitle>
          <CardDescription>Past winners of the coveted Christmas #1 spot</CardDescription>
        </CardHeader>
        <CardContent>
          {winnersLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : pastWinners.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No Christmas Number Ones recorded yet.</p>
              <p className="text-xs mt-1">The first one will be crowned on December 25th, Year 1.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pastWinners.map((winner: any) => (
                <div key={winner.id} className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-3">
                  <Crown className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Year {winner.game_year}</p>
                    <p className="text-xs text-muted-foreground">
                      {winner.total_sales?.toLocaleString() || 0} units sold
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">
                    🎄 #1
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChristmasCharts;
