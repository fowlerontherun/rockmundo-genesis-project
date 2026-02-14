/**
 * Cover Song Quality Calculator
 * 
 * Cover quality scales based on the covering band's average skill level.
 * This prevents low-skill bands from exploiting top-ranked songs.
 */

export interface BandMemberSkills {
  skill_contribution: number; // 0-100 skill level
}

/**
 * Calculate the effective quality of a cover song based on band skill.
 * coverQuality = originalQuality * skillMultiplier
 * skillMultiplier = clamp(averageBandSkill / 100, 0.2, 1.0)
 */
export const calculateCoverQuality = (
  originalQuality: number,
  memberSkills: number[]
): { coverQuality: number; skillMultiplier: number } => {
  if (memberSkills.length === 0) {
    return { coverQuality: Math.round(originalQuality * 0.2), skillMultiplier: 0.2 };
  }

  const averageSkill = memberSkills.reduce((sum, s) => sum + s, 0) / memberSkills.length;
  const skillMultiplier = Math.min(1.0, Math.max(0.2, averageSkill / 100));
  const coverQuality = Math.round(originalQuality * skillMultiplier);

  return { coverQuality, skillMultiplier: Number(skillMultiplier.toFixed(2)) };
};

/**
 * Calculate the flat fee cost for covering a song.
 * Fee = quality_score * 10
 */
export const calculateCoverFee = (qualityScore: number): number => {
  return Math.max(50, qualityScore * 10);
};

/**
 * Get a human-readable description of how cover quality will be affected.
 */
export const getCoverQualityDescription = (
  originalQuality: number,
  skillMultiplier: number
): string => {
  const percentage = Math.round(skillMultiplier * 100);
  if (percentage >= 90) return "Your band can perform this at near-original quality!";
  if (percentage >= 70) return "Your band will deliver a solid cover of this song.";
  if (percentage >= 50) return "Decent cover, but the quality will be noticeably lower.";
  if (percentage >= 30) return "Your band needs more skill to do this song justice.";
  return "Your band will struggle with this song — consider easier covers first.";
};
