import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Star, Users, MapPin, Music, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MUSIC_GENRES } from "@/data/genres";

interface BandWithCity {
  id: string;
  name: string;
  genre: string | null;
  fame: number | null;
  total_fans: number | null;
  weekly_fans: number | null;
  logo_url: string | null;
  home_city_id: string | null;
  home_city?: {
    name: string;
    country: string;
  } | null;
}

const ITEMS_PER_PAGE = 20;

export default function BandRankings() {
  const [sortBy, setSortBy] = useState<"fame" | "total_fans" | "weekly_fans">("fame");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Fetch countries from cities table
  const { data: countries } = useQuery({
    queryKey: ["ranking-countries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("country")
        .order("country");
      if (error) throw error;
      const uniqueCountries = [...new Set(data?.map((c) => c.country).filter(Boolean))];
      return uniqueCountries as string[];
    },
  });

  // Fetch cities filtered by country
  const { data: cities } = useQuery({
    queryKey: ["ranking-cities", countryFilter],
    queryFn: async () => {
      let query = supabase.from("cities").select("id, name, country").order("name");
      if (countryFilter !== "all") {
        query = query.eq("country", countryFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch bands with rankings
  const { data: bandsData, isLoading } = useQuery({
    queryKey: ["band-rankings", sortBy, genreFilter, countryFilter, cityFilter, page],
    queryFn: async () => {
      // First get the bands
      let query = supabase
        .from("bands")
        .select("id, name, genre, fame, total_fans, weekly_fans, logo_url, home_city_id", { count: "exact" })
        .eq("status", "active")
        .order(sortBy, { ascending: false, nullsFirst: false });

      if (genreFilter !== "all") {
        query = query.eq("genre", genreFilter);
      }

      if (cityFilter !== "all") {
        query = query.eq("home_city_id", cityFilter);
      }

      const from = (page - 1) * ITEMS_PER_PAGE;
      query = query.range(from, from + ITEMS_PER_PAGE - 1);

      const { data: bands, count, error } = await query;
      if (error) throw error;

      // Fetch home cities for bands that have them
      const cityIds = bands?.map((b) => b.home_city_id).filter(Boolean) as string[];
      let citiesMap: Record<string, { name: string; country: string }> = {};
      
      if (cityIds.length > 0) {
        const { data: citiesData } = await supabase
          .from("cities")
          .select("id, name, country")
          .in("id", cityIds);
        
        citiesData?.forEach((c) => {
          citiesMap[c.id] = { name: c.name, country: c.country };
        });
      }

      // Filter by country if needed (post-query since we join cities)
      let filteredBands = bands?.map((b) => ({
        ...b,
        home_city: b.home_city_id ? citiesMap[b.home_city_id] : null,
      })) as BandWithCity[];

      if (countryFilter !== "all" && cityFilter === "all") {
        filteredBands = filteredBands.filter(
          (b) => b.home_city?.country === countryFilter
        );
      }

      return {
        bands: filteredBands,
        totalCount: count ?? 0,
      };
    },
  });

  const totalPages = Math.ceil((bandsData?.totalCount ?? 0) / ITEMS_PER_PAGE);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500 text-yellow-950">🥇 #1</Badge>;
    if (rank === 2) return <Badge className="bg-gray-300 text-gray-800">🥈 #2</Badge>;
    if (rank === 3) return <Badge className="bg-amber-600 text-amber-50">🥉 #3</Badge>;
    return <Badge variant="outline">#{rank}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Band Rankings
          </h1>
          <p className="text-muted-foreground">Discover the most famous bands in the music world</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Sort By</label>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v as any); setPage(1); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fame">Fame</SelectItem>
                  <SelectItem value="total_fans">Total Fans</SelectItem>
                  <SelectItem value="weekly_fans">Weekly Fans</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Genre</label>
              <Select value={genreFilter} onValueChange={(v) => { setGenreFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genres</SelectItem>
                  {MUSIC_GENRES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Country</label>
              <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); setCityFilter("all"); setPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countries?.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">City</label>
              <Select value={cityFilter} onValueChange={(v) => { setCityFilter(v); setPage(1); }} disabled={!cities?.length}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rankings List */}
      <Card>
        <CardHeader>
          <CardTitle>Top Bands</CardTitle>
          <CardDescription>
            Showing {((page - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(page * ITEMS_PER_PAGE, bandsData?.totalCount ?? 0)} of {bandsData?.totalCount ?? 0} bands
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : bandsData?.bands.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No bands found matching your filters</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {bandsData?.bands.map((band, index) => {
                  const rank = (page - 1) * ITEMS_PER_PAGE + index + 1;
                  return (
                    <Link
                      key={band.id}
                      to={`/band/${band.id}`}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 text-center">
                          {getRankBadge(rank)}
                        </div>
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={band.logo_url ?? undefined} />
                          <AvatarFallback>{band.name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{band.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {band.genre && (
                              <Badge variant="secondary" className="text-xs">{band.genre}</Badge>
                            )}
                            {band.home_city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {band.home_city.name}, {band.home_city.country}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="text-sm text-muted-foreground">Fame</p>
                          <p className="font-bold flex items-center gap-1 justify-end">
                            <Star className="h-4 w-4 text-yellow-500" />
                            {(band.fame ?? 0).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Fans</p>
                          <p className="font-bold flex items-center gap-1 justify-end">
                            <Users className="h-4 w-4" />
                            {(band.total_fans ?? 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
