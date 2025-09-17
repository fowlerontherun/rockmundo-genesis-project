// Game balance and progression logic for RockMundo

import { getAttributeMultiplier } from "./attributeModifiers";

export interface PerformanceAttributeBonuses {
  stagePresence?: number | null;
  crowdEngagement?: number | null;
  socialReach?: number | null;
}

const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const resolveAttributeFactor = (
  rawValue: number | null | undefined,
  intensity: number
) => {
  const multiplier = getAttributeMultiplier(rawValue, { fallback: 1 });
  return 1 + (multiplier - 1) * intensity;
};

export const SKILL_CAPS = {
  beginner: 30,    // 0-1000 exp
  amateur: 50,     // 1000-5000 exp  
  professional: 80, // 5000-20000 exp
  master: 100      // 20000+ exp
} as const;

export const LEVEL_REQUIREMENTS = {
  experiencePerLevel: 1000,
  maxLevel: 100
} as const;

export const TRAINING_COSTS = {
  skillTraining: (currentLevel: number) => Math.floor(100 * Math.pow(1.5, currentLevel / 10)),
  equipmentRepair: (itemValue: number) => Math.floor(itemValue * 0.1),
  recordingSession: (quality: number) => Math.floor(500 + (quality * 10))
} as const;

export const COOLDOWNS = {
  skillTraining: 4 * 60 * 60 * 1000, // 4 hours in milliseconds
  gigPerformance: 24 * 60 * 60 * 1000, // 24 hours
  songRecording: 2 * 60 * 60 * 1000, // 2 hours
  socialPost: 30 * 60 * 1000 // 30 minutes
} as const;

export const FAME_THRESHOLDS = {
  localTalent: 100,
  risingArtist: 500,
  knownPerformer: 1000,
  regionalStar: 5000,
  nationalAct: 15000,
  globalIcon: 50000,
  legend: 100000
} as const;

// Calculate player level from experience
export function calculateLevel(experience: number): number {
  return Math.min(
    Math.floor(experience / LEVEL_REQUIREMENTS.experiencePerLevel) + 1,
    LEVEL_REQUIREMENTS.maxLevel
  );
}

// Calculate experience needed for next level
export function experienceToNextLevel(experience: number): number {
  const currentLevel = calculateLevel(experience);
  if (currentLevel >= LEVEL_REQUIREMENTS.maxLevel) return 0;
  
  const nextLevelExp = currentLevel * LEVEL_REQUIREMENTS.experiencePerLevel;
  return nextLevelExp - (experience % LEVEL_REQUIREMENTS.experiencePerLevel);
}

// Get skill cap based on player level/experience
export function getSkillCap(playerLevel: number, totalExperience: number): number {
  if (totalExperience >= 20000) return SKILL_CAPS.master;
  if (totalExperience >= 5000) return SKILL_CAPS.professional;
  if (totalExperience >= 1000) return SKILL_CAPS.amateur;
  return SKILL_CAPS.beginner;
}

// Calculate training cost for a skill
export function calculateTrainingCost(currentSkillLevel: number): number {
  return TRAINING_COSTS.skillTraining(currentSkillLevel);
}

// Calculate success rate for activities based on skills
export function calculateSuccessRate(
  requiredSkills: Record<string, number>,
  playerSkills: Record<string, number>
): number {
  const skillChecks = Object.entries(requiredSkills).map(([skill, required]) => {
    const playerLevel = playerSkills[skill] || 0;
    return Math.min(playerLevel / required, 1.0);
  });
  
  // Average of all skill checks, minimum 10% success
  const averageCheck = skillChecks.reduce((sum, check) => sum + check, 0) / skillChecks.length;
  return Math.max(averageCheck, 0.1);
}

