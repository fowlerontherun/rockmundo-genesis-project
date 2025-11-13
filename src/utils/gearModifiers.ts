const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

export interface EquippedGearItem {
  id?: string | null;
  userId: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  rarity: string | null;
  statBoosts: Record<string, number>;
}

export interface GearEffectBreakdown {
  key: string;
  label: string;
  value: string;
  description: string;
}

export interface GearModifierEffects {
  equipmentQualityBonus: number;
  crowdEngagementMultiplier: number;
  attendanceBonusPercent: number;
  reliabilityStability: number;
  reliabilitySwingReductionPercent: number;
  breakdownRiskPercent: number;
  revenueMultiplier: number;
  revenueBonusPercent: number;
  fameMultiplier: number;
  fameBonusPercent: number;
  breakdown: GearEffectBreakdown[];
}

export interface PlayerEquipmentRow {
  id?: string;
  user_id: string;
  equipment_id: string;
  is_equipped: boolean | null;
  equipment?: {
    id: string;
    name: string | null;
    category: string | null;
    subcategory: string | null;
    rarity: string | null;
    stat_boosts: Record<string, number> | null;
  } | null;
}

export const EMPTY_GEAR_EFFECTS: GearModifierEffects = {
  equipmentQualityBonus: 0,
  crowdEngagementMultiplier: 1,
  attendanceBonusPercent: 0,
  reliabilityStability: 0,
  reliabilitySwingReductionPercent: 0,
  breakdownRiskPercent: 0,
  revenueMultiplier: 1,
  revenueBonusPercent: 0,
  fameMultiplier: 1,
  fameBonusPercent: 0,
  breakdown: [],
};

export function normalizeStatBoosts(value: unknown): Record<string, number> {
  if (!value) return {};

  if (isPlainObject(value)) {
    const entries = Object.entries(value as Record<string, unknown>).reduce<
      Record<string, number>
    >((acc, [key, rawValue]) => {
      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue)) {
        return acc;
      }

      acc[key] = numericValue;
      return acc;
    }, {});

    return entries;
  }

  return {};
}

export function mapEquippedGearRows(rows: PlayerEquipmentRow[] | null | undefined): EquippedGearItem[] {
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows
    .filter((row) => row.is_equipped && row.equipment)
    .map((row) => {
      const statBoosts = normalizeStatBoosts(row.equipment?.stat_boosts);

      return {
        id: row.equipment?.id ?? row.equipment_id,
        userId: row.user_id,
        name: row.equipment?.name ?? "Equipped Gear",
        category: row.equipment?.category ?? null,
        subcategory: row.equipment?.subcategory ?? null,
        rarity: row.equipment?.rarity ?? null,
        statBoosts,
      } satisfies EquippedGearItem;
    });
}

const RELIABILITY_KEYWORDS = [
  "reliab",
  "stability",
  "integrity",
  "durab",
  "rig",
  "signal",
  "shield",
  "redundancy",
];

const DURABILITY_PENALTY_KEYWORDS = [
  "durab",
  "fragile",
  "wear",
  "stress",
  "fault",
  "glitch",
  "crackle",
  "penalty",
];

const matchesReliabilityKey = (key: string) =>
  RELIABILITY_KEYWORDS.some((keyword) => key.includes(keyword));

const matchesPenaltyKey = (key: string) =>
  DURABILITY_PENALTY_KEYWORDS.some((keyword) => key.includes(keyword));

const analyzeReliabilityStats = (stats: Record<string, number> | undefined) => {
  let hasReliabilityKey = false;
  let positive = 0;
  let negative = 0;

  if (!stats) {
    return { hasReliabilityKey, positive, negative };
  }

  for (const [rawKey, rawValue] of Object.entries(stats)) {
    const key = rawKey.toLowerCase();
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      continue;
    }

    if (matchesReliabilityKey(key)) {
      hasReliabilityKey = true;
      if (value > 0) {
        positive += value;
        continue;
      }
    }

    if (value < 0 && (matchesReliabilityKey(key) || matchesPenaltyKey(key))) {
      negative += Math.abs(value);
    }
  }

  return { hasReliabilityKey, positive, negative };
};

const getRarityReliabilityBonus = (rarity: string | null): number => {
  switch ((rarity ?? "").toLowerCase()) {
    case "legendary":
      return 0.02;
    case "epic":
      return 0.0175;
    case "rare":
      return 0.015;
    case "uncommon":
      return 0.01;
    case "common":
      return 0.005;
    default:
      return 0;
  }
};

const formatPercent = (value: number, digits: number = 1) => `${value.toFixed(digits)}%`;

