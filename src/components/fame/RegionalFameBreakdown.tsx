import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
  Globe, MapPin, ChevronDown, ChevronRight, Users, 
  CheckCircle2, AlertCircle, Crown, Flame, Heart
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RegionalFameBreakdownProps {
  bandId: string;
  compact?: boolean;
  defaultExpanded?: boolean;
}

interface CountryData {
  id: string;
  country: string;
  fame: number;
  has_performed: boolean;
  total_fans: number;
  casual_fans: number;
  dedicated_fans: number;
  superfans: number;
}

interface CityData {
  id: string;
  city_id: string;
  city_name: string;
  country: string;
  city_fame: number;
  total_fans: number;
  casual_fans: number;
  dedicated_fans: number;
  superfans: number;
  gigs_in_city: number;
}

const getCountryFlag = (country: string): string => {
  const flags: Record<string, string> = {
    'United States': '🇺🇸', 'United Kingdom': '🇬🇧', 'Germany': '🇩🇪', 'France': '🇫🇷',
    'Japan': '🇯🇵', 'Australia': '🇦🇺', 'Canada': '🇨🇦', 'Brazil': '🇧🇷', 'Mexico': '🇲🇽',
    'Spain': '🇪🇸', 'Italy': '🇮🇹', 'Netherlands': '🇳🇱', 'Sweden': '🇸🇪', 'Norway': '🇳🇴',
    'South Korea': '🇰🇷', 'China': '🇨🇳', 'India': '🇮🇳', 'Russia': '🇷🇺', 'Argentina': '🇦🇷',
    'Poland': '🇵🇱', 'Belgium': '🇧🇪', 'Austria': '🇦🇹', 'Switzerland': '🇨🇭', 'Ireland': '🇮🇪',
    'Portugal': '🇵🇹', 'Denmark': '🇩🇰', 'Finland': '🇫🇮', 'Czech Republic': '🇨🇿', 'Greece': '🇬🇷',
  };
  return flags[country] || '🌍';
};

const formatNumber = (n: number): string => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
};

export function RegionalFameBreakdown({ 
  bandId, 
  compact = false,
  defaultExpanded = false 
}: RegionalFameBreakdownProps) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());

  // Fetch country fans
  const { data: countryFans = [], isLoading: countriesLoading } = useQuery({
    queryKey: ["regional-fame-countries", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_country_fans")
        .select("*")
        .eq("band_id", bandId)
        .order("fame", { ascending: false });
      if (error) throw error;
      return data as CountryData[];
    },
    enabled: !!bandId,
  });

  // Fetch city fans
  const { data: cityFans = [], isLoading: citiesLoading } = useQuery({
    queryKey: ["regional-fame-cities", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_city_fans")
        .select("*")
        .eq("band_id", bandId)
        .order("city_fame", { ascending: false });
      if (error) throw error;
      return data as CityData[];
    },
    enabled: !!bandId,
  });

  const toggleCountry = (country: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(country)) {
        next.delete(country);
      } else {
        next.add(country);
      }
      return next;
    });
  };

  const getCitiesForCountry = (country: string) => {
    return cityFans.filter((cf) => cf.country === country);
  };

  if (countriesLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  const maxFame = Math.max(...countryFans.map((cf) => cf.fame || 0), 1);
  const topCountry = countryFans[0];
  const performedCountries = countryFans.filter((cf) => cf.has_performed).length;

  const summaryText = countryFans.length > 0 
    ? `${countryFans.length} countries • Top: ${topCountry?.country || 'None'} ${formatNumber(topCountry?.fame || 0)}`
    : "No regional data yet";

  return (
    <Card className={cn(compact && "border-0 shadow-none")}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-5 w-5 text-primary" />
                Regional Fame
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {summaryText}
                </span>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {countryFans.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                Play gigs in different countries to build regional fame!
              </p>
            ) : (
              <>
                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold">{countryFans.length}</p>
                    <p className="text-xs text-muted-foreground">Countries</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold">{performedCountries}</p>
                    <p className="text-xs text-muted-foreground">Performed</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold">
                      {formatNumber(countryFans.reduce((sum, cf) => sum + (cf.total_fans || 0), 0))}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Fans</p>
                  </div>
                </div>

                <ScrollArea className={compact ? "h-[200px]" : "h-[350px]"}>
                  <div className="space-y-2">
                    {countryFans.map((cf) => {
                      const cities = getCitiesForCountry(cf.country);
                      const isExpanded = expandedCountries.has(cf.country);
                      const famePercent = (cf.fame / maxFame) * 100;

                      return (
                        <div key={cf.id} className="border rounded-lg overflow-hidden">
                          <div 
                            className={cn(
                              "p-3 cursor-pointer hover:bg-muted/30 transition-colors",
                              isExpanded && "bg-muted/20"
                            )}
                            onClick={() => cities.length > 0 && toggleCountry(cf.country)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{getCountryFlag(cf.country)}</span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{cf.country}</span>
                                    {cf.has_performed ? (
                                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                                        Capped
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Fame: {formatNumber(cf.fame || 0)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <p className="font-bold text-sm">{formatNumber(cf.total_fans || 0)}</p>
                                  <div className="flex gap-1 text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-0.5">
                                      <Heart className="h-2.5 w-2.5 text-pink-500" />
                                      {cf.casual_fans || 0}
                                    </span>
                                    <span className="flex items-center gap-0.5">
                                      <Flame className="h-2.5 w-2.5 text-orange-500" />
                                      {cf.dedicated_fans || 0}
                                    </span>
                                    <span className="flex items-center gap-0.5">
                                      <Crown className="h-2.5 w-2.5 text-amber-500" />
                                      {cf.superfans || 0}
                                    </span>
                                  </div>
                                </div>
                                {cities.length > 0 && (
                                  isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )
                                )}
                              </div>
                            </div>
                            <Progress value={famePercent} className="h-1.5" />
                          </div>

                          {/* Cities list */}
                          {isExpanded && cities.length > 0 && (
                            <div className="bg-muted/10 border-t">
                              {cities.map((city) => (
                                <div 
                                  key={city.id} 
                                  className="flex items-center justify-between px-4 py-2 border-b last:border-b-0"
                                >
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    <div>
                                      <p className="text-sm font-medium">{city.city_name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {city.gigs_in_city || 0} gigs • Fame: {city.city_fame || 0}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium">{formatNumber(city.total_fans || 0)}</p>
                                    <p className="text-[10px] text-muted-foreground">fans</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
