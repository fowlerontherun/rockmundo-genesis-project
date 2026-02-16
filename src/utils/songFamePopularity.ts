import { supabase } from "@/integrations/supabase/client";

/**
 * Song Fame, Popularity & Fan Favourite System (v1.0.744)
 */

// --- FAME ---

interface FameSources {
  streams: number;
  sales: number;
  radioPlays: number;
  hype: number;
  countries: number;
  gigPlays: number;
}

export function computeFameFromSources(sources: FameSources): number {
  return Math.floor(
    sources.streams / 1000 +
    sources.sales / 100 +
    sources.radioPlays * 2 +
    sources.hype / 50 +
    sources.countries * 5 +
    sources.gigPlays * 3
  );
}

export async function calculateSongFame(songId: string): Promise<number> {
  // Fetch streams from song_releases
  const { data: releases } = await supabase
    .from("song_releases")
    .select("total_streams")
    .eq("song_id", songId);
  const totalStreams = (releases || []).reduce((s, r) => s + (r.total_streams || 0), 0);

  // Fetch sales via release chain
  const { data: relSongs } = await supabase
    .from("release_songs")
    .select("release_id")
    .eq("song_id", songId);
  let totalSales = 0;
  if (relSongs && relSongs.length > 0) {
    const releaseIds = [...new Set(relSongs.map(r => r.release_id))];
    const { data: formats } = await supabase
      .from("release_formats")
      .select("id")
      .in("release_id", releaseIds);
    if (formats && formats.length > 0) {
      const { data: sales } = await supabase
        .from("release_sales")
        .select("quantity_sold")
        .in("release_format_id", formats.map(f => f.id));
      totalSales = (sales || []).reduce((s, r) => s + (r.quantity_sold || 0), 0);
    }
  }

  // Radio plays
  const { count: radioPlays } = await supabase
    .from("radio_plays")
    .select("id", { count: "exact", head: true })
    .eq("song_id", songId);

  // Hype from song_releases
  const { data: hypeData } = await supabase
    .from("song_releases")
    .select("hype")
    .eq("song_id", songId);
  const totalHype = (hypeData || []).reduce((s, r) => s + ((r as any).hype || 0), 0);

  // Countries (unique from song_releases or streaming data)
  const { data: countryData } = await supabase
    .from("song_releases")
    .select("country")
    .eq("song_id", songId);
  const uniqueCountries = new Set((countryData || []).map(r => (r as any).country).filter(Boolean)).size;

  // Gig play count from the song itself
  const { data: songData } = await supabase
    .from("songs")
    .select("gig_play_count")
    .eq("id", songId)
    .single();

  return computeFameFromSources({
    streams: totalStreams,
    sales: totalSales,
    radioPlays: radioPlays || 0,
    hype: totalHype,
    countries: uniqueCountries,
    gigPlays: (songData as any)?.gig_play_count || 0,
  });
}

// --- POPULARITY ---

export function calculatePopularityGain(gigPlayCount: number, isFanFavourite: boolean): number {
  const base = 15 / Math.sqrt(Math.max(1, gigPlayCount));
  const fanBonus = isFanFavourite ? 10 : 0;
  return Math.round(base + fanBonus);
}

export function calculateOverplayPenalty(recentGigCount: number): number {
  // If played 3+ times in 7 days, -20 per extra play
  if (recentGigCount >= 3) {
    return (recentGigCount - 2) * 20;
  }
  return 0;
}

export interface PopularityDecayInput {
  popularity: number;
  fame: number;
  lastGiggedAt: string | null;
  isFanFavourite: boolean;
}

