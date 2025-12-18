/**
 * Skill Decline System
 * Skills start declining at age 60, with 2% reduction per year
 * Maximum decline is 50% of original value
 */

export interface SkillSnapshot {
  skillId: string;
  skillName: string;
  baseValue: number;
}

export interface DeclinedSkill extends SkillSnapshot {
  currentValue: number;
  declinePercent: number;
}

/**
 * Calculate skill decline based on age
 * @param baseSkillValue - The original skill value at age 60
 * @param playerAge - Current player age
 * @param declineStartAge - Age when decline begins (default 60)
 * @returns Adjusted skill value after decline
 */
export function calculateSkillDecline(
  baseSkillValue: number,
  playerAge: number,
  declineStartAge: number = 60
): number {
  if (playerAge < declineStartAge) return baseSkillValue;

  // 2% decline per year after decline start age
  const yearsOverThreshold = playerAge - declineStartAge;
  const declinePercent = Math.min(yearsOverThreshold * 0.02, 0.5); // Max 50% decline

  return Math.round(baseSkillValue * (1 - declinePercent));
}

/**
 * Calculate decline percentage for display
 */
export function getDeclinePercentage(
  playerAge: number,
  declineStartAge: number = 60
): number {
  if (playerAge < declineStartAge) return 0;

  const yearsOverThreshold = playerAge - declineStartAge;
  return Math.min(yearsOverThreshold * 2, 50); // 2% per year, max 50%
}

/**
 * Apply decline to all skills
 */
export function applySkillDecline(
  skills: SkillSnapshot[],
  playerAge: number
): DeclinedSkill[] {
  return skills.map((skill) => {
    const currentValue = calculateSkillDecline(skill.baseValue, playerAge);
    const declinePercent = getDeclinePercentage(playerAge);

    return {
      ...skill,
      currentValue,
      declinePercent,
    };
  });
}

/**
 * Check if player should have skills snapshotted
 */
export function shouldSnapshotSkills(
  playerAge: number,
  hasSnapshot: boolean,
  snapshotAge: number = 60
): boolean {
  return playerAge >= snapshotAge && !hasSnapshot;
}

/**
 * Get retirement prompt ages
 */
export const RETIREMENT_AGES = {
  FIRST_PROMPT: 65,
  SECOND_PROMPT: 70,
  THIRD_PROMPT: 75,
  MANDATORY: 80,
} as const;

/**
 * Check if player should see retirement prompt
 */
export function shouldPromptRetirement(
  playerAge: number,
  lastPromptAge: number = 0
): { shouldPrompt: boolean; isMandatory: boolean } {
  const isMandatory = playerAge >= RETIREMENT_AGES.MANDATORY;

  const shouldPrompt =
    isMandatory ||
    (playerAge >= RETIREMENT_AGES.FIRST_PROMPT && lastPromptAge < RETIREMENT_AGES.FIRST_PROMPT) ||
    (playerAge >= RETIREMENT_AGES.SECOND_PROMPT && lastPromptAge < RETIREMENT_AGES.SECOND_PROMPT) ||
    (playerAge >= RETIREMENT_AGES.THIRD_PROMPT && lastPromptAge < RETIREMENT_AGES.THIRD_PROMPT);

  return { shouldPrompt, isMandatory };
}
