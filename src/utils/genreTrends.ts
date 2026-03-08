/**
 * Genre Trend System (v1.0.930)
 * Genres rise and fall in popularity over time, affecting streams, fan conversion, and chart position.
 * Trends cycle on a ~90-day sine wave with random noise per genre.
 */

import { supabase } from "@/integrations/supabase/client";

export interface GenreTrend {
  genre: string;
  trendScore: number;       // 0.5 – 1.5  (1.0 = baseline)
  direction: "rising" | "falling" | "stable";
  label: string;            // "Hot 🔥" | "Trending ↑" | "Stable" | "Cooling ↓" | "Cold ❄️"
}

// Deterministic hash so the same genre + day always gives the same noise
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Calculate trend score for a genre on a given game day.
 * Returns 0.5 – 1.5 multiplier.
 */
export function getGenreTrendScore(genre: string, gameDay: number): number {
  const seed = hashCode(genre);
  const period = 60 + (seed % 60); // 60-120 day cycle per genre
  const phase = (seed % 360) * (Math.PI / 180);
  const wave = Math.sin((2 * Math.PI * gameDay) / period + phase);
  // Add slow drift
  const drift = Math.sin((2 * Math.PI * gameDay) / 300 + phase * 0.5) * 0.1;
  // Normalize to 0.5 – 1.5
  const raw = 1.0 + wave * 0.35 + drift;
  return Math.max(0.5, Math.min(1.5, parseFloat(raw.toFixed(3))));
}

/**
 * Get the trend direction by comparing today vs yesterday.
 */
export function getGenreTrendDirection(genre: string, gameDay: number): GenreTrend["direction"] {
  const today = getGenreTrendScore(genre, gameDay);
  const yesterday = getGenreTrendScore(genre, gameDay - 1);
  const delta = today - yesterday;
  if (delta > 0.005) return "rising";
  if (delta < -0.005) return "falling";
  return "stable";
}

function getTrendLabel(score: number, direction: GenreTrend["direction"]): string {
  if (score >= 1.3) return "Hot 🔥";
  if (score >= 1.1 && direction === "rising") return "Trending ↑";
  if (score <= 0.7) return "Cold ❄️";
  if (score <= 0.9 && direction === "falling") return "Cooling ↓";
  return "Stable";
}

/**
 * Get full trend info for a genre.
 */
export function getGenreTrend(genre: string, gameDay: number): GenreTrend {
  const trendScore = getGenreTrendScore(genre, gameDay);
  const direction = getGenreTrendDirection(genre, gameDay);
  return {
    genre,
    trendScore,
    direction,
    label: getTrendLabel(trendScore, direction),
  };
}

/**
 * Apply genre trend multiplier to a base value (streams, fan conversion, etc.)
 */
export function applyGenreTrend(baseValue: number, genre: string, gameDay: number): number {
  const score = getGenreTrendScore(genre, gameDay);
  return Math.round(baseValue * score);
}

/**
 * Get trends for all common genres on a given day.
 */
export function getAllGenreTrends(gameDay: number): GenreTrend[] {
  const genres = [...MUSIC_GENRES];
  return genres
    .map(g => getGenreTrend(g, gameDay))
    .sort((a, b) => b.trendScore - a.trendScore);
}

/**
 * Fetch current game day from profile or fallback.
 */
export async function getCurrentGameDay(userId: string): Promise<number> {
  const { data } = await supabase
    .from("profiles")
    .select("current_game_day")
    .eq("id", userId)
    .maybeSingle();
  return (data as any)?.current_game_day ?? 1;
}