// Calculate gig payment based on venue and performance
export function calculateGigPayment(
  basePayment: number,
  performanceSkill: number,
  fameLevel: number,
  successRate: number,
  attributeBonuses: PerformanceAttributeBonuses = {}
): number {
  const baseSkillMultiplier = 1 + clampNumber(performanceSkill, 0, 150) / 100;
  const stagePresenceFactor = attributeBonuses.stagePresence !== undefined
    ? resolveAttributeFactor(attributeBonuses.stagePresence, 0.4)
    : 1;
  const fameMultiplier = 1 + clampNumber(fameLevel, 0, 100000) / 10000;
  const successMultiplier = 0.5 + clampNumber(successRate, 0, 1) * 0.5;
  const crowdFactor = attributeBonuses.crowdEngagement !== undefined
    ? resolveAttributeFactor(attributeBonuses.crowdEngagement, 0.35)
    : 1;

  return Math.floor(
    basePayment * baseSkillMultiplier * stagePresenceFactor * fameMultiplier * successMultiplier * crowdFactor
  );
}

// Calculate fan gain from activities
export function calculateFanGain(
  baseGain: number,
  performanceSkill: number,
  charismaBonus: number = 0,
  attributeBonuses: PerformanceAttributeBonuses = {}
): number {
  const skillMultiplier = 1 + clampNumber(performanceSkill, 0, 150) / 200;
  const charismaMultiplier = 1 + clampNumber(charismaBonus, 0, 200) / 100;
  const stagePresenceFactor = attributeBonuses.stagePresence !== undefined
    ? resolveAttributeFactor(attributeBonuses.stagePresence, 0.35)
    : 1;
  const crowdFactor = attributeBonuses.crowdEngagement !== undefined
    ? resolveAttributeFactor(attributeBonuses.crowdEngagement, 0.45)
    : 1;
  const socialFactor = attributeBonuses.socialReach !== undefined
    ? resolveAttributeFactor(attributeBonuses.socialReach, 0.55)
    : 1;

  return Math.floor(baseGain * skillMultiplier * stagePresenceFactor * charismaMultiplier * crowdFactor * socialFactor);
}

// Check if player meets requirements for an activity
export function meetsRequirements(
  requirements: Record<string, number>,
  playerStats: Record<string, number>
): { meets: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const [requirement, value] of Object.entries(requirements)) {
    const playerValue = playerStats[requirement] || 0;
    if (playerValue < value) {
      missing.push(`${requirement}: ${value} (you have ${playerValue})`);
    }
  }
  
  return {
    meets: missing.length === 0,
    missing
  };
}

// Calculate equipment effectiveness bonus
export function calculateEquipmentBonus(
  equippedItems: Array<{ stat_boosts: Record<string, number> }>
): Record<string, number> {
  const totalBonus: Record<string, number> = {};
  
  equippedItems.forEach(item => {
    Object.entries(item.stat_boosts).forEach(([stat, boost]) => {
      totalBonus[stat] = (totalBonus[stat] || 0) + boost;
    });
  });
  
  return totalBonus;
}

// Get fame level title
export function getFameTitle(fame: number): string {
  if (fame >= FAME_THRESHOLDS.legend) return "Living Legend";
  if (fame >= FAME_THRESHOLDS.globalIcon) return "Global Icon";
  if (fame >= FAME_THRESHOLDS.nationalAct) return "National Act";
  if (fame >= FAME_THRESHOLDS.regionalStar) return "Regional Star";
  if (fame >= FAME_THRESHOLDS.knownPerformer) return "Known Performer";
  if (fame >= FAME_THRESHOLDS.risingArtist) return "Rising Artist";
  if (fame >= FAME_THRESHOLDS.localTalent) return "Local Talent";
  return "Unknown Artist";
}

// Check cooldown status
export function isOnCooldown(lastAction: string | Date, cooldownMs: number): boolean {
  if (!lastAction) return false;
  const lastTime = typeof lastAction === 'string' ? new Date(lastAction) : lastAction;
  return Date.now() - lastTime.getTime() < cooldownMs;
}

// Get remaining cooldown time in minutes
export function getRemainingCooldown(lastAction: string | Date, cooldownMs: number): number {
  if (!lastAction) return 0;
  const lastTime = typeof lastAction === 'string' ? new Date(lastAction) : lastAction;
  const remaining = cooldownMs - (Date.now() - lastTime.getTime());
  return Math.max(0, Math.ceil(remaining / 60000)); // Convert to minutes
}