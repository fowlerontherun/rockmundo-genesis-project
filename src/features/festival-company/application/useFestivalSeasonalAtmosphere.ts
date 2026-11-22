import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchSeasonalWeatherPattern } from "@/services/weatherService";
import { festivalSeasonAt, seasonalFestivalWeather } from "../domain/festivalSeasonalAtmosphere";

/** Public read-only scenery. Missing climate data remains unknown, never sunny by default. */
export function useFestivalSeasonalAtmosphere(city: string | undefined, country: string | undefined, timestamp: string | undefined) {
  const date = timestamp ? festivalSeasonAt(timestamp) : null;
  const weather = useQuery({
    queryKey: ["festival-seasonal-weather", city, country, date?.day],
    enabled: Boolean(city && country && date),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      if (!city || !country || !date) return null;
      const { data, error } = await supabase.from("cities").select("id").eq("name", city).eq("country", country).maybeSingle();
      if (error || !data) return null;
      const pattern = await fetchSeasonalWeatherPattern(data.id, date.season);
      return seasonalFestivalWeather(`${data.id}:${date.year}:${date.month}:${date.day}`,
        pattern?.weather_conditions ?? null, pattern?.avg_temperature_celsius ?? null);
    },
  });
  return { date, weather: weather.isError ? null : weather.data ?? null, pending: weather.isFetching };
}