/**
 * XP reward calculations for clothing system activities.
 */

/**
 * XP awarded when a player creates a new clothing item.
 * Scales with the item's quality score.
 */
export function getClothingCreationXp(qualityScore: number): number {
  // 30 base + up to 50 bonus from quality (0-100 → 0-50)
  return Math.floor(30 + (qualityScore / 100) * 50);
}

/**
 * XP awarded per clothing sale.
 */
export function getClothingSaleXp(): number {
  return 10;
}

/**
 * XP awarded for completing a modeling gig, by gig type.
 */
export function getModelingGigXp(gigType: string): number {
  const XP_MAP: Record<string, number> = {
    runway: 60,
    cover_shoot: 50,
    commercial: 40,
    brand_ambassador: 45,
    photo_shoot: 35,
    music_video_cameo: 30,
    editorial: 70,
    fashion_week: 80,
  };
  return XP_MAP[gigType] ?? 35;
}

/**
 * Determine which modeling skill slug should receive XP for a given gig type.
 */
export function getModelingGigSkillSlug(gigType: string): string {
  const SLUG_MAP: Record<string, string> = {
    runway: 'modeling_basic_runway',
    cover_shoot: 'modeling_basic_camera',
    commercial: 'modeling_basic_commercial',
    brand_ambassador: 'modeling_basic_brand',
    photo_shoot: 'modeling_basic_posing',
    music_video_cameo: 'modeling_basic_camera',
    editorial: 'modeling_professional_editorial',
    fashion_week: 'modeling_professional_runway',
  };
  return SLUG_MAP[gigType] ?? 'modeling_basic_posing';
}
