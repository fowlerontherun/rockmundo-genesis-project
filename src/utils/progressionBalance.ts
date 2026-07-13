// Kept local to break a circular import with ./attributeProgression which
// re-exports getAttributeUpgradeCost from this file. Must match the value in
// attributeProgression.ts.
const ATTRIBUTE_MAX_VALUE = 1000;

export const PROGRESSION_BALANCE_VERSION = "progression_v2.0.0";

export type ProgressionCurveKey =
  | "foundation_fast"
  | "standard_role"
  | "specialist"
  | "mastery"
  | "genre"
  | "business"
  | "social"
  | "standard_skill";

export interface XpCurveConfig { key: ProgressionCurveKey; maxLevel: number; perLevelXp: number[]; }
const buildCurve = (key: ProgressionCurveKey, points: Array<[number, number]>, maxLevel = 100): XpCurveConfig => {
  const perLevelXp: number[] = [];
  for (let level = 0; level < maxLevel; level += 1) {
    const end = points.findIndex(([target]) => level < target);
    const [fromLevel, fromXp] = end <= 0 ? [0, points[0][1]] : points[end - 1];
    const [toLevel, toXp] = points[end === -1 ? points.length - 1 : end];
    const span = Math.max(1, toLevel - fromLevel);
    const t = Math.min(1, Math.max(0, (level - fromLevel) / span));
    perLevelXp.push(Math.round(fromXp + (toXp - fromXp) * t));
  }
  return { key, maxLevel, perLevelXp };
};

export const PROGRESSION_BALANCE = {
  version: PROGRESSION_BALANCE_VERSION,
  curves: {
    foundation_fast: buildCurve("foundation_fast", [[0, 90], [5, 180], [20, 520], [50, 1250], [80, 2400], [100, 3600]]),
    standard_role: buildCurve("standard_role", [[0, 120], [5, 260], [20, 700], [50, 1700], [80, 3300], [100, 5000]]),
    specialist: buildCurve("specialist", [[0, 160], [5, 340], [20, 950], [50, 2400], [80, 4600], [100, 7000]]),
    mastery: buildCurve("mastery", [[0, 240], [5, 520], [20, 1500], [50, 3600], [80, 7200], [100, 11000]]),
    genre: buildCurve("genre", [[0, 110], [5, 230], [20, 640], [50, 1550], [80, 3000], [100, 4600]]),
    business: buildCurve("business", [[0, 130], [5, 280], [20, 760], [50, 1800], [80, 3500], [100, 5200]]),
    social: buildCurve("social", [[0, 100], [5, 220], [20, 620], [50, 1450], [80, 2800], [100, 4200]]),
    standard_skill: buildCurve("standard_skill", [[0, 120], [5, 260], [20, 700], [50, 1700], [80, 3300], [100, 5000]]),
  },
  practice: {
    baseXpPerHour: 85,
    dailySessionLimit: 5,
    sameSkillDiminishingReturns: [1, 0.8, 0.65, 0.5, 0.4],
    variedSkillFloor: 0.75,
    eliteLevelXpScalar: 0.85,
  },
  activities: {
    practice: [60, 140], lesson: [120, 260], university_course: [250, 600], rehearsal: [35, 110], gig: [45, 140], songwriting: [40, 130], recording: [40, 130], teaching: [30, 90], bandmate_learning: [25, 80]
  },
  education: { lessonMultiplier: 1.25, universityMultiplier: 1.45, mentorMultiplier: 1.2 },
  learning: { primaryMaxBonus: 0.15, secondaryMaxBonus: 0.10, totalAttributeBonusCap: 0.25, diminishingReturnConstant: 500 },
  beginner: { levelBonuses: [{ maxExclusiveLevel: 3, bonus: 0.75 }, { maxExclusiveLevel: 5, bonus: 0.35 }], maxBoostedSkillsPerProfile: 8 },
  catchUp: { inactiveDaysForRested: 3, maxRestedBonus: 0.20, maxRestedDays: 14, maxEligibleLevel: 20 },
  roleFocus: { bonus: 0.075, maxEligibleLevel: 15 },
  attribute: { maxValue: ATTRIBUTE_MAX_VALUE, increment: 10, dailyBaseAp: 6, dailyMinAp: 2, dailyCapAp: 18, bands: [[0,4],[200,7],[500,12],[750,20],[900,32]] as Array<[number, number]> },
} as const;

