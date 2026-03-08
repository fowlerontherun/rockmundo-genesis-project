/**
 * Seasonal Gameplay Modifiers (v1.0.931)
 * Seasons affect genre popularity, tourism, event frequency, and player behavior.
 */

import type { Season } from "./gameCalendar";

export interface SeasonalModifiers {
  season: Season;
  genreBoosts: Record<string, number>;      // genre → multiplier (0.8 – 1.3)
  tourismMultiplier: number;                 // affects gig attendance in tourist cities
  eventFrequencyMultiplier: number;          // how often random events fire
  outdoorGigModifier: number;                // affects outdoor venue attendance
  streamingModifier: number;                 // seasonal listening habits
  merchModifier: number;                     // seasonal merch demand
  description: string;
}

const SEASONAL_GENRE_BOOSTS: Record<Season, Record<string, number>> = {
  summer: {
    Pop: 1.25, "Hip-Hop": 1.2, Reggae: 1.3, Latin: 1.25, Electronic: 1.2,
    Country: 1.15, Rock: 1.1, Metal: 0.9, Jazz: 0.95, Classical: 0.85,
  },
  winter: {
    Pop: 1.1, Classical: 1.25, Jazz: 1.2, Soul: 1.15, Folk: 1.2,
    Metal: 1.1, "K-Pop": 1.15, Rock: 1.05, Reggae: 0.8, Latin: 0.85,
  },
  spring: {
    Indie: 1.2, Folk: 1.15, Pop: 1.15, "R&B": 1.1, Rock: 1.1,
    Electronic: 1.05, Country: 1.1, Jazz: 1.05,
  },
  autumn: {
    Rock: 1.2, Metal: 1.15, Grunge: 1.25, Indie: 1.15, Blues: 1.2,
    Folk: 1.1, Punk: 1.15, "Hip-Hop": 1.05, Pop: 0.95,
  },
};

/**
 * Get all seasonal modifiers for a given season.
 */
export function getSeasonalModifiers(season: Season): SeasonalModifiers {
  switch (season) {
    case "summer":
      return {
        season,
        genreBoosts: SEASONAL_GENRE_BOOSTS.summer,
        tourismMultiplier: 1.3,
        eventFrequencyMultiplier: 1.25,
        outdoorGigModifier: 1.4,
        streamingModifier: 0.9,   // people are outside more
        merchModifier: 1.15,      // festival merch season
        description: "Festival season! Outdoor gigs and tourism are booming. Pop, Hip-Hop, and Reggae dominate.",
      };
    case "winter":
      return {
        season,
        genreBoosts: SEASONAL_GENRE_BOOSTS.winter,
        tourismMultiplier: 0.8,
        eventFrequencyMultiplier: 0.9,
        outdoorGigModifier: 0.5,  // cold weather kills outdoor attendance
        streamingModifier: 1.25,  // cozy indoor listening
        merchModifier: 1.2,       // holiday gift buying
        description: "Holiday season! Streaming is up, Classical and Jazz thrive. Outdoor gigs suffer.",
      };
    case "spring":
      return {
        season,
        genreBoosts: SEASONAL_GENRE_BOOSTS.spring,
        tourismMultiplier: 1.1,
        eventFrequencyMultiplier: 1.1,
        outdoorGigModifier: 1.1,
        streamingModifier: 1.05,
        merchModifier: 1.0,
        description: "New beginnings! Indie and Folk blossom. Touring picks up as weather improves.",
      };
    case "autumn":
      return {
        season,
        genreBoosts: SEASONAL_GENRE_BOOSTS.autumn,
        tourismMultiplier: 0.95,
        eventFrequencyMultiplier: 1.15,
        outdoorGigModifier: 0.85,
        streamingModifier: 1.1,
        merchModifier: 0.95,
        description: "Rock and Metal season! Darker vibes, indoor venues, and album release season.",
      };
  }
}

/**
 * Get genre boost for a specific genre in a season.
 */
export function getSeasonalGenreBoost(genre: string, season: Season): number {
  const boosts = SEASONAL_GENRE_BOOSTS[season];
  return boosts[genre] ?? 1.0;
}

/**
 * Apply seasonal modifier to streaming numbers.
 */
export function applySeasonalStreaming(baseStreams: number, season: Season): number {
  const mods = getSeasonalModifiers(season);
  return Math.round(baseStreams * mods.streamingModifier);
}

/**
 * Apply seasonal + genre modifier to gig attendance.
 */
export function applySeasonalAttendance(
  baseAttendance: number,
  genre: string,
  season: Season,
  isOutdoor: boolean
): number {
  const mods = getSeasonalModifiers(season);
  const genreBoost = getSeasonalGenreBoost(genre, season);
  const outdoorMod = isOutdoor ? mods.outdoorGigModifier : 1.0;
  return Math.round(baseAttendance * genreBoost * outdoorMod * mods.tourismMultiplier);
}
