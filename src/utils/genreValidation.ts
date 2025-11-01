import { supabase } from "@/integrations/supabase/client";
import { getGenreSkillSlug, MUSIC_GENRES } from "@/data/genres";

/**
 * Validates that all genre skills exist in the database
 * Useful for debugging and ensuring data consistency
 */
export async function validateGenreSkills(): Promise<{
  valid: boolean;
  missing: string[];
  found: number;
  expected: number;
}> {
  const expectedSlugs = MUSIC_GENRES.flatMap(genre => [
    getGenreSkillSlug(genre, 'basic'),
    getGenreSkillSlug(genre, 'professional'),
    getGenreSkillSlug(genre, 'mastery')
  ]).filter(Boolean) as string[];

  const { data: existingSlugs, error } = await supabase
    .from('skill_definitions')
    .select('slug')
    .in('slug', expectedSlugs);

  if (error) {
    console.error('Error validating genre skills:', error);
    return {
      valid: false,
      missing: expectedSlugs,
      found: 0,
      expected: expectedSlugs.length
    };
  }

  const foundSlugs = new Set(existingSlugs?.map(s => s.slug) || []);
  const missingSlugs = expectedSlugs.filter(slug => !foundSlugs.has(slug));

  return {
    valid: missingSlugs.length === 0,
    missing: missingSlugs,
    found: foundSlugs.size,
    expected: expectedSlugs.length
  };
}

/**
 * Check if a player has the minimum skill level for a genre
 */
export function hasGenreSkill(
  genre: string, 
  skillLevels: Record<string, number>,
  tier: 'basic' | 'professional' | 'mastery' = 'basic'
): boolean {
  const skillSlug = getGenreSkillSlug(genre, tier);
  if (!skillSlug) return false;
  
  const requiredLevel = tier === 'basic' ? 1 : tier === 'professional' ? 50 : 100;
  
  // Check new format
  if ((skillLevels[skillSlug] || 0) >= requiredLevel) return true;
  
  // Check legacy format (basic_*, professional_*, mastery_*)
  const legacySlug = skillSlug.replace(`genres_${tier}_`, `${tier}_`);
  return (skillLevels[legacySlug] || 0) >= requiredLevel;
}
