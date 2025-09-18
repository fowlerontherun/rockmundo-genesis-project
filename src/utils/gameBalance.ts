// Game balance and progression logic for RockMundo

export interface PerformanceAttributeBonuses {
  stagePresence?: number | null;
  crowdEngagement?: number | null;
  socialReach?: number | null;
}

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const SKILL_CAPS = {
  beginner: 300, // 0-1000 exp
  amateur: 500, // 1000-5000 exp
  professional: 800, // 5000-20000 exp
  master: 1000 // 20000+ exp
} as const;

export const LEVEL_REQUIREMENTS = {
  experiencePerLevel: 1000,
  maxLevel: 100
} as const;

export const TRAINING_COSTS = {
  skillTraining: (currentLevel: number) => Math.floor(100 * Math.pow(1.5, currentLevel / 10)),
  equipmentRepair: (itemValue: number) => Math.floor(itemValue * 0.1),
  recordingSession: (quality: number) => Math.floor(500 + quality * 10)
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

const FOCUS_MAX_BONUS: Record<AttributeFocus, number> = {
  general: 0.35,
  instrumental: 0.4,
  performance: 0.45,
  songwriting: 0.4,
  vocals: 0.4
};

const STAMINA_FOCUSES: ReadonlySet<AttributeFocus> = new Set(["instrumental", "performance"]);

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
      const numeric = typeof nested === "number" ? nested : Number(nested);
      if (Number.isFinite(numeric)) {
        accumulator[key] = numeric;
      }
      return accumulator;
    }

    const numeric = typeof raw === "string" ? Number(raw) : NaN;
    if (Number.isFinite(numeric)) {
      accumulator[key] = numeric;
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

  const focusScore = getFocusAttributeScore(attributes ?? null, focus);
  const focusMaxBonus = FOCUS_MAX_BONUS[focus] ?? FOCUS_MAX_BONUS.general;
  const focusMultiplier = attributeScoreToMultiplier(focusScore, focusMaxBonus);
  const mentalMultiplier = attributeScoreToMultiplier(attributes?.mental_focus ?? null, 0.3);
  const staminaMultiplier = STAMINA_FOCUSES.has(focus)
    ? attributeScoreToMultiplier(attributes?.physical_endurance ?? null, 0.2)
    : 1;

  const totalMultiplier = focusMultiplier * mentalMultiplier * staminaMultiplier;
  return Math.max(0, Math.round(normalizedBase * totalMultiplier));
};

export function calculateLevel(experience: number): number {
  return Math.min(
    Math.floor(experience / LEVEL_REQUIREMENTS.experiencePerLevel) + 1,
    LEVEL_REQUIREMENTS.maxLevel
  );
}

export function experienceToNextLevel(experience: number): number {
  const currentLevel = calculateLevel(experience);
  if (currentLevel >= LEVEL_REQUIREMENTS.maxLevel) return 0;

  const nextLevelExp = currentLevel * LEVEL_REQUIREMENTS.experiencePerLevel;
  return nextLevelExp - (experience % LEVEL_REQUIREMENTS.experiencePerLevel);
}

export function getSkillCap(playerLevel: number, totalExperience: number): number {
  if (totalExperience >= 20000) return SKILL_CAPS.master;
  if (totalExperience >= 5000) return SKILL_CAPS.professional;
  if (totalExperience >= 1000) return SKILL_CAPS.amateur;
  return Math.max(SKILL_CAPS.beginner, Math.min(SKILL_CAPS.master, Math.round(playerLevel * 0.8)));
}

export function calculateTrainingCost(
  currentSkillLevel: number,
  attributes?: AttributeScores,
  focus: AttributeFocus = "general"
): number {
  const normalizedSkillLevel = clampNumber(currentSkillLevel / 10, 0, 100);
  const baseCost = TRAINING_COSTS.skillTraining(normalizedSkillLevel);
  if (baseCost <= 0) {
    return 0;
  }

  const focusScore = getFocusAttributeScore(attributes ?? null, focus);
  const mentalScore = clampAttributeScore(attributes?.mental_focus ?? null);
  const staminaScore = clampAttributeScore(attributes?.physical_endurance ?? null);

  const focusReduction = clampNumber(focusScore / 1000, 0, 1) * 0.2;
  const mentalReduction = clampNumber(mentalScore / 1000, 0, 1) * 0.15;
  const staminaReduction = STAMINA_FOCUSES.has(focus)
    ? clampNumber(staminaScore / 1000, 0, 1) * 0.1
    : 0;

  const totalReduction = clampNumber(focusReduction + mentalReduction + staminaReduction, 0, 0.45);
  const adjustedCost = Math.round(baseCost * (1 - totalReduction));
  return Math.max(25, adjustedCost);
}

export function calculateSuccessRate(
  requiredSkills: Record<string, number>,
  playerSkills: Record<string, number>,
  attributes?: AttributeScores,
  focus: AttributeFocus = "general"
): number {
  const entries = Object.entries(requiredSkills);
  if (entries.length === 0) {
    return 1;
  }

  const skillChecks = entries.map(([skill, required]) => {
    const playerLevel = playerSkills[skill] || 0;
    if (required <= 0) {
      return 1;
    }
    return Math.min(playerLevel / required, 1.0);
  });

  const averageCheck = skillChecks.reduce((sum, check) => sum + check, 0) / skillChecks.length;
  const attributeMultiplier = attributeScoreToMultiplier(getFocusAttributeScore(attributes ?? null, focus), 0.35);
  return Math.min(1, Math.max(averageCheck, 0.1) * attributeMultiplier);
}

export function calculateGigPayment(
  basePayment: number,
  performanceSkill: number,
  fameLevel: number,
  successRate: number,
  attributes?: AttributeScores
): number {
  const normalizedBase = Math.max(0, toFiniteNumber(basePayment, 0));
  if (normalizedBase <= 0) {
    return 0;
  }

  const normalizedSkill = clampNumber(performanceSkill / 1000, 0, 1);
  const skillMultiplier = 1 + normalizedSkill;
  const fameMultiplier = 1 + fameLevel / 10000;
  const performanceMultiplier = 0.5 + successRate * 0.5;

  const charismaMultiplier = attributeScoreToMultiplier(attributes?.charisma ?? null, 0.4);
  const looksMultiplier = attributeScoreToMultiplier(attributes?.looks ?? null, 0.25);
  const musicalityMultiplier = attributeScoreToMultiplier(attributes?.musicality ?? null, 0.2);

  return Math.floor(
    normalizedBase *
      skillMultiplier *
      fameMultiplier *
      performanceMultiplier *
      charismaMultiplier *
      looksMultiplier *
      musicalityMultiplier
  );
}

export function calculateFanGain(
  baseGain: number,
  performanceSkill: number,
  attributes?: AttributeScores
): number {
  const normalizedBase = Math.max(0, toFiniteNumber(baseGain, 0));
  if (normalizedBase <= 0) {
    return 0;
  }

  const normalizedSkill = clampNumber(performanceSkill / 1000, 0, 1);
  const skillMultiplier = 1 + normalizedSkill * 0.5;
  const charismaMultiplier = attributeScoreToMultiplier(attributes?.charisma ?? null, 0.5);
  const looksMultiplier = attributeScoreToMultiplier(attributes?.looks ?? null, 0.3);

  return Math.floor(normalizedBase * skillMultiplier * charismaMultiplier * looksMultiplier);
}

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

export function isOnCooldown(lastAction: string | Date | null | undefined, cooldownMs: number): boolean {
  if (!lastAction) return false;
  const lastTime = typeof lastAction === "string" ? new Date(lastAction) : lastAction;
  if (Number.isNaN(lastTime.getTime())) {
    return false;
  }
  return Date.now() - lastTime.getTime() < cooldownMs;
}

export function getRemainingCooldown(
  lastAction: string | Date | null | undefined,
  cooldownMs: number
): number {
  if (!lastAction) return 0;
  const lastTime = typeof lastAction === "string" ? new Date(lastAction) : lastAction;
  if (Number.isNaN(lastTime.getTime())) {
    return 0;
  }
  const remaining = cooldownMs - (Date.now() - lastTime.getTime());
  return Math.max(0, Math.ceil(remaining / 60000));
}