export function applySongPopularityDecayOne(input: PopularityDecayInput): number {
  let pop = input.popularity;
  const daysSinceGig = input.lastGiggedAt
    ? Math.floor((Date.now() - new Date(input.lastGiggedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Natural decay
  if (pop > 100 && daysSinceGig > 0) {
    const decayRate = input.isFanFavourite ? 1 : 2;
    pop = Math.max(0, pop - decayRate);
  }

  // Recovery if rested 14+ days and famous enough
  if (daysSinceGig >= 14 && input.fame > 200) {
    const maxRecovery = Math.floor(input.fame / 2);
    if (pop < maxRecovery) {
      pop = Math.min(maxRecovery, pop + 5);
    }
  }

  return Math.max(0, Math.min(1000, pop));
}

// --- FAN FAVOURITE ---

export interface FanFavouriteRollInput {
  crowdResponse: string;
  isEncore: boolean;
  qualityScore: number;
  isArchived: boolean;
  isFanFavourite: boolean;
}

export function rollFanFavourite(input: FanFavouriteRollInput): boolean {
  if (input.isArchived || input.isFanFavourite) return false;

  let chance = 0.03; // 3% base
  if (input.crowdResponse === "ecstatic") chance += 0.07;
  if (input.isEncore) chance += 0.05;
  if (input.qualityScore < 40) chance /= 2;

  return Math.random() < chance;
}

export async function applyFanFavourite(songId: string, bandId: string): Promise<boolean> {
  // Check current fan favourite count for band (max 3)
  const { data: currentFavs } = await supabase
    .from("songs")
    .select("id, fan_favourite_at")
    .eq("band_id", bandId)
    .eq("is_fan_favourite", true)
    .order("fan_favourite_at", { ascending: true });

  if (currentFavs && currentFavs.length >= 3) {
    // Check if oldest can be replaced (30+ days)
    const oldest = currentFavs[0];
    if (oldest.fan_favourite_at) {
      const daysSince = Math.floor(
        (Date.now() - new Date(oldest.fan_favourite_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince < 30) return false;
      // Remove oldest
      await supabase
        .from("songs")
        .update({ is_fan_favourite: false, fan_favourite_at: null })
        .eq("id", oldest.id);
    } else {
      return false;
    }
  }

  // Set new fan favourite
  await supabase
    .from("songs")
    .update({ is_fan_favourite: true, fan_favourite_at: new Date().toISOString() })
    .eq("id", songId);

  return true;
}

// --- ENCORE FAME BONUS ---

export function getEncoreFameBonus(fame: number, isFanFavourite: boolean): number {
  if (isFanFavourite) return 1.25;
  if (fame >= 300) return 1.15;
  return 1.0;
}

// --- POST-GIG SONG UPDATES ---

export async function updateSongsAfterGig(
  songPerformances: Array<{
    song_id: string;
    crowd_response: string;
    position: number;
  }>,
  bandId: string,
  totalSongs: number
): Promise<void> {
  for (const perf of songPerformances) {
    const isEncore = perf.position > totalSongs - 1; // last song treated as encore

    // Fetch current song data
    const { data: song } = await supabase
      .from("songs")
      .select("id, popularity, fame, gig_play_count, is_fan_favourite, quality_score, archived")
      .eq("id", perf.song_id)
      .single();

    if (!song) continue;

    const newGigCount = ((song as any).gig_play_count || 0) + 1;
    const popGain = calculatePopularityGain(newGigCount, !!(song as any).is_fan_favourite);
    const newPop = Math.min(1000, ((song as any).popularity || 0) + popGain);

    // Calculate new fame
    const newFame = await calculateSongFame(perf.song_id);

    // Update song
    await supabase
      .from("songs")
      .update({
        gig_play_count: newGigCount,
        last_gigged_at: new Date().toISOString(),
        popularity: newPop,
        fame: Math.max((song as any).fame || 0, newFame),
      })
      .eq("id", perf.song_id);

    // Roll for fan favourite
    const became = rollFanFavourite({
      crowdResponse: perf.crowd_response,
      isEncore,
      qualityScore: (song as any).quality_score || 50,
      isArchived: !!(song as any).archived,
      isFanFavourite: !!(song as any).is_fan_favourite,
    });

    if (became) {
      const applied = await applyFanFavourite(perf.song_id, bandId);
      if (applied) {
        console.log(`[SongFame] "${perf.song_id}" became a Fan Favourite!`);
      }
    }
  }
}
