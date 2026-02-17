import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGameCalendar } from "@/hooks/useGameCalendar";
import type { WeatherCondition, Weather } from "@/utils/weatherSystem";

const WEATHER_EMOJIS: Record<WeatherCondition, string> = {
  sunny: "☀️",
  cloudy: "☁️",
  rainy: "🌧️",
  stormy: "⛈️",
  snowy: "❄️",
};

/**
 * Simple seeded PRNG (mulberry32)
 */
function seededRandom(seed: number): number {
  let t = seed + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Hook to get current weather for a city based on in-game season and day.
 * Weather is deterministic per game day (same day = same weather for all players).
 */
export function useWeather(cityId: string | null | undefined) {
  const { data: calendar } = useGameCalendar();

  return useQuery({
    queryKey: ["weather", cityId, calendar?.season, calendar?.gameDay, calendar?.gameYear],
    queryFn: async (): Promise<Weather> => {
      if (!cityId || !calendar) {
        return { condition: "sunny", temperature: 20, emoji: "☀️" };
      }

      const { data, error } = await supabase
        .from("seasonal_weather_patterns")
        .select("*")
        .eq("city_id", cityId)
        .eq("season", calendar.season)
        .maybeSingle();

      if (error || !data) {
        return { condition: "sunny", temperature: 20, emoji: "☀️" };
      }

      // Use game day + year + city as seed for deterministic weather
      const seedStr = `${cityId}-${calendar.gameYear}-${calendar.gameDay}`;
      let seedNum = 0;
      for (let i = 0; i < seedStr.length; i++) {
        seedNum = ((seedNum << 5) - seedNum + seedStr.charCodeAt(i)) | 0;
      }

      const random = seededRandom(Math.abs(seedNum));

      const conditions = data.weather_conditions as Record<WeatherCondition, number>;
      let cumulative = 0;
      let selectedCondition: WeatherCondition = "sunny";

      for (const [condition, probability] of Object.entries(conditions)) {
        cumulative += probability;
        if (random <= cumulative) {
          selectedCondition = condition as WeatherCondition;
          break;
        }
      }

      // Add some temperature variance based on seed
      const tempVariance = seededRandom(Math.abs(seedNum + 1)) * 6 - 3; // ±3°C
      const temperature = Math.round(data.avg_temperature_celsius + tempVariance);

      return {
        condition: selectedCondition,
        temperature,
        emoji: WEATHER_EMOJIS[selectedCondition],
      };
    },
    enabled: !!cityId && !!calendar,
    staleTime: 1000 * 60 * 5,
  });
}
