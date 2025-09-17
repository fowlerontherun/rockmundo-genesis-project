// Game balance and progression logic for RockMundo

export const SKILL_CAPS = {
  beginner: 30, // 0-1000 exp
  amateur: 50, // 1000-5000 exp
  professional: 80, // 5000-20000 exp
  master: 100 // 20000+ exp
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

export type AttributeKey =
  | "looks"
  | "charisma"
  | "musicality"
  | "mental_focus"
  | "physical_endurance";

export type AttributeFocus = "general" | "instrumental" | "performance" | "songwriting" | "vocals";

export type AttributeScores = Partial<Record<AttributeKey, number | null | undefined>>;

const ATTRIBUTE_KEYS: AttributeKey[] = [
  "looks",
  "charisma",
  "musicality",
  "mental_focus",
  "physical_endurance"
];

const ATTRIBUTE_FOCUS_WEIGHTS: Record<AttributeFocus, Array<{ key: AttributeKey; weight: number }>> = {
  general: [
    { key: "musicality", weight: 0.4 },
    { key: "charisma", weight: 0.35 },
    { key: "looks", weight: 0.25 }
  ],
  instrumental: [
    { key: "musicality", weight: 0.75 },
    { key: "charisma", weight: 0.25 }
  ],
  performance: [
    { key: "charisma", weight: 0.6 },
    { key: "looks", weight: 0.4 }
  ],
  songwriting: [
    { key: "musicality", weight: 0.7 },
    { key: "charisma", weight: 0.3 }
  ],
  vocals: [
    { key: "charisma", weight: 0.55 },
    { key: "musicality", weight: 0.45 }
  ]
};

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const clampAttributeScore = (value: number | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (numeric >= 0 && numeric <= 3) {
    return clampNumber(Math.round(((numeric - 1) / 2) * 1000), 0, 1000);
  }

  return clampNumber(Math.round(numeric), 0, 1000);
};

export const attributeScoreToMultiplier = (
  value: number | null | undefined,
  maxBonus = 0.5,
  baseMultiplier = 1
): number => {
  if (value === null || value === undefined) {
    return baseMultiplier;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return baseMultiplier;
  }

  if (numeric > 0 && numeric <= 3) {
    return clampNumber(numeric, 0.25, baseMultiplier + maxBonus);
  }

  const normalized = clampAttributeScore(numeric);
  const multiplier = baseMultiplier + (normalized / 1000) * maxBonus;
  return clampNumber(multiplier, 0.25, baseMultiplier + maxBonus);
};

export const extractAttributeScores = (source: unknown): AttributeScores => {
  if (!source || typeof source !== "object") {
    return {};
  }

  const record = source as Record<string, unknown>;
  return ATTRIBUTE_KEYS.reduce<AttributeScores>((accumulator, key) => {
    const raw = record[key];
    if (typeof raw === "number") {
      accumulator[key] = raw;
      return accumulator;
    }

    if (raw && typeof raw === "object" && "value" in raw) {
      const nested = (raw as { value?: unknown }).value;
      if (typeof nested === "number") {
        accumulator[key] = nested;
      }
    }

    return accumulator;
  }, {});
};

const getCombinedAttributeScore = (
  attributes: AttributeScores | null | undefined,
  weights: Array<{ key: AttributeKey; weight: number }>
): number => {
  if (!attributes || weights.length === 0) {
    return 0;
  }

  let weightedTotal = 0;
  let totalWeight = 0;

  for (const { key, weight } of weights) {
    const resolvedWeight = Number.isFinite(weight) ? Number(weight) : 0;
    if (resolvedWeight <= 0) {
      continue;
    }

    const rawValue = attributes[key];
    const score = clampAttributeScore(rawValue ?? 0);
    weightedTotal += score * resolvedWeight;
    totalWeight += resolvedWeight;
  }

  if (totalWeight <= 0) {
    return 0;
  }

  return Math.round(weightedTotal / totalWeight);
};

export const getFocusAttributeScore = (
  attributes: AttributeScores | null | undefined,
  focus: AttributeFocus
): number => {
  const weights = ATTRIBUTE_FOCUS_WEIGHTS[focus] ?? ATTRIBUTE_FOCUS_WEIGHTS.general;
  return getCombinedAttributeScore(attributes, weights);
};

export const calculateExperienceReward = (
  baseExperience: number,
  attributes?: AttributeScores,
  focus: AttributeFocus = "general"
): number => {
  const normalizedBase = Number.isFinite(baseExperience) ? baseExperience : 0;
  if (normalizedBase <= 0) {
    return 0;
  }

  const focusScore = getFocusAttributeScore(attributes, focus);
  const focusMultiplier = attributeScoreToMultiplier(focusScore, focus === "performance" ? 0.45 : focus === "instrumental" ? 0.4 : 0.35);
  const mentalFocusMultiplier = attributeScoreToMultiplier(attributes?.mental_focus ?? null, 0.3);

  return Math.max(0, Math.round(normalizedBase * focusMultiplier * mentalFocusMultiplier));
};

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
export function calculateTrainingCost(
  currentSkillLevel: number,
  attributes?: AttributeScores,
  focus: AttributeFocus = "general"
): number {
  const baseCost = TRAINING_COSTS.skillTraining(currentSkillLevel);
  if (baseCost <= 0) {
    return 0;
  }

  const focusScore = getFocusAttributeScore(attributes, focus);
  const costReduction = clampNumber(focusScore / 1000, 0, 1) * 0.25; // Up to 25% reduction
  const reductionMultiplier = 1 - costReduction;

  const adjustedCost = Math.round(baseCost * reductionMultiplier);
  return Math.max(25, adjustedCost);
}

// Calculate success rate for activities based on skills
export function calculateSuccessRate(
  requiredSkills: Record<string, number>,
  playerSkills: Record<string, number>,
  attributes?: AttributeScores,
  focus: AttributeFocus = "general"
): number {
  const skillChecks = Object.entries(requiredSkills).map(([skill, required]) => {
    const playerLevel = playerSkills[skill] || 0;
    return Math.min(playerLevel / required, 1.0);
  });

  // Average of all skill checks, minimum 10% success
  const averageCheck = skillChecks.reduce((sum, check) => sum + check, 0) / skillChecks.length;
  const attributeMultiplier = attributeScoreToMultiplier(getFocusAttributeScore(attributes, focus), 0.35);
  return Math.min(1, Math.max(averageCheck, 0.1) * attributeMultiplier);
}

// Calculate gig payment based on venue and performance
export function calculateGigPayment(
  basePayment: number,
  performanceSkill: number,
  fameLevel: number,
  successRate: number,
  attributes?: AttributeScores
): number {
  const skillMultiplier = 1 + (performanceSkill / 100);
  const fameMultiplier = 1 + (fameLevel / 10000);
  const performanceMultiplier = 0.5 + (successRate * 0.5); // 50% to 100% based on success

  const charismaMultiplier = attributeScoreToMultiplier(attributes?.charisma ?? null, 0.4);
  const looksMultiplier = attributeScoreToMultiplier(attributes?.looks ?? null, 0.25);
  const musicalityMultiplier = attributeScoreToMultiplier(attributes?.musicality ?? null, 0.2);

  return Math.floor(
    basePayment * skillMultiplier * fameMultiplier * performanceMultiplier * charismaMultiplier * looksMultiplier * musicalityMultiplier
  );
}

// Calculate fan gain from activities
export function calculateFanGain(
  baseGain: number,
  performanceSkill: number,
  attributes?: AttributeScores
): number {
  const skillMultiplier = 1 + (performanceSkill / 200); // Max 50% bonus
  const charismaMultiplier = attributeScoreToMultiplier(attributes?.charisma ?? null, 0.5);
  const looksMultiplier = attributeScoreToMultiplier(attributes?.looks ?? null, 0.3);

  return Math.floor(baseGain * skillMultiplier * charismaMultiplier * looksMultiplier);
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