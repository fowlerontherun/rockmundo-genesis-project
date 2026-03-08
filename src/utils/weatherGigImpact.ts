/**
 * Weather → Gig Impact System (v1.0.934)
 * Weather conditions affect outdoor/indoor gig attendance, mood, and merch sales.
 */

import type { WeatherCondition } from "./weatherSystem";

export interface WeatherGigImpact {
  attendanceMultiplier: number;   // 0.5 – 1.2
  moodBonus: number;              // -15 to +10  (crowd mood shift)
  merchMultiplier: number;        // 0.7 – 1.3
  outdoorPenalty: boolean;
  description: string;
}

const INDOOR_IMPACTS: Record<WeatherCondition, WeatherGigImpact> = {
  sunny:  { attendanceMultiplier: 0.92, moodBonus: 0,  merchMultiplier: 1.0,  outdoorPenalty: false, description: "Nice day — some fans prefer outdoors" },
  cloudy: { attendanceMultiplier: 1.0,  moodBonus: 0,  merchMultiplier: 1.0,  outdoorPenalty: false, description: "Overcast — good gig weather" },
  rainy:  { attendanceMultiplier: 1.08, moodBonus: 5,  merchMultiplier: 1.15, outdoorPenalty: false, description: "Rain drives fans indoors — cozy vibes, merch sales up" },
  stormy: { attendanceMultiplier: 0.85, moodBonus: -5, merchMultiplier: 1.1,  outdoorPenalty: false, description: "Storms keep some fans home, but those who come buy merch" },
  snowy:  { attendanceMultiplier: 0.80, moodBonus: -5, merchMultiplier: 1.2,  outdoorPenalty: false, description: "Snow reduces turnout, but bundled fans buy more merch" },
};

const OUTDOOR_IMPACTS: Record<WeatherCondition, WeatherGigImpact> = {
  sunny:  { attendanceMultiplier: 1.15, moodBonus: 10, merchMultiplier: 1.1,  outdoorPenalty: false, description: "Perfect outdoor gig weather — crowd is buzzing" },
  cloudy: { attendanceMultiplier: 1.0,  moodBonus: 0,  merchMultiplier: 1.0,  outdoorPenalty: false, description: "Mild outdoor conditions" },
  rainy:  { attendanceMultiplier: 0.60, moodBonus: -10, merchMultiplier: 0.75, outdoorPenalty: true, description: "Rain hammers outdoor attendance — fans leave early" },
  stormy: { attendanceMultiplier: 0.40, moodBonus: -15, merchMultiplier: 0.7,  outdoorPenalty: true, description: "Storms devastate outdoor gig — safety concerns" },
  snowy:  { attendanceMultiplier: 0.50, moodBonus: -10, merchMultiplier: 0.8,  outdoorPenalty: true, description: "Snow makes outdoor stage dangerous — low turnout" },
};

/**
 * Get the weather impact on a gig based on venue type and conditions.
 */
export function getWeatherGigImpact(
  weather: WeatherCondition,
  isOutdoorVenue: boolean
): WeatherGigImpact {
  return isOutdoorVenue ? OUTDOOR_IMPACTS[weather] : INDOOR_IMPACTS[weather];
}

/**
 * Apply weather to raw attendance figure.
 */
export function applyWeatherToAttendance(
  baseAttendance: number,
  weather: WeatherCondition,
  isOutdoor: boolean
): { adjusted: number; impact: WeatherGigImpact } {
  const impact = getWeatherGigImpact(weather, isOutdoor);
  const adjusted = Math.round(baseAttendance * impact.attendanceMultiplier);
  return { adjusted, impact };
}
