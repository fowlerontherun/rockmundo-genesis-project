import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Globe, MapPin, Users, TrendingUp, Star, 
  Heart, Flame, Crown, BarChart3 
} from "lucide-react";
import { getBandFameTitle, BAND_FAME_THRESHOLDS } from "@/utils/bandFame";

interface FameFansOverviewProps {
  bandId: string;
}

interface DemographicFans {
  demographic_id: string;
  demographic_name: string;
  fan_count: number;
  engagement_rate: number;
}

interface CountryFans {
  country: string;
  total_fans: number;
  casual_fans: number;
  dedicated_fans: number;
  superfans: number;
  fame: number;
  has_performed?: boolean;
}

interface CityFans {
  city_id: string;
  city_name: string;
  country: string;
  total_fans: number;
  casual_fans: number;
  dedicated_fans: number;
  superfans: number;
  city_fame: number;
  gigs_in_city: number;
}

export function FameFansOverview({ bandId }: FameFansOverviewProps) {
  // Fetch band data
  const { data: band, isLoading: bandLoading } = useQuery({
    queryKey: ["band-fame-overview", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, fame, total_fans, casual_fans, dedicated_fans, superfans, regional_fame, global_fame")
        .eq("id", bandId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!bandId,
  });

  // Fetch country fans
  const { data: countryFans = [] } = useQuery({
    queryKey: ["band-country-fans", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_country_fans")
        .select("*")
        .eq("band_id", bandId)
        .order("total_fans", { ascending: false });
      if (error) throw error;
      return data as CountryFans[];
    },
    enabled: !!bandId,
  });

  // Fetch city fans
  const { data: cityFans = [] } = useQuery({
    queryKey: ["band-city-fans", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_city_fans")
        .select("*")
        .eq("band_id", bandId)
        .order("total_fans", { ascending: false });
      if (error) throw error;
      return data as CityFans[];
    },
    enabled: !!bandId,
  });

  // Fetch demographic fans
  const { data: demographicFans = [] } = useQuery({
    queryKey: ["band-demographic-fans", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_demographic_fans")
        .select(`
          demographic_id,
          fan_count,
          engagement_rate,
          age_demographics(name)
        `)
        .eq("band_id", bandId);
      if (error) throw error;
      
      // Aggregate by demographic
      const aggregated: Record<string, DemographicFans> = {};
      (data || []).forEach((item: any) => {
        const demoId = item.demographic_id;
        if (!aggregated[demoId]) {
          aggregated[demoId] = {
            demographic_id: demoId,
            demographic_name: item.age_demographics?.name || "Unknown",
            fan_count: 0,
            engagement_rate: 0,
          };
        }
        aggregated[demoId].fan_count += item.fan_count || 0;
        aggregated[demoId].engagement_rate = item.engagement_rate || 0;
      });
      
      return Object.values(aggregated).sort((a, b) => b.fan_count - a.fan_count);
    },
    enabled: !!bandId,
  });

  // Fetch fame history for trend
  const { data: fameHistory = [] } = useQuery({
    queryKey: ["band-fame-history", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_fame_history")
        .select("*")
        .eq("band_id", bandId)
        .order("recorded_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!bandId,
  });

  if (bandLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!band) {
    return <p className="text-muted-foreground">No band data available</p>;
  }

  const totalFans = band.total_fans || 0;
  const globalFame = band.global_fame || band.fame || 0;
  const fameTitle = getBandFameTitle(globalFame);
  
  // Calculate next threshold
  const thresholds = Object.entries(BAND_FAME_THRESHOLDS).sort((a, b) => a[1] - b[1]);
  const currentThresholdIndex = thresholds.findIndex(([_, value]) => globalFame < value);
  const nextThreshold = currentThresholdIndex >= 0 ? thresholds[currentThresholdIndex] : thresholds[thresholds.length - 1];
  const prevThreshold = currentThresholdIndex > 0 ? thresholds[currentThresholdIndex - 1] : [null, 0];
  const progressToNext = ((globalFame - prevThreshold[1]) / (nextThreshold[1] - prevThreshold[1])) * 100;

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const getCountryFlag = (country: string) => {
    const flags: Record<string, string> = {
      'United States': '🇺🇸', 'United Kingdom': '🇬🇧', 'Germany': '🇩🇪', 'France': '🇫🇷',
      'Japan': '🇯🇵', 'Australia': '🇦🇺', 'Canada': '🇨🇦', 'Brazil': '🇧🇷', 'Mexico': '🇲🇽',
      'Spain': '🇪🇸', 'Italy': '🇮🇹', 'Netherlands': '🇳🇱', 'Sweden': '🇸🇪', 'Norway': '🇳🇴',
      'South Korea': '🇰🇷', 'China': '🇨🇳', 'India': '🇮🇳', 'Russia': '🇷🇺', 'Argentina': '🇦🇷',
    };
    return flags[country] || '🌍';
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Fame & Fans Overview
          </CardTitle>
          <CardDescription>{band.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Globe className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{formatNumber(globalFame)}</p>
              <p className="text-xs text-muted-foreground">Global Fame</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold">{formatNumber(totalFans)}</p>
              <p className="text-xs text-muted-foreground">Total Fans</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <MapPin className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold">{countryFans.length}</p>
              <p className="text-xs text-muted-foreground">Countries</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Crown className="h-5 w-5 mx-auto mb-1 text-amber-500" />
              <p className="text-2xl font-bold">{formatNumber(band.superfans || 0)}</p>
              <p className="text-xs text-muted-foreground">Superfans</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fame Level: <Badge variant="secondary">{fameTitle}</Badge></span>
              <span className="text-muted-foreground">Next: {nextThreshold[0]}</span>
            </div>
            <Progress value={Math.min(100, progressToNext)} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs defaultValue="countries" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="countries" className="flex items-center gap-1">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Countries</span>
          </TabsTrigger>
          <TabsTrigger value="cities" className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Cities</span>
          </TabsTrigger>
          <TabsTrigger value="demographics" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Demographics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="countries">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fans by Country</CardTitle>
              <CardDescription>Your fanbase distribution across countries</CardDescription>
            </CardHeader>
            <CardContent>
              {countryFans.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No country fan data yet. Play gigs to build your fanbase!</p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {countryFans.map((cf) => (
                      <div key={cf.country} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getCountryFlag(cf.country)}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{cf.country}</p>
                              {cf.has_performed ? (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-green-500 text-green-500">
                                  Performed
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-muted-foreground">
                                  Spillover
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Fame: {formatNumber(cf.fame || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatNumber(cf.total_fans)}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5">
                              <Heart className="h-3 w-3 text-pink-500" /> {cf.casual_fans}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Flame className="h-3 w-3 text-orange-500" /> {cf.dedicated_fans}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Crown className="h-3 w-3 text-amber-500" /> {cf.superfans}
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

        <TabsContent value="cities">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fans by City</CardTitle>
              <CardDescription>Your local fanbases in each city</CardDescription>
            </CardHeader>
            <CardContent>
              {cityFans.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No city fan data yet. Play gigs to build your fanbase!</p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {cityFans.slice(0, 20).map((cf) => (
                      <div key={cf.city_id || cf.city_name} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <div>
                          <p className="font-medium">{cf.city_name}</p>
                          <p className="text-xs text-muted-foreground">{cf.country} • {cf.gigs_in_city} gigs</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatNumber(cf.total_fans)}</p>
                          <p className="text-xs text-muted-foreground">Fame: {cf.city_fame || 0}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demographics">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fan Demographics</CardTitle>
              <CardDescription>Age group distribution of your fans</CardDescription>
            </CardHeader>
            <CardContent>
              {demographicFans.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No demographic data yet. Build your fanbase to see demographics!</p>
              ) : (
                <div className="space-y-4">
                  {demographicFans.map((df) => {
                    const percentage = totalFans > 0 ? (df.fan_count / totalFans) * 100 : 0;
                    return (
                      <div key={df.demographic_id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{df.demographic_name}</span>
                          <span>{formatNumber(df.fan_count)} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Fan Tier Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Fan Tier Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-pink-500/10 rounded-lg border border-pink-500/20">
              <Heart className="h-6 w-6 mx-auto mb-2 text-pink-500" />
              <p className="text-xl font-bold">{formatNumber(band.casual_fans || 0)}</p>
              <p className="text-sm text-muted-foreground">Casual Fans</p>
              <p className="text-xs text-muted-foreground mt-1">Casual listeners</p>
            </div>
            <div className="text-center p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <Flame className="h-6 w-6 mx-auto mb-2 text-orange-500" />
              <p className="text-xl font-bold">{formatNumber(band.dedicated_fans || 0)}</p>
              <p className="text-sm text-muted-foreground">Dedicated Fans</p>
              <p className="text-xs text-muted-foreground mt-1">Regular supporters</p>
            </div>
            <div className="text-center p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <Crown className="h-6 w-6 mx-auto mb-2 text-amber-500" />
              <p className="text-xl font-bold">{formatNumber(band.superfans || 0)}</p>
              <p className="text-sm text-muted-foreground">Superfans</p>
              <p className="text-xs text-muted-foreground mt-1">Die-hard loyalists</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
