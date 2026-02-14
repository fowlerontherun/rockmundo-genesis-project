import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/use-auth-context";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Star, 
  Users, 
  DollarSign, 
  MapPin, 
  Heart, 
  Zap, 
  TrendingUp,
  Music,
  Mic,
  Calendar,
  Trophy,
  Clock,
  Globe,
  Search
} from "lucide-react";
import { CountryFlag } from "@/components/location/CountryFlag";

interface OverviewTabsProps {
  profile: any;
  currentCity: any;
}

export const DashboardOverviewTabs = ({ profile, currentCity }: OverviewTabsProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: primaryBand } = usePrimaryBand();
  const [citySearch, setCitySearch] = useState("");

  // Fetch all cities
  const { data: allCities } = useQuery({
    queryKey: ["dashboard-all-cities"],
    queryFn: async () => {
      const client: any = supabase;
      const { data } = await client
        .from("cities")
        .select("id, name, country, music_scene")
        .order("country", { ascending: true })
        .order("name", { ascending: true });
      return data || [];
    },
    staleTime: 300000
  });

  // Fetch career stats
  const { data: careerStats } = useQuery({
    queryKey: ["dashboard-career-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const client: any = supabase;
      const gigsResult = await client.from("gig_outcomes").select("id").eq("user_id", user.id);
      const songsResult = await client.from("songs").select("id, status").eq("original_writer_id", user.id);

      const totalGigs = gigsResult.data?.length || 0;
      const totalSongs = songsResult.data?.length || 0;
      const recordedSongs = songsResult.data?.filter((s: any) => s.status === 'recorded').length || 0;

      return { totalGigs, totalSongs, recordedSongs, totalStreams: 0 };
    },
    enabled: !!user?.id,
    staleTime: 60000
  });

  // Fetch upcoming events
  const { data: upcomingEvents } = useQuery({
    queryKey: ["dashboard-upcoming-events", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const now = new Date().toISOString();
      const client: any = supabase;
      const { data } = await client
        .from("gigs")
        .select("id, venue_id, scheduled_time, status, venues(name)")
        .eq("status", "scheduled")
        .gte("scheduled_time", now)
        .order("scheduled_time", { ascending: true })
        .limit(3);
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 30000
  });

  // Fetch financial summary
  const { data: financialSummary } = useQuery({
    queryKey: ["dashboard-financial-summary", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const client: any = supabase;
      const { data: earnings } = await client
        .from("band_earnings")
        .select("amount, source")
        .eq("earned_by_user_id", user.id)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      const weeklyEarnings = earnings?.reduce((acc: number, e: any) => acc + (e.amount || 0), 0) || 0;
      return { weeklyEarnings };
    },
    enabled: !!user?.id,
    staleTime: 60000
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // Extract band data from nested structure
  const bandData = primaryBand?.bands;

  return (
    <Tabs defaultValue="quick" className="w-full">
      <TabsList className="grid w-full grid-cols-4 h-auto">
        <TabsTrigger value="quick" className="flex items-center gap-1 text-xs py-2">
          <Star className="h-3 w-3" />
          <span className="hidden sm:inline">Quick Stats</span>
          <span className="sm:hidden">Stats</span>
        </TabsTrigger>
        <TabsTrigger value="career" className="flex items-center gap-1 text-xs py-2">
          <Trophy className="h-3 w-3" />
          <span className="hidden sm:inline">Career</span>
          <span className="sm:hidden">Career</span>
        </TabsTrigger>
        <TabsTrigger value="finances" className="flex items-center gap-1 text-xs py-2">
          <DollarSign className="h-3 w-3" />
          <span className="hidden sm:inline">Finances</span>
          <span className="sm:hidden">$</span>
        </TabsTrigger>
        <TabsTrigger value="location" className="flex items-center gap-1 text-xs py-2">
          <MapPin className="h-3 w-3" />
          <span className="hidden sm:inline">Location</span>
          <span className="sm:hidden">City</span>
        </TabsTrigger>
      </TabsList>

      {/* Quick Stats Tab */}
      <TabsContent value="quick" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Fame</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatNumber(profile?.fame || 0)}</p>
            </CardContent>
          </Card>

          <Card className="bg-secondary/10 border-secondary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-secondary-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Fans</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatNumber(profile?.fans || 0)}</p>
            </CardContent>
          </Card>

          <Card className="bg-warning/10 border-warning/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-warning" />
                <span className="text-xs text-muted-foreground font-medium">Cash</span>
              </div>
              <p className="text-2xl font-bold text-foreground">${formatNumber(profile?.cash || 0)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Level</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{profile?.level || 1}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-muted-foreground font-medium">Health</span>
                </div>
                <span className="text-sm font-bold text-foreground">{profile?.health || 100}%</span>
              </div>
              <Progress value={profile?.health || 100} className="h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-warning" />
                  <span className="text-xs text-muted-foreground font-medium">Energy</span>
                </div>
                <span className="text-sm font-bold text-foreground">{profile?.energy || 100}%</span>
              </div>
              <Progress value={profile?.energy || 100} className="h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Band Summary */}
        {bandData && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Current Band
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{bandData.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(bandData.fame || 0)} fame • {formatNumber(bandData.weekly_fans || 0)} weekly fans
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/band">View</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Career Tab */}
      <TabsContent value="career" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mic className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Gigs Played</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{careerStats?.totalGigs || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Music className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Songs Written</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{careerStats?.totalSongs || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Music className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Recorded</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{careerStats?.recordedSongs || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Total Streams</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatNumber(careerStats?.totalStreams || 0)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time Played
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold text-foreground">
              {((profile?.total_hours_played || 0)).toFixed(1)} hours
            </p>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        {upcomingEvents && upcomingEvents.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {upcomingEvents.map((event: any) => (
                <div key={event.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">{(event.venues as any)?.name || 'Unknown Venue'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.scheduled_time).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline">{event.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Finances Tab */}
      <TabsContent value="finances" className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-success/10 border-success/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-success" />
                <span className="text-xs text-muted-foreground font-medium">Cash Balance</span>
              </div>
              <p className="text-2xl font-bold text-foreground">${formatNumber(profile?.cash || 0)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Weekly Earnings</span>
              </div>
              <p className="text-2xl font-bold text-foreground">${formatNumber(financialSummary?.weeklyEarnings || 0)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">View full financial dashboard</span>
              <Button variant="outline" size="sm" asChild>
                <Link to="/finances">Finances</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Location Tab */}
      <TabsContent value="location" className="space-y-4 mt-4">
        {currentCity ? (
          <>
            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Current Location</span>
                </div>
                <div className="flex items-center gap-2">
                  <CountryFlag country={currentCity.country} size="md" showTooltip={false} />
                  <div>
                    <p className="text-xl font-bold text-foreground">{currentCity.name}</p>
                    <p className="text-sm text-muted-foreground">{currentCity.country}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Music className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Music Scene</span>
                  </div>
                  <p className="text-sm font-medium text-foreground capitalize">{currentCity.music_scene || 'Unknown'}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Timezone</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{currentCity.timezone || 'UTC'}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Explore the city</span>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/cities/${currentCity.id}`}>View City</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* All Cities with Country Flags */}
            {allCities && allCities.length > 0 && (() => {
              const filtered = citySearch
                ? allCities.filter((c: any) =>
                    c.name.toLowerCase().includes(citySearch.toLowerCase()) ||
                    c.country.toLowerCase().includes(citySearch.toLowerCase())
                  )
                : allCities;
              const grouped = filtered.reduce((acc: Record<string, any[]>, city: any) => {
                const country = city.country || "Unknown";
                if (!acc[country]) acc[country] = [];
                acc[country].push(city);
                return acc;
              }, {} as Record<string, any[]>);
              const sortedCountries = Object.keys(grouped).sort();

              return (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      All Cities ({allCities.length})
                    </CardTitle>
                    <div className="relative mt-2">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search cities or countries..."
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        {sortedCountries.map((country) => (
                          <div key={country}>
                            <div className="flex items-center gap-2 mb-1.5 sticky top-0 bg-card py-1 z-10">
                              <CountryFlag country={country} size="sm" showTooltip={false} />
                              <span className="text-xs font-semibold text-foreground">{country}</span>
                              <span className="text-[10px] text-muted-foreground">({grouped[country].length})</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1 ml-6">
                              {grouped[country].map((city: any) => (
                                <Link
                                  key={city.id}
                                  to={`/cities/${city.id}`}
                                  className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate py-0.5"
                                >
                                  {city.name}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                        {sortedCountries.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">No cities found</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              );
            })()}
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No location set</p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <Link to="/travel">Travel</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
};

export default DashboardOverviewTabs;
