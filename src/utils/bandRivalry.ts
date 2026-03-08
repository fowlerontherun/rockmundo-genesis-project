/**
 * Band Rivalry System (v1.0.934)
 * Bands competing in the same genre/city develop rivalries that
 * boost fan engagement, media coverage, and chart competition.
 */

export interface Rivalry {
  rivalBandId: string;
  rivalBandName: string;
  intensity: number;        // 0-100
  level: "none" | "budding" | "heated" | "fierce" | "legendary";
  fanBoost: number;          // 0 – 0.25 multiplier bonus
  mediaBoost: number;        // 0 – 0.3
  chartCompetitionBonus: number; // 0 – 0.2
  dramaRisk: number;         // 0 – 0.15
}

function getRivalryLevel(intensity: number): Rivalry["level"] {
  if (intensity < 10) return "none";
  if (intensity < 30) return "budding";
  if (intensity < 60) return "heated";
  if (intensity < 85) return "fierce";
  return "legendary";
}

/**
 * Calculate rivalry state from raw intensity score.
 */
export function getRivalryState(intensity: number, rivalBandId: string, rivalBandName: string): Rivalry {
  const clamped = Math.max(0, Math.min(100, intensity));
  const level = getRivalryLevel(clamped);
  const t = clamped / 100;

  return {
    rivalBandId,
    rivalBandName,
    intensity: clamped,
    level,
    fanBoost: parseFloat((t * 0.25).toFixed(3)),
    mediaBoost: parseFloat((t * 0.30).toFixed(3)),
    chartCompetitionBonus: parseFloat((t * 0.20).toFixed(3)),
    dramaRisk: parseFloat((t * 0.15).toFixed(3)),
  };
}

/**
 * Events that increase/decrease rivalry intensity.
 */
export const RIVALRY_EVENTS: Record<string, number> = {
  // Increases
  same_chart_week: 5,
  beat_rival_on_chart: 8,
  stole_venue_slot: 10,
  media_comparison: 6,
  fan_war_social_media: 12,
  rival_diss_track: 15,
  same_festival_lineup: 4,
  award_competition: 7,

  // Decreases
  collaboration: -20,
  public_praise: -10,
  time_decay_daily: -0.5,
  different_genres_now: -3,
};

/**
 * Apply a rivalry event and return the new intensity.
 */
export function applyRivalryEvent(currentIntensity: number, eventKey: string): { newIntensity: number; change: number } {
  const change = RIVALRY_EVENTS[eventKey] ?? 0;
  const newIntensity = Math.max(0, Math.min(100, currentIntensity + change));
  return { newIntensity, change };
}

/**
 * Determine if two bands should become rivals.
 * Criteria: same genre, similar fame, same city activity.
 */
export function shouldBeRivals(
  band1Genre: string,
  band2Genre: string,
  band1Fame: number,
  band2Fame: number,
  sharedCityCount: number
): { eligible: boolean; initialIntensity: number } {
  if (band1Genre.toLowerCase() !== band2Genre.toLowerCase()) {
    return { eligible: false, initialIntensity: 0 };
  }

  const fameRatio = Math.min(band1Fame, band2Fame) / Math.max(band1Fame, band2Fame, 1);
  // Bands within 2x fame of each other are eligible
  if (fameRatio < 0.5) {
    return { eligible: false, initialIntensity: 0 };
  }

  if (sharedCityCount === 0) {
    return { eligible: false, initialIntensity: 0 };
  }

  const initialIntensity = Math.min(30, 5 + sharedCityCount * 5 + Math.round(fameRatio * 10));
  return { eligible: true, initialIntensity };
}
