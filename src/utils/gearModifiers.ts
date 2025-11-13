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
  let reliabilityPoints = 0;

  for (const item of items) {
    const stats = item.statBoosts ?? {};
    performancePoints += stats.performance ?? 0;
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

    if (isPedal) {
      reliabilityPoints += getRarityReliabilityBonus(item.rarity ?? null);
    }

    // High-end vocal chains often bundle performance boosts, treat microphones similarly
    const isMicrophone =
      subcategory.includes("microphone") ||
      subcategory.includes("mic") ||
      (item.category ?? "").toLowerCase().includes("microphone");

    if (isMicrophone) {
      vocalPresencePoints += stats.performance ?? 0;
    }
  }

  const equipmentQualityBonus = Math.min(15, performancePoints * 0.5);
  const attendanceBonusPercent = Math.min(25, vocalPresencePoints * 0.8);
  const crowdEngagementMultiplier = 1 + attendanceBonusPercent / 100;

  const reliabilityStability = Math.min(0.05, reliabilityPoints);
  const reliabilitySwingReductionPercent = reliabilityStability * 100;

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
      description: "Premium processors and amps lift your equipment score every song.",
    });
  }

  if (attendanceBonusPercent > 0.5) {
    breakdown.push({
      key: "crowd-engagement",
      label: "Crowd Engagement",
      value: `+${formatPercent(attendanceBonusPercent)}`,
      description: "High-end microphones and vocal rigs energize the audience.",
    });
  }

  if (reliabilitySwingReductionPercent > 0.25) {
    breakdown.push({
      key: "rig-reliability",
      label: "Rig Reliability",
      value: `-${formatPercent(reliabilitySwingReductionPercent)}`,
      description: "Rare pedals steady your signal chain and prevent rough nights.",
    });
  }

  if (revenueBonusPercent > 0.5) {
    breakdown.push({
      key: "payout",
      label: "Merch & Payout Boost",
      value: `+${formatPercent(revenueBonusPercent)}`,
      description: "Polished tone keeps fans spending after the show.",
    });
  }

  if (fameBonusPercent > 0.5) {
    breakdown.push({
      key: "reputation",
      label: "Reputation Gains",
      value: `+${formatPercent(fameBonusPercent)}`,
      description: "Signature gear leaves a lasting impression on the scene.",
    });
  }

  return {
    equipmentQualityBonus,
    crowdEngagementMultiplier,
    attendanceBonusPercent,
    reliabilityStability,
    reliabilitySwingReductionPercent,
    revenueMultiplier,
    revenueBonusPercent,
    fameMultiplier,
    fameBonusPercent,
    breakdown,
  };
}
