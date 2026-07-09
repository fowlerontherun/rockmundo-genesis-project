import { supabase } from "@/integrations/supabase/client";
import type { WeatherCondition } from "@/utils/weatherSystem";
import { supabaseSingleOrFallback } from "@/services/supabaseQuery";

type SeasonalWeatherPattern = {
  weather_conditions: Record<WeatherCondition, number> | null;
  avg_temperature_celsius: number | null;
};

export const fetchSeasonalWeatherPattern = async (
  cityId: string,
  season: string,
): Promise<SeasonalWeatherPattern | null> => {
  const { data, error } = await supabase
    .from("seasonal_weather_patterns")
    .select("weather_conditions, avg_temperature_celsius")
    .eq("city_id", cityId)
    .eq("season", season)
    .maybeSingle();

  return supabaseSingleOrFallback(data as SeasonalWeatherPattern | null, error, {
    scope: "weatherService",
    action: "fetch seasonal weather pattern",
  }, null);
};
