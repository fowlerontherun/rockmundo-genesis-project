import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Sun, CloudRain, Snowflake, Wind } from "lucide-react";

const WEATHER_ICONS: Record<string, React.ReactNode> = {
  sunny: <Sun className="h-8 w-8 text-yellow-500" />,
  clear: <Sun className="h-8 w-8 text-yellow-500" />,
  cloudy: <Cloud className="h-8 w-8 text-muted-foreground" />,
  overcast: <Cloud className="h-8 w-8 text-muted-foreground" />,
  rainy: <CloudRain className="h-8 w-8 text-blue-500" />,
  rain: <CloudRain className="h-8 w-8 text-blue-500" />,
  stormy: <CloudRain className="h-8 w-8 text-destructive" />,
  snowy: <Snowflake className="h-8 w-8 text-cyan-400" />,
  snow: <Snowflake className="h-8 w-8 text-cyan-400" />,
  windy: <Wind className="h-8 w-8 text-muted-foreground" />,
};

export function WeatherReport() {
  const { profileId } = useActiveProfile();

  const { data: weather } = useQuery({
    queryKey: ["weather-report", profileId],
    queryFn: async () => {
      // Get player's current city
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_city_id, cities(name, country)")
        .eq("id", profileId!)
        .single();

      if (!profile?.current_city_id) return null;

      // Get weather for current season
      const { data: weatherData } = await (supabase as any)
        .from("seasonal_weather_patterns")
        .select("*")
        .eq("city_id", profile.current_city_id)
        .limit(1);

      const w = weatherData?.[0];
      return {
        city: (profile as any).cities?.name || "Unknown",
        country: (profile as any).cities?.country || "",
        condition: w?.typical_weather || "clear",
        tempMin: w?.temp_min_c ?? 15,
        tempMax: w?.temp_max_c ?? 25,
        description: w?.description || "A fine day for music",
      };
    },
    enabled: !!profileId,
    staleTime: 30 * 60 * 1000,
  });

  if (!weather) return null;

  const icon = WEATHER_ICONS[weather.condition.toLowerCase()] || WEATHER_ICONS.clear;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-serif uppercase tracking-wider text-muted-foreground">
          Weather
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="font-semibold text-sm">{weather.city}, {weather.country}</p>
            <p className="text-xs text-muted-foreground capitalize">{weather.condition}</p>
            <p className="text-xs text-muted-foreground">{weather.tempMin}°C – {weather.tempMax}°C</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
