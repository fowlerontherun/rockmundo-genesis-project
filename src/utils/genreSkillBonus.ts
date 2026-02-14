/**
 * Calculate genre skill bonus for recording and gig performance.
 * Players who have trained in a genre's skill tree get a quality/performance bonus
 * when recording or performing songs of that genre.
 */

import { supabase } from "@/integrations/supabase/client";
import { getAllGenreSkillSlugs } from "@/data/genres";
import type { SkillProgressEntry } from "./skillGearPerformance";
import { getTieredBonusPercent } from "./tieredSkillBonus";

export interface GenreSkillBonus {
  /** Multiplier to apply (1.0 = no bonus, up to ~1.20 = 20% bonus) */
  multiplier: number;
  /** Bonus percentage (0-20) */
  bonusPercent: number;
  /** The genre that was matched */
  genre: string;
  /** Highest genre skill level found (0-20) */
  genreSkillLevel: number;
}

const NO_BONUS: GenreSkillBonus = {
  multiplier: 1.0,
  bonusPercent: 0,
  genre: '',
  genreSkillLevel: 0,
};

/**
 * Calculate genre skill bonus from already-fetched skill progress entries.
 * @param progress Array of skill progress entries for the player
 * @param genre The song or band genre to check against
 * @returns GenreSkillBonus with multiplier and breakdown
 */
export function calculateGenreSkillBonus(
  progress: SkillProgressEntry[] | null,
  genre: string | null
): GenreSkillBonus {
  if (!progress || progress.length === 0 || !genre) return NO_BONUS;

  const genreSlugs = getAllGenreSkillSlugs(genre);
  if (genreSlugs.length === 0) return NO_BONUS;

  // Find the highest level across all tiers for this genre
  let maxLevel = 0;
  for (const slug of genreSlugs) {
    const entry = progress.find(p => p.skill_slug === slug);
    if (entry?.current_level != null && entry.current_level > maxLevel) {
      maxLevel = entry.current_level;
    }
  }

  if (maxLevel === 0) return NO_BONUS;

  // Tiered bonus: higher levels give progressively more, mastery (20) gets a flat bonus
  // Raw curve goes 0-28%, we use it directly for genre (up to 28% at mastery)
  const bonusPercent = getTieredBonusPercent(maxLevel);
  const multiplier = 1 + bonusPercent / 100;

  return {
    multiplier: Number(multiplier.toFixed(3)),
    bonusPercent: Math.round(bonusPercent * 10) / 10,
    genre,
    genreSkillLevel: maxLevel,
  };
}

/**
 * Fetch skill progress and calculate genre bonus for a profile.
 * Convenience wrapper that handles the DB query.
 */
export async function fetchGenreSkillBonus(
  profileId: string,
  genre: string | null
): Promise<GenreSkillBonus> {
  if (!genre) return NO_BONUS;

  const genreSlugs = getAllGenreSkillSlugs(genre);
  if (genreSlugs.length === 0) return NO_BONUS;

  const { data: skillData } = await supabase
    .from('skill_progress')
    .select('skill_slug, current_level')
    .eq('profile_id', profileId)
    .in('skill_slug', genreSlugs);

  return calculateGenreSkillBonus(
    (skillData || []) as SkillProgressEntry[],
    genre
  );
}

/**
 * Calculate average genre bonus across all band members for a given genre.
 */
export async function calculateBandGenreBonus(
  bandId: string,
  genre: string | null
): Promise<GenreSkillBonus> {
  if (!genre) return NO_BONUS;

  const { data: members } = await supabase
    .from('band_members')
    .select('user_id')
    .eq('band_id', bandId)
    .eq('is_touring_member', false);

  if (!members || members.length === 0) return NO_BONUS;

  let totalBonus = 0;
  let maxLevel = 0;
  let count = 0;

  for (const member of members) {
    if (!member.user_id) continue;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', member.user_id)
      .single();

    if (!profile) continue;

    const bonus = await fetchGenreSkillBonus(profile.id, genre);
    totalBonus += bonus.bonusPercent;
    maxLevel = Math.max(maxLevel, bonus.genreSkillLevel);
    count++;
  }

  if (count === 0) return NO_BONUS;

  const avgBonus = totalBonus / count;
  return {
    multiplier: Number((1 + avgBonus / 100).toFixed(3)),
    bonusPercent: Math.round(avgBonus * 10) / 10,
    genre,
    genreSkillLevel: maxLevel,
  };
}
