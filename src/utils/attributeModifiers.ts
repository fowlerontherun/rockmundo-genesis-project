const DEFAULT_MULTIPLIER = 1;
const MIN_MULTIPLIER = 0.25;
const MAX_MULTIPLIER = 3;
const MIN_REWARD_MULTIPLIER = 0.1;
const MAX_REWARD_MULTIPLIER = 5;

const sanitizeNumeric = (value: unknown, fallback: number) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) {
    return fallback;
  }
  return numeric;
};

export const getAttributeMultiplier = (
  value: number | null | undefined,
  {
    min = MIN_MULTIPLIER,
    max = MAX_MULTIPLIER,
    fallback = DEFAULT_MULTIPLIER,
  }: { min?: number; max?: number; fallback?: number } = {}
) => {
  const numeric = sanitizeNumeric(value, fallback);
  if (numeric <= 0) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
};

export const applyCooldownModifier = (baseDurationMs: number, attributeValue: number | null | undefined) => {
  const base = sanitizeNumeric(baseDurationMs, 0);
  if (base <= 0) {
    return 0;
  }
  const multiplier = getAttributeMultiplier(attributeValue);
  const adjusted = base / multiplier;
  return Math.max(60_000, Math.round(adjusted));
};

export const applyRewardBonus = (
  baseValue: number,
  attributeValue: number | null | undefined,
  { minimum = 1 }: { minimum?: number } = {}
) => {
  const base = sanitizeNumeric(baseValue, 0);
  if (base <= 0) {
    return minimum ? Math.max(minimum, 0) : 0;
  }
  const multiplier = getAttributeMultiplier(attributeValue, {
    min: MIN_REWARD_MULTIPLIER,
    max: MAX_REWARD_MULTIPLIER,
  });
  const adjusted = Math.round(base * multiplier);
  return minimum !== undefined ? Math.max(minimum, adjusted) : adjusted;
};

export const applyCostReduction = (baseValue: number, attributeValue: number | null | undefined) => {
  const base = sanitizeNumeric(baseValue, 0);
  if (base <= 0) {
    return 0;
  }
  const multiplier = getAttributeMultiplier(attributeValue);
  const adjusted = Math.round(base / multiplier);
  return Math.max(0, adjusted);
};
