import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/ui/PageLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CountryFlag } from "@/components/location/CountryFlag";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { getBandFameTitle, BAND_FAME_THRESHOLDS } from "@/utils/bandFame";
import {
  Globe,
  MapPin,
  Users,
  Star,
  Crown,
  Heart,
  Flame,
  BarChart3,
  History as HistoryIcon,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
} from "lucide-react";

const fmt = (n: number) => {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

type SortKey = "fame" | "fans";

export default function BandFameMap() {
  const { profileId } = useActiveProfile();
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [countrySort, setCountrySort] = useState<SortKey>("fame");
  const [citySort, setCitySort] = useState<SortKey>("fans");
  const [demoCountry, setDemoCountry] = useState<string>("__all__");
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  // Bands the player belongs to
  const { data: bands = [], isLoading: bandsLoading } = useQuery({
    queryKey: ["my-bands-for-fame-map", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("band_members")
        .select("band_id, bands:bands!band_members_band_id_fkey(id, name, status)")
        .eq("profile_id", profileId)
        .eq("member_status", "active");
      if (error) throw error;
      return (data || [])
        .map((row: any) => row.bands)
        .filter((b: any) => b && b.status === "active") as Array<{
        id: string;
        name: string;
      }>;
    },
    enabled: !!profileId,
  });

  const bandId = selectedBandId || bands[0]?.id || null;

  const { data: band } = useQuery({
    queryKey: ["band-fame-map-band", bandId],
    queryFn: async () => {
      if (!bandId) return null;
      const { data, error } = await supabase
        .from("bands")
        .select(
          "id, name, fame, total_fans, casual_fans, dedicated_fans, superfans, global_fame"
        )
        .eq("id", bandId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!bandId,
  });

  const { data: countryFans = [] } = useQuery({
    queryKey: ["fame-map-country-fans", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_country_fans")
        .select("*")
        .eq("band_id", bandId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId,
  });

  const { data: cityFans = [] } = useQuery({
    queryKey: ["fame-map-city-fans", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_city_fans")
        .select("*")
        .eq("band_id", bandId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId,
  });

  const { data: demoFansRaw = [] } = useQuery({
    queryKey: ["fame-map-demo-fans", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_demographic_fans")
        .select("demographic_id, fan_count, engagement_rate, country, city_id, age_demographics(name)")
        .eq("band_id", bandId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId,
  });

  const { data: fameEvents = [] } = useQuery({
    queryKey: ["fame-map-events", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_fame_events")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
    enabled: !!bandId,
  });

  const sortedCountries = useMemo(() => {
    const arr = [...countryFans];
    arr.sort((a: any, b: any) =>
      countrySort === "fame"
        ? (b.fame || 0) - (a.fame || 0)
        : (b.total_fans || 0) - (a.total_fans || 0)
    );
    return arr;
  }, [countryFans, countrySort]);

  const sortedCities = useMemo(() => {
    const arr = [...cityFans];
    arr.sort((a: any, b: any) =>
      citySort === "fame"
        ? (b.city_fame || 0) - (a.city_fame || 0)
        : (b.total_fans || 0) - (a.total_fans || 0)
    );
    return arr;
  }, [cityFans, citySort]);

  const citiesByCountry = useMemo(() => {
    const map: Record<string, any[]> = {};
    cityFans.forEach((c: any) => {
      const k = c.country || "Unknown";
      (map[k] = map[k] || []).push(c);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => (b.total_fans || 0) - (a.total_fans || 0))
    );
    return map;
  }, [cityFans]);

  const demoAggregated = useMemo(() => {
    const filtered = demoFansRaw.filter((d: any) =>
      demoCountry === "__all__" ? true : d.country === demoCountry
    );
    const agg: Record<string, { id: string; name: string; fans: number }> = {};
    filtered.forEach((d: any) => {
      const id = d.demographic_id;
      if (!agg[id]) {
        agg[id] = {
          id,
          name: d.age_demographics?.name || "Unknown",
          fans: 0,
        };
      }
      agg[id].fans += d.fan_count || 0;
    });
    return Object.values(agg).sort((a, b) => b.fans - a.fans);
  }, [demoFansRaw, demoCountry]);

  const totalDemoFans = demoAggregated.reduce((s, d) => s + d.fans, 0);

  const performedCount = countryFans.filter((c: any) => c.has_performed).length;

  if (bandsLoading) {
    return (
      <PageLayout>
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </PageLayout>
    );
  }

  if (!bands.length || !bandId) {
    return (
      <PageLayout>
        <PageHeader
          title="Fame Map"
          subtitle="Global popularity & demographic breakdown"
          icon={Globe}
          backTo="/hub/band"
          backLabel="Band Hub"
        />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            You need to be in an active band to view the Fame Map.
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  const globalFame = band?.global_fame || band?.fame || 0;
  const fameTitle = getBandFameTitle(globalFame);
  const thresholds = Object.entries(BAND_FAME_THRESHOLDS).sort((a, b) => a[1] - b[1]);
  const nextIdx = thresholds.findIndex(([_, v]) => globalFame < v);
  const next = nextIdx >= 0 ? thresholds[nextIdx] : thresholds[thresholds.length - 1];
  const prev = nextIdx > 0 ? thresholds[nextIdx - 1] : ["", 0] as [string, number];
  const tierProgress =
    next[1] > prev[1]
      ? Math.min(100, ((globalFame - prev[1]) / (next[1] - prev[1])) * 100)
      : 100;

  const top10Fame = [...countryFans]
    .sort((a: any, b: any) => (b.fame || 0) - (a.fame || 0))
    .slice(0, 10);
  const top10Fans = [...countryFans]
    .sort((a: any, b: any) => (b.total_fans || 0) - (a.total_fans || 0))
    .slice(0, 10);
  const maxTopFame = top10Fame[0]?.fame || 1;
  const maxTopFans = top10Fans[0]?.total_fans || 1;

  return (
    <PageLayout>
      <PageHeader
        title="Fame Map"
        subtitle={band?.name ? `${band.name} • Global popularity & demographics` : "Global popularity & demographics"}
        icon={Globe}
        backTo="/hub/band"
        backLabel="Band Hub"
        actions={
          bands.length > 1 ? (
            <Select value={bandId} onValueChange={setSelectedBandId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        }
      />

      {/* Summary */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryStat icon={Star} color="text-yellow-500" label="Global Fame" value={fmt(globalFame)} />
            <SummaryStat icon={Users} color="text-blue-500" label="Total Fans" value={fmt(band?.total_fans || 0)} />
            <SummaryStat icon={Globe} color="text-green-500" label="Countries" value={String(countryFans.length)} />
            <SummaryStat icon={MapPin} color="text-orange-500" label="Cities" value={String(cityFans.length)} />
            <SummaryStat icon={Crown} color="text-amber-500" label="Superfans" value={fmt(band?.superfans || 0)} />
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm flex-wrap gap-2">
              <Badge variant="secondary">{fameTitle}</Badge>
              <span className="text-muted-foreground text-xs">
                {nextIdx >= 0 ? `Next tier: ${next[0]} (${fmt(next[1])})` : "Maximum tier reached"}
              </span>
            </div>
            <Progress value={tierProgress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="shrink-0 gap-1">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="countries" className="shrink-0 gap-1">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Countries</span>
          </TabsTrigger>
          <TabsTrigger value="cities" className="shrink-0 gap-1">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Cities</span>
          </TabsTrigger>
          <TabsTrigger value="demographics" className="shrink-0 gap-1">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Demographics</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="shrink-0 gap-1">
            <HistoryIcon className="h-4 w-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" /> Top 10 Countries by Fame
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {top10Fame.length === 0 && (
                  <p className="text-sm text-muted-foreground">No fame data yet.</p>
                )}
                {top10Fame.map((c: any) => (
                  <div key={c.country} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 truncate">
                        <CountryFlag country={c.country} size="sm" showTooltip={false} />
                        <span className="truncate">{c.country}</span>
                      </span>
                      <span className="font-mono text-xs">{fmt(c.fame || 0)}</span>
                    </div>
                    <Progress value={((c.fame || 0) / maxTopFame) * 100} className="h-1.5" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" /> Top 10 Countries by Fans
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {top10Fans.length === 0 && (
                  <p className="text-sm text-muted-foreground">No fan data yet.</p>
                )}
                {top10Fans.map((c: any) => (
                  <div key={c.country} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 truncate">
                        <CountryFlag country={c.country} size="sm" showTooltip={false} />
                        <span className="truncate">{c.country}</span>
                      </span>
                      <span className="font-mono text-xs">{fmt(c.total_fans || 0)}</span>
                    </div>
                    <Progress value={((c.total_fans || 0) / maxTopFans) * 100} className="h-1.5" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performed vs Spillover Reach</CardTitle>
              <CardDescription>
                Countries where you've toured vs. those reached only via streaming/charts spillover.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                  <p className="text-3xl font-bold text-green-500">{performedCount}</p>
                  <p className="text-xs text-muted-foreground">Countries Performed</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/40 border text-center">
                  <p className="text-3xl font-bold">{countryFans.length - performedCount}</p>
                  <p className="text-xs text-muted-foreground">Spillover Only</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COUNTRIES */}
        <TabsContent value="countries">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">All Countries</CardTitle>
                <CardDescription>{countryFans.length} total — tap to expand cities</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCountrySort(countrySort === "fame" ? "fans" : "fame")}
                className="gap-1"
              >
                <ArrowUpDown className="h-3 w-3" />
                Sort: {countrySort === "fame" ? "Fame" : "Fans"}
              </Button>
            </CardHeader>
            <CardContent>
              {sortedCountries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No country data yet. Play gigs and release music to grow your fanbase.
                </p>
              ) : (
                <ScrollArea className="h-[500px] pr-2">
                  <div className="space-y-2">
                    {sortedCountries.map((c: any) => {
                      const isOpen = expandedCountry === c.country;
                      const cities = citiesByCountry[c.country] || [];
                      return (
                        <Collapsible
                          key={c.country}
                          open={isOpen}
                          onOpenChange={(o) => setExpandedCountry(o ? c.country : null)}
                        >
                          <CollapsibleTrigger asChild>
                            <button className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 rounded-lg text-left transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <CountryFlag country={c.country} size="md" showTooltip={false} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium truncate">{c.country}</p>
                                    {c.has_performed ? (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 border-green-500 text-green-500">
                                        Performed
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                                        Spillover
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Fame {fmt(c.fame || 0)} • {cities.length} cities
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="text-right">
                                  <p className="font-bold text-sm">{fmt(c.total_fans || 0)}</p>
                                  <div className="flex gap-1.5 text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-0.5">
                                      <Heart className="h-2.5 w-2.5 text-pink-500" />
                                      {fmt(c.casual_fans || 0)}
                                    </span>
                                    <span className="flex items-center gap-0.5">
                                      <Flame className="h-2.5 w-2.5 text-orange-500" />
                                      {fmt(c.dedicated_fans || 0)}
                                    </span>
                                    <span className="flex items-center gap-0.5">
                                      <Crown className="h-2.5 w-2.5 text-amber-500" />
                                      {fmt(c.superfans || 0)}
                                    </span>
                                  </div>
                                </div>
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                />
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-4 mt-1 mb-2 space-y-1 border-l-2 border-primary/20 pl-3">
                              {cities.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2">No city-level data yet.</p>
                              ) : (
                                cities.map((city: any) => (
                                  <div
                                    key={city.id || city.city_id || city.city_name}
                                    className="flex items-center justify-between py-1.5 text-sm"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate">{city.city_name}</p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {city.gigs_in_city || 0} gigs • Fame {fmt(city.city_fame || 0)}
                                      </p>
                                    </div>
                                    <p className="font-mono text-xs">{fmt(city.total_fans || 0)}</p>
                                  </div>
                                ))
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CITIES */}
        <TabsContent value="cities">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">All Cities</CardTitle>
                <CardDescription>{cityFans.length} total</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCitySort(citySort === "fame" ? "fans" : "fame")}
                className="gap-1"
              >
                <ArrowUpDown className="h-3 w-3" />
                Sort: {citySort === "fame" ? "Fame" : "Fans"}
              </Button>
            </CardHeader>
            <CardContent>
              {sortedCities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No city data yet.</p>
              ) : (
                <ScrollArea className="h-[500px] pr-2">
                  <div className="space-y-1.5">
                    {sortedCities.map((city: any) => (
                      <div
                        key={city.id || city.city_id || `${city.city_name}-${city.country}`}
                        className="flex items-center justify-between p-2 bg-muted/30 rounded-lg gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CountryFlag country={city.country} size="sm" showTooltip />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{city.city_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {city.country} • {city.gigs_in_city || 0} gigs
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-sm">{fmt(city.total_fans || 0)}</p>
                          <div className="flex gap-1 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Heart className="h-2.5 w-2.5 text-pink-500" />
                              {fmt(city.casual_fans || 0)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Flame className="h-2.5 w-2.5 text-orange-500" />
                              {fmt(city.dedicated_fans || 0)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Crown className="h-2.5 w-2.5 text-amber-500" />
                              {fmt(city.superfans || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEMOGRAPHICS */}
        <TabsContent value="demographics">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">Age Demographics</CardTitle>
                <CardDescription>
                  {demoCountry === "__all__" ? "Worldwide breakdown" : `Breakdown for ${demoCountry}`}
                </CardDescription>
              </div>
              <Select value={demoCountry} onValueChange={setDemoCountry}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Countries</SelectItem>
                  {sortedCountries.map((c: any) => (
                    <SelectItem key={c.country} value={c.country}>
                      {c.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {demoAggregated.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No demographic data for this selection yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {demoAggregated.map((d) => {
                    const pct = totalDemoFans > 0 ? (d.fans / totalDemoFans) * 100 : 0;
                    return (
                      <div key={d.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{d.name}</span>
                          <span className="text-muted-foreground">
                            {fmt(d.fans)} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Fame Events</CardTitle>
              <CardDescription>Last 30 fame-impacting events</CardDescription>
            </CardHeader>
            <CardContent>
              {fameEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No fame events recorded yet.
                </p>
              ) : (
                <ScrollArea className="h-[500px] pr-2">
                  <div className="space-y-2">
                    {fameEvents.map((e: any) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {e.fame_gained >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium capitalize truncate">
                              {String(e.event_type || "").replace(/_/g, " ")}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(e.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-sm font-bold flex-shrink-0 ml-2 ${
                            e.fame_gained >= 0 ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {e.fame_gained >= 0 ? "+" : ""}
                          {e.fame_gained}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}

function SummaryStat({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: any;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center p-3 bg-muted/40 rounded-lg">
      <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
