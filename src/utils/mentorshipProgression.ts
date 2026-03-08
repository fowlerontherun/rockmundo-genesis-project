/**
 * Mentorship Progression System (v1.0.931)
 * Experienced players mentor newer ones. Both get bonuses — mentor gets fame/XP, mentee gets accelerated growth.
 */

export interface MentorshipBonuses {
  mentorXpPerDay: number;
  mentorFamePerDay: number;
  menteeXpMultiplier: number;       // 1.0 – 1.5x XP gain multiplier
  menteeSkillBoostPercent: number;  // extra % on skill practice
  synergyScore: number;             // 0-100
}

interface MentorStats {
  level: number;
  totalFame: number;
  skillLevels: Record<string, number>;
  teachingExperience: number; // number of mentees taught
}

interface MenteeStats {
  level: number;
  skillLevels: Record<string, number>;
}

/**
 * Calculate mentorship bonuses based on the gap between mentor and mentee.
 */
export function calculateMentorshipBonuses(mentor: MentorStats, mentee: MenteeStats): MentorshipBonuses {
  const levelGap = Math.max(0, mentor.level - mentee.level);

  // Bigger gap = more beneficial mentorship (up to a point)
  const effectiveGap = Math.min(levelGap, 30);

  // Synergy based on gap sweet spot (5-20 levels = best)
  const synergyScore = effectiveGap >= 5 && effectiveGap <= 20
    ? 60 + (effectiveGap - 5) * 2.5
    : effectiveGap < 5
      ? effectiveGap * 12
      : Math.max(40, 100 - (effectiveGap - 20) * 3);

  // Mentor rewards scale with teaching experience
  const expBonus = Math.min(1.5, 1 + mentor.teachingExperience * 0.05);
  const mentorXpPerDay = Math.round(10 + effectiveGap * 2 * expBonus);
  const mentorFamePerDay = Math.round(2 + effectiveGap * 0.5);

  // Mentee acceleration
  const menteeXpMultiplier = parseFloat((1.0 + Math.min(0.5, effectiveGap * 0.025)).toFixed(2));
  const menteeSkillBoostPercent = Math.round(Math.min(25, effectiveGap * 1.5));

  return {
    mentorXpPerDay,
    mentorFamePerDay,
    menteeXpMultiplier,
    menteeSkillBoostPercent,
    synergyScore: Math.round(synergyScore),
  };
}

/**
 * Check if a player qualifies as a mentor.
 * Requirements: level 15+, at least one skill at "Professional" tier (level 50+).
 */
export function canBeMentor(level: number, skillLevels: Record<string, number>): boolean {
  if (level < 15) return false;
  return Object.values(skillLevels).some(v => v >= 50);
}

/**
 * Calculate shared skill overlap for mentor matching.
 */
export function getMentorSkillMatch(
  mentorSkills: Record<string, number>,
  menteeSkills: Record<string, number>
): { matchedSkills: string[]; averageGap: number } {
  const matchedSkills: string[] = [];
  let totalGap = 0;

  for (const [skill, mentorLevel] of Object.entries(mentorSkills)) {
    const menteeLevel = menteeSkills[skill] ?? 0;
    if (mentorLevel > menteeLevel + 10) {
      matchedSkills.push(skill);
      totalGap += mentorLevel - menteeLevel;
    }
  }

  return {
    matchedSkills,
    averageGap: matchedSkills.length > 0 ? Math.round(totalGap / matchedSkills.length) : 0,
  };
}
