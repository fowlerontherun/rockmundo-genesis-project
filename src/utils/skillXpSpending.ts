export const STANDARD_SKILL_XP = [120,148,176,204,232,260,289,318,348,377,406,436,465,494,524,553,582,612,641,670] as const;
export const DEFAULT_MAX_SKILL_LEVEL = 20;

export interface SkillSpendState {
  currentLevel: number;
  xpIntoLevel: number;
  xpRequiredForNextLevel: number | null;
  maxLevel?: number;
}

export interface SkillSpendPreview extends Required<SkillSpendState> {
  requestedXp: number;
  usefulSpend: number;
  afterLevel: number;
  afterXpIntoLevel: number;
  afterXpRequiredForNextLevel: number | null;
  levelsGained: number;
  walletAfterSpend: number;
  xpToMaxLevel: number;
  maximumSpend: number;
  isMaxLevel: boolean;
}

export function getSkillXpRequiredForLevel(level: number): number {
  if (!Number.isFinite(level) || level < 0) return STANDARD_SKILL_XP[0];
  return STANDARD_SKILL_XP[Math.min(Math.floor(level), STANDARD_SKILL_XP.length - 1)] ?? STANDARD_SKILL_XP[STANDARD_SKILL_XP.length - 1];
}

export function getXpToSkillMax(state: SkillSpendState): number {
  const maxLevel = state.maxLevel ?? DEFAULT_MAX_SKILL_LEVEL;
  const currentLevel = Math.max(0, Math.min(maxLevel, Math.floor(state.currentLevel || 0)));
  if (currentLevel >= maxLevel) return 0;
  let total = Math.max(0, (state.xpRequiredForNextLevel ?? getSkillXpRequiredForLevel(currentLevel)) - Math.max(0, Math.floor(state.xpIntoLevel || 0)));
  for (let level = currentLevel + 1; level < maxLevel; level += 1) total += getSkillXpRequiredForLevel(level);
  return total;
}

export function previewSkillXpSpend(state: SkillSpendState, availableSkillXp: number, requestedXp: number): SkillSpendPreview {
  const maxLevel = state.maxLevel ?? DEFAULT_MAX_SKILL_LEVEL;
  const currentLevel = Math.max(0, Math.min(maxLevel, Math.floor(state.currentLevel || 0)));
  const currentRequired = currentLevel >= maxLevel ? null : Math.max(1, Math.floor(state.xpRequiredForNextLevel ?? getSkillXpRequiredForLevel(currentLevel)));
  const xpIntoLevel = currentLevel >= maxLevel ? 0 : Math.max(0, Math.min(Math.floor(state.xpIntoLevel || 0), currentRequired ?? 0));
  const wallet = Math.max(0, Math.floor(availableSkillXp || 0));
  const xpToMaxLevel = getXpToSkillMax({ currentLevel, xpIntoLevel, xpRequiredForNextLevel: currentRequired, maxLevel });
  const maximumSpend = Math.max(0, Math.min(wallet, xpToMaxLevel));
  const usefulSpend = Math.max(0, Math.min(Math.floor(requestedXp || 0), maximumSpend));
  let remaining = usefulSpend;
  let afterLevel = currentLevel;
  let afterXp = xpIntoLevel;
  let required = currentRequired ?? 0;
  while (remaining > 0 && afterLevel < maxLevel) {
    const needed = Math.max(0, required - afterXp);
    if (remaining < needed) { afterXp += remaining; remaining = 0; break; }
    remaining -= needed;
    afterLevel += 1;
    afterXp = 0;
    required = afterLevel >= maxLevel ? 0 : getSkillXpRequiredForLevel(afterLevel);
  }
  if (afterLevel >= maxLevel) afterXp = 0;
  return { currentLevel, xpIntoLevel, xpRequiredForNextLevel: currentRequired, maxLevel, requestedXp: Math.max(0, Math.floor(requestedXp || 0)), usefulSpend, afterLevel, afterXpIntoLevel: afterXp, afterXpRequiredForNextLevel: afterLevel >= maxLevel ? null : required, levelsGained: afterLevel - currentLevel, walletAfterSpend: wallet - usefulSpend, xpToMaxLevel, maximumSpend, isMaxLevel: currentLevel >= maxLevel };
}