export type SkillLike = { slug: string; max_level?: number; progression_curve_key?: string } | string;
export const getSkillDefinition = (skill: SkillLike): { slug: string; max_level: number; progression_curve_key: string } =>
  typeof skill === "string" ? { slug: skill, max_level: 100, progression_curve_key: "standard_role" } : { slug: skill.slug, max_level: skill.max_level ?? 100, progression_curve_key: skill.progression_curve_key ?? "standard_role" };
export const getCurveForSkill = (skill: SkillLike) => PROGRESSION_BALANCE.curves[(getSkillDefinition(skill).progression_curve_key as ProgressionCurveKey)] ?? PROGRESSION_BALANCE.curves.standard_role;
export const getXpRequiredForLevel = (skill: SkillLike, targetLevel: number): number => {
  const curve = getCurveForSkill(skill); const level = Math.floor(targetLevel);
  if (!Number.isFinite(level) || level <= 0) return 0;
  return curve.perLevelXp[Math.min(level - 1, curve.perLevelXp.length - 1)] ?? 0;
};
export const getXpRequiredForNextLevel = (skill: SkillLike, currentLevel: number) => currentLevel >= getSkillDefinition(skill).max_level ? 0 : getXpRequiredForLevel(skill, currentLevel + 1);
export const getCumulativeXpForSkillLevel = (skill: SkillLike, level: number): number => {
  const safe = Math.max(0, Math.min(Math.floor(level), getSkillDefinition(skill).max_level));
  let total = 0; for (let next = 1; next <= safe; next += 1) total += getXpRequiredForLevel(skill, next); return total;
};
export const getLevelFromLifetimeXp = (skill: SkillLike, lifetimeXp: number): number => {
  let xp = Math.max(0, Math.floor(Number.isFinite(lifetimeXp) ? lifetimeXp : 0));
  const max = getSkillDefinition(skill).max_level; let level = 0;
  while (level < max) { const req = getXpRequiredForLevel(skill, level + 1); if (xp < req) break; xp -= req; level += 1; }
  return level;
};
export const getProgressWithinLevel = (skill: SkillLike, lifetimeXp: number) => {
  const level = getLevelFromLifetimeXp(skill, lifetimeXp); const currentLevelStartXp = getCumulativeXpForSkillLevel(skill, level); const xpIntoLevel = Math.max(0, lifetimeXp - currentLevelStartXp); const xpForNextLevel = getXpRequiredForNextLevel(skill, level); return { level, currentLevelStartXp, xpIntoLevel, xpForNextLevel, progressPercent: xpForNextLevel > 0 ? Math.min(100, (xpIntoLevel / xpForNextLevel) * 100) : 100 };
};
export const getAttributeUpgradeCost = (currentValue: number, increment = PROGRESSION_BALANCE.attribute.increment): number => {
  const value = Math.max(0, Math.min(PROGRESSION_BALANCE.attribute.maxValue, Math.floor(currentValue)));
  const [, costPerPoint] = [...PROGRESSION_BALANCE.attribute.bands].reverse().find(([threshold]) => value >= threshold) ?? [0, 4];
  return Math.ceil(costPerPoint * increment);
};
export const getBeginnerBonus = (level: number, boostedSkillCount = 0) => boostedSkillCount >= PROGRESSION_BALANCE.beginner.maxBoostedSkillsPerProfile ? 0 : PROGRESSION_BALANCE.beginner.levelBonuses.find((b) => level < b.maxExclusiveLevel)?.bonus ?? 0;
export const getDiminishingAttributeEffect = (value: number) => { const safe = Math.max(0, Math.min(ATTRIBUTE_MAX_VALUE, value)); return safe / (safe + PROGRESSION_BALANCE.learning.diminishingReturnConstant); };
