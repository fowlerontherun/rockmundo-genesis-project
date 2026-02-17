import { supabase } from "@/integrations/supabase/client";
import type { Season } from "./gameCalendar";

export type WeatherCondition = "sunny" | "cloudy" | "rainy" | "stormy" | "snowy";

export interface Weather {
  condition: WeatherCondition;
  temperature: number;
  emoji: string;
}

export interface WeatherTravelImpact {
  isDisrupted: boolean;
  disruptionType?: "delayed" | "cancelled" | "expensive";
  delayHours?: number;
  costMultiplier?: number;
  message: string;
}

const WEATHER_EMOJIS: Record<WeatherCondition, string> = {
  sunny: "☀️",
  cloudy: "☁️",
  rainy: "🌧️",
  stormy: "⛈️",
  snowy: "❄️",
};

/**
 * Generate daily weather based on seasonal patterns
 */
export async function generateDailyWeather(
  cityId: string,
  season: Season
): Promise<Weather> {
  const { data, error } = await supabase
    .from("seasonal_weather_patterns")
    .select("*")
    .eq("city_id", cityId)
    .eq("season", season)
    .maybeSingle();

  if (error || !data) {
    // Default fallback weather
    return {
      condition: "sunny",
      temperature: 20,
      emoji: WEATHER_EMOJIS.sunny,
    };
  }

  // Generate random weather based on probability distribution
  const conditions = data.weather_conditions as Record<WeatherCondition, number>;
  const random = Math.random();
  let cumulative = 0;
  let selectedCondition: WeatherCondition = "sunny";

  for (const [condition, probability] of Object.entries(conditions)) {
    cumulative += probability;
    if (random <= cumulative) {
      selectedCondition = condition as WeatherCondition;
      break;
    }
  }

  return {
    condition: selectedCondition,
    temperature: data.avg_temperature_celsius,
    emoji: WEATHER_EMOJIS[selectedCondition],
  };
}

/**
 * Check if weather causes travel disruption
 */
export function checkWeatherTravelImpact(
  weather: WeatherCondition,
  transportType: string,
  season: Season
): WeatherTravelImpact {
  const type = transportType.toLowerCase();

  // Winter + Severe Weather
  if (season === "winter" && weather === "snowy") {
    if (type.includes("flight") || type.includes("plane")) {
      return {
        isDisrupted: Math.random() < 0.6,
        disruptionType: "cancelled",
        message: "❄️ Heavy snow may cause flight cancellations",
      };
    }
    if (type.includes("train")) {
      return {
        isDisrupted: Math.random() < 0.3,
        disruptionType: "delayed",
        delayHours: Math.floor(Math.random() * 3) + 2, // 2-4 hours
        message: "❄️ Snow delays expected on train routes",
      };
    }
  }

  if (weather === "stormy") {
    if (type.includes("flight") || type.includes("plane")) {
      return {
        isDisrupted: Math.random() < 0.4,
        disruptionType: "delayed",
        delayHours: Math.floor(Math.random() * 2) + 1, // 1-2 hours
        message: "⛈️ Storms may delay flights",
      };
    }
    if (type.includes("bus")) {
      return {
        isDisrupted: Math.random() < 0.2,
        disruptionType: "delayed",
        delayHours: 1,
        message: "⛈️ Storm conditions affecting road travel",
      };
    }
  }

  // Summer heat can affect buses
  if (season === "summer" && weather === "sunny") {
    if (type.includes("bus") && Math.random() < 0.1) {
      return {
        isDisrupted: true,
        disruptionType: "delayed",
        delayHours: 1,
        message: "☀️ Heat causing minor delays",
      };
    }
  }

  return {
    isDisrupted: false,
    message: "Clear travel conditions",
  };
}

/**
 * Get weather description
 */
export function getWeatherDescription(weather: Weather): string {
  const descriptions: Record<WeatherCondition, string> = {
    sunny: "Clear and sunny",
    cloudy: "Overcast skies",
    rainy: "Rain expected",
    stormy: "Severe storms",
    snowy: "Heavy snowfall",
  };

  return `${descriptions[weather.condition]} (${weather.temperature}°C)`;
}

/**
 * Genre popularity modifier based on weather conditions.
 * Returns a multiplier (e.g. 1.1 = +10% boost, 0.9 = -10%).
 */
export function getWeatherGenreModifier(
  weather: WeatherCondition,
  genre: string
): number {
  const g = genre.toLowerCase();

  const boosts: Record<WeatherCondition, string[]> = {
    rainy: ["blues", "jazz", "soul", "indie", "lo-fi"],
    sunny: ["pop", "reggae", "dancehall", "latin", "ska", "funk"],
    snowy: ["classical", "ambient", "folk", "acoustic"],
    stormy: ["metal", "punk", "industrial", "hardcore", "grunge"],
    cloudy: ["alternative", "shoegaze", "post-rock", "dream pop"],
  };

  const dampens: Record<WeatherCondition, string[]> = {
    rainy: ["pop", "reggae", "dancehall"],
    sunny: ["metal", "industrial", "grunge"],
    snowy: ["reggae", "dancehall", "latin"],
    stormy: ["pop", "acoustic", "folk"],
    cloudy: [],
  };

  if (boosts[weather]?.some((b) => g.includes(b))) return 1.12;
  if (dampens[weather]?.some((d) => g.includes(d))) return 0.90;
  return 1.0;
}