export function calculateGearModifiers(items: EquippedGearItem[]): GearModifierEffects {
  if (!items.length) {
    return { ...EMPTY_GEAR_EFFECTS };
  }

  let performancePoints = 0;
  let vocalPresencePoints = 0;
  let famePoints = 0;
  let reliabilityBonusPool = 0;
  let reliabilityPenaltyPool = 0;

  for (const item of items) {
    const stats = item.statBoosts ?? {};
    const performanceBoost = stats.performance ?? 0;
    performancePoints += performanceBoost;
    vocalPresencePoints += (stats.vocals ?? 0) + (stats.stage_presence ?? 0);
    famePoints += stats.fame ?? 0;

    const subcategory = (item.subcategory ?? "").toLowerCase();
    const name = item.name.toLowerCase();
    const isPedal =
      subcategory.includes("pedal") ||
      subcategory.includes("fx") ||
      subcategory.includes("effect") ||
      name.includes("pedal") ||
      name.includes("stomp");

    const reliabilityMetrics = analyzeReliabilityStats(stats);

    if (isPedal && reliabilityMetrics.hasReliabilityKey) {
      const baseBonus = getRarityReliabilityBonus(item.rarity ?? null);
      if (baseBonus > 0) {
        const scaling = reliabilityMetrics.positive >= 2 ? 1 : reliabilityMetrics.positive > 0 ? 0.5 : 0;
        reliabilityBonusPool += baseBonus * scaling;
      }
    }

    if (reliabilityMetrics.positive > 0) {
      reliabilityBonusPool += Math.min(0.03, reliabilityMetrics.positive * 0.004);
    }

    if (reliabilityMetrics.negative > 0) {
      reliabilityPenaltyPool += Math.min(0.04, reliabilityMetrics.negative * 0.01);
    }

    // High-end vocal chains often bundle performance boosts, treat microphones similarly
    const isMicrophone =
      subcategory.includes("microphone") ||
      subcategory.includes("mic") ||
      (item.category ?? "").toLowerCase().includes("microphone");

    if (isMicrophone && performanceBoost > 0) {
      const threshold = 2;
      const cappedPerformance = Math.min(5, performanceBoost);
      const scaling = performanceBoost >= threshold ? 1 : 0.5;
      vocalPresencePoints += cappedPerformance * scaling;
    }
  }

  const equipmentQualityBonus = Math.min(15, performancePoints * 0.5);
  const attendanceBonusPercent = Math.min(25, vocalPresencePoints * 0.8);
  const crowdEngagementMultiplier = 1 + attendanceBonusPercent / 100;

  const netReliability = Math.max(0, reliabilityBonusPool - reliabilityPenaltyPool);
  const reliabilityStability = Math.min(0.05, netReliability);
  const reliabilitySwingReductionPercent = Math.max(0, reliabilityStability * 100);
  const breakdownRiskPercent = Math.min(40, Math.max(0, reliabilityPenaltyPool) * 100);

  const revenueBonusPercent = Math.min(18, performancePoints * 0.6 + vocalPresencePoints * 0.3);
  const revenueMultiplier = 1 + revenueBonusPercent / 100;

  const fameBonusPercent = Math.min(20, famePoints * 1.2);
  const fameMultiplier = 1 + fameBonusPercent / 100;

  const breakdown: GearEffectBreakdown[] = [];

  if (equipmentQualityBonus > 0.25) {
    breakdown.push({
      key: "signal-chain",
      label: "Signal Chain Quality",
      value: `+${equipmentQualityBonus.toFixed(1)} EQ`,
      description: "Premium processors raise your equipment score until the touring cap kicks in.",
    });
  }

  if (attendanceBonusPercent > 0.5) {
    breakdown.push({
      key: "crowd-engagement",
      label: "Crowd Engagement",
      value: `+${formatPercent(attendanceBonusPercent)}`,
      description: "High-end vocal chains energize the audience with capped gains for starter gear.",
    });
  }

  if (reliabilitySwingReductionPercent > 0.25) {
    breakdown.push({
      key: "rig-reliability",
      label: "Rig Reliability",
      value: `-${formatPercent(reliabilitySwingReductionPercent)}`,
      description: "Reliability mods steady your rig and shave off variance until the safety cap.",
    });
  }

  if (breakdownRiskPercent > 0.5) {
    breakdown.push({
      key: "breakdown-risk",
      label: "Breakdown Risk",
      value: `+${formatPercent(breakdownRiskPercent)}`,
      description: "Fragile components raise failure odds and widen night-to-night swings.",
    });
  }

  if (revenueBonusPercent > 0.5) {
    breakdown.push({
      key: "payout",
      label: "Merch & Payout Boost",
      value: `+${formatPercent(revenueBonusPercent)}`,
      description: "Polished tone keeps fans spending, with diminishing returns past premium tiers.",
    });
  }

  if (fameBonusPercent > 0.5) {
    breakdown.push({
      key: "reputation",
      label: "Reputation Gains",
      value: `+${formatPercent(fameBonusPercent)}`,
      description: "Signature gear leaves a mark until the scene recognition cap is reached.",
    });
  }

  return {
    equipmentQualityBonus,
    crowdEngagementMultiplier,
    attendanceBonusPercent,
    reliabilityStability,
    reliabilitySwingReductionPercent,
    breakdownRiskPercent,
    revenueMultiplier,
    revenueBonusPercent,
    fameMultiplier,
    fameBonusPercent,
    breakdown,
  };
}
