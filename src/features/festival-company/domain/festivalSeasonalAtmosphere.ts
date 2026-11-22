import { GAME_EPOCH, getCurrentSeason, type Season } from "@/utils/gameCalendar";
import type { WeatherCondition } from "@/utils/weatherSystem";
import type { FestivalRuntimeWeatherState } from "./festivalRuntime";

export interface FestivalSeasonalAtmosphere {
  season: Season;
  condition: WeatherCondition | "windy" | null;
  temperature: number | null;
  source: "runtime" | "seasonal" | "scenery";
  ground: "grass" | "mud" | "snow";
}

/** Same accelerated epoch as the game calendar, evaluated at the edition date,
 * not at the visitor's current date. Never changes gameplay or forecasts real weather. */
export function festivalSeasonAt(timestamp: string) {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return null;
  const day = Math.floor(Math.max(0, time - GAME_EPOCH.getTime()) / 28_800_000);
  const month = Math.floor((day % 360) / 30) + 1;
  return { season: getCurrentSeason(month), day, month, year: Math.floor(day / 360) + 1 };
}

export function seasonalFestivalWeather(seed: string, probabilities: Record<string, number> | null, average: number | null) {
  if (!probabilities || average === null || !Number.isFinite(average)) return null;
  const conditions = (["sunny", "cloudy", "rainy", "stormy", "snowy"] as const)
    .map(condition => ({ condition, weight: probabilities[condition] }))
    .filter(item => Number.isFinite(item.weight) && item.weight > 0);
  const total = conditions.reduce((sum, item) => sum + item.weight, 0);
  if (!total) return null;
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  let pick = (hash / 4294967296) * total;
  const condition = conditions.find(item => { pick -= item.weight; return pick < 0; })?.condition ?? conditions[conditions.length - 1]?.condition;
  return condition ? { condition, temperature: Math.round(average + (hash % 7) - 3) } : null;
}

const runtimeConditions: Record<FestivalRuntimeWeatherState, FestivalSeasonalAtmosphere["condition"]> = {
  clear: "sunny", cloudy: "cloudy", light_rain: "rainy", heavy_rain: "rainy",
  hot: "sunny", cold: "cloudy", high_wind: "windy", storm: "stormy",
};

export function festivalAtmosphere(season: Season, seasonal: { condition: WeatherCondition; temperature: number } | null,
  runtime: FestivalRuntimeWeatherState | null, groundCondition: string | null): FestivalSeasonalAtmosphere {
  const condition = runtime ? runtimeConditions[runtime] : seasonal?.condition ?? null;
  return {
    season, condition,
    temperature: runtime ? null : seasonal?.temperature ?? null,
    source: runtime ? "runtime" : seasonal ? "seasonal" : "scenery",
    ground: groundCondition?.includes("snow") || condition === "snowy" ? "snow"
      : groundCondition?.includes("mud") || condition === "rainy" || condition === "stormy" ? "mud" : "grass",
  };
}

export const festivalSeasonLabels: Record<Season, string> = {
  spring: "Spring bloom", summer: "Summer open air", autumn: "Autumn woodland", winter: "Winter lights",
};