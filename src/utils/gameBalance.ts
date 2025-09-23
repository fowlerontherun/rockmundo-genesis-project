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

const ATTRIBUTE_STAR_XP_VALUE = 400;
const ATTRIBUTE_STAR_REWARD_BONUS = 0.005;
const ATTRIBUTE_STAR_REWARD_MAX_BONUS = 0.25;

export interface ExperienceWalletSnapshot {
  xpBalance: number;
  lifetimeXp: number;
  xpSpent: number;
  attributePointsEarned: number;
  skillPointsEarned: number;
}

export type ExperienceWalletLike =
  | ExperienceWalletSnapshot
  | Partial<{
      xp_balance: unknown;
      xpBalance: unknown;
      lifetime_xp: unknown;
      lifetimeXp: unknown;
      xp_spent: unknown;
      xpSpent: unknown;
      attribute_points_earned: unknown;
      attributePointsEarned: unknown;
      skill_points_earned: unknown;
      skillPointsEarned: unknown;
    }>;

export interface ProgressionSnapshotInput {
  wallet?: ExperienceWalletLike | null;
  attributeStars?: number | null;
  legacyExperience?: number | null;
}

interface ProgressionTotals {
  lifetimeXp: number;
  spendableXp: number;
  attributeStars: number;
}

const normalizeWalletSnapshot = (
  wallet: ExperienceWalletLike | null | undefined
): ExperienceWalletSnapshot | null => {
  if (!wallet || typeof wallet !== "object") {
    return null;
  }

  const candidate = wallet as Record<string, unknown>;
  const xpBalance = Math.max(
    0,
    toFiniteNumber(candidate.xpBalance ?? candidate.xp_balance, 0)
  );
  const lifetimeXp = Math.max(
    0,
    toFiniteNumber(candidate.lifetimeXp ?? candidate.lifetime_xp, 0)
  );
  const xpSpent = Math.max(0, toFiniteNumber(candidate.xpSpent ?? candidate.xp_spent, 0));
  const attributePointsEarned = Math.max(
    0,
    toFiniteNumber(candidate.attributePointsEarned ?? candidate.attribute_points_earned, 0)
  );
  const skillPointsEarned = Math.max(
    0,
    toFiniteNumber(candidate.skillPointsEarned ?? candidate.skill_points_earned, 0)
  );

  const hasRelevantField =
    "xpBalance" in candidate ||
    "xp_balance" in candidate ||
    "lifetimeXp" in candidate ||
    "lifetime_xp" in candidate ||
    "xpSpent" in candidate ||
    "xp_spent" in candidate ||
    "attributePointsEarned" in candidate ||
    "attribute_points_earned" in candidate ||
    "skillPointsEarned" in candidate ||
    "skill_points_earned" in candidate;

  if (!hasRelevantField && xpBalance === 0 && lifetimeXp === 0 && xpSpent === 0 && attributePointsEarned === 0 && skillPointsEarned === 0) {
    return null;
  }

  return {
    xpBalance,
    lifetimeXp,
    xpSpent,
    attributePointsEarned,
    skillPointsEarned
  };
};

const resolveProgressionTotals = (
  input: ProgressionSnapshotInput | ExperienceWalletLike | number | null | undefined,
  attributeStarsOverride?: number | null
): ProgressionTotals => {
  const normalizedOverride = Number.isFinite(attributeStarsOverride as number)
    ? Math.max(0, toFiniteNumber(attributeStarsOverride, 0))
    : null;

  if (typeof input === "number") {
    const legacy = Math.max(0, toFiniteNumber(input, 0));
    return {
      lifetimeXp: legacy,
      spendableXp: legacy,
      attributeStars: normalizedOverride ?? 0
    };
  }

  if (!input) {
    return {
      lifetimeXp: 0,
      spendableXp: 0,
      attributeStars: normalizedOverride ?? 0
    };
  }

  let walletCandidate: ExperienceWalletLike | null | undefined;
  let attributeStarsCandidate: number | null | undefined;
  let legacyExperienceCandidate: number | null | undefined;

  if ("wallet" in input || "attributeStars" in input || "legacyExperience" in input) {
    const context = input as ProgressionSnapshotInput;
    walletCandidate = context.wallet ?? (context as ExperienceWalletLike);
    attributeStarsCandidate = context.attributeStars;
    legacyExperienceCandidate = context.legacyExperience;
  } else {
    walletCandidate = input as ExperienceWalletLike;
  }

  const wallet = normalizeWalletSnapshot(walletCandidate);
  const lifetimeXp = wallet?.lifetimeXp ?? Math.max(0, toFiniteNumber(legacyExperienceCandidate, 0));
  const spendableXp = wallet?.xpBalance ?? lifetimeXp;
  const attributeStars = normalizedOverride ?? Math.max(
    0,
    toFiniteNumber(attributeStarsCandidate ?? wallet?.attributePointsEarned ?? 0, 0)
  );

  return {
    lifetimeXp,
    spendableXp,
    attributeStars
  };
};

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

export const ACTIVITY_STATUS_DURATIONS = {
  songwritingIdea: 45,
  songwritingSession: 60,
  recordingSession: 120,
  gigPerformance: 120,
  rehearsal: 90,
  travelFallback: 45,
  buskingSession: 60,
  publicRelationsSprint: 45,
  jammingSession: 75,
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
  focus: AttributeFocus = "general",
  progression?: ProgressionSnapshotInput | ExperienceWalletLike | number | null
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

  const { attributeStars } = resolveProgressionTotals(progression);
  const starBonus = clampNumber(attributeStars * ATTRIBUTE_STAR_REWARD_BONUS, 0, ATTRIBUTE_STAR_REWARD_MAX_BONUS);

  const totalMultiplier = focusMultiplier * mentalMultiplier * staminaMultiplier * (1 + starBonus);
  return Math.max(0, Math.round(normalizedBase * totalMultiplier));
};

export function calculateLevel(
  progression: ProgressionSnapshotInput | ExperienceWalletLike | number | null | undefined,
  attributeStars?: number | null
): number;
export function calculateLevel(experience: number): number;
export function calculateLevel(
  progression: ProgressionSnapshotInput | ExperienceWalletLike | number | null | undefined,
  attributeStars?: number | null
): number {
  const totals = resolveProgressionTotals(progression, attributeStars);
  const effectiveXp = Math.max(0, totals.lifetimeXp + totals.attributeStars * ATTRIBUTE_STAR_XP_VALUE);
  const rawLevel = Math.floor(effectiveXp / LEVEL_REQUIREMENTS.experiencePerLevel) + 1;
  if (!Number.isFinite(rawLevel)) {
    return 1;
  }

  return Math.min(LEVEL_REQUIREMENTS.maxLevel, Math.max(1, rawLevel));
}

export function experienceToNextLevel(
  progression: ProgressionSnapshotInput | ExperienceWalletLike | number | null | undefined,
  attributeStars?: number | null
): number {
  const totals = resolveProgressionTotals(progression, attributeStars);
  const effectiveXp = Math.max(0, totals.lifetimeXp + totals.attributeStars * ATTRIBUTE_STAR_XP_VALUE);
  const rawLevel = Math.floor(effectiveXp / LEVEL_REQUIREMENTS.experiencePerLevel) + 1;
  const currentLevel = Math.min(LEVEL_REQUIREMENTS.maxLevel, Math.max(1, rawLevel));
  if (currentLevel >= LEVEL_REQUIREMENTS.maxLevel) {
    return 0;
  }

  const nextLevelExp = currentLevel * LEVEL_REQUIREMENTS.experiencePerLevel;
  const remaining = nextLevelExp - effectiveXp;
  return Math.max(0, Math.ceil(remaining));
}

export interface SkillCapContext extends ProgressionSnapshotInput {
  level?: number | null;
}

export function getSkillCap(context: SkillCapContext): number;
export function getSkillCap(
  playerLevel: number,
  progression?: ProgressionSnapshotInput | ExperienceWalletLike | number | null,
  attributeStarsOverride?: number | null
): number;
export function getSkillCap(
  levelOrContext: number | SkillCapContext | null | undefined,
  progression?: ProgressionSnapshotInput | ExperienceWalletLike | number | null,
  attributeStarsOverride?: number | null
): number {
  let resolvedProgression: ProgressionSnapshotInput | ExperienceWalletLike | number | null | undefined = progression;
  let resolvedLevel = 1;

  if (typeof levelOrContext === "number") {
    resolvedLevel = Math.max(1, Math.floor(toFiniteNumber(levelOrContext, 1)));
  } else if (levelOrContext && typeof levelOrContext === "object") {
    resolvedProgression = levelOrContext;
    const candidateLevel = toFiniteNumber(levelOrContext.level, NaN);
    if (Number.isFinite(candidateLevel) && candidateLevel > 0) {
      resolvedLevel = Math.max(1, Math.floor(candidateLevel));
    }
    if (attributeStarsOverride === undefined && "attributeStars" in levelOrContext) {
      attributeStarsOverride = levelOrContext.attributeStars ?? attributeStarsOverride;
    }
  }

  if (!Number.isFinite(resolvedLevel) || resolvedLevel <= 0) {
    resolvedLevel = calculateLevel(resolvedProgression);
  }

  const totals = resolveProgressionTotals(resolvedProgression, attributeStarsOverride);
  const effectiveXp = Math.max(0, totals.lifetimeXp + totals.attributeStars * ATTRIBUTE_STAR_XP_VALUE);

  if (effectiveXp >= 20000) {
    return SKILL_CAPS.master;
  }

  if (effectiveXp >= 5000) {
    return SKILL_CAPS.professional;
  }

  if (effectiveXp >= 1000) {
    return SKILL_CAPS.amateur;
  }

  const levelBonus = Math.min((resolvedLevel - 1) * 2, SKILL_CAPS.master - SKILL_CAPS.beginner);
  const attributeBonus = Math.min(
    totals.attributeStars * 5,
    SKILL_CAPS.master - SKILL_CAPS.beginner
  );

  const incrementalCap = SKILL_CAPS.beginner + Math.max(levelBonus, attributeBonus, 0);
  return Math.max(SKILL_CAPS.beginner, Math.min(SKILL_CAPS.master, incrementalCap));
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
