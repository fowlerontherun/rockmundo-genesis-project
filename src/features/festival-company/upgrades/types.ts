export const FESTIVAL_UPGRADE_KEYS = [
  "site_infrastructure",
  "stages_production",
  "security_crowd_control",
  "medical_welfare",
  "sanitation_utilities",
  "artist_backstage",
  "audience_facilities",
  "camping_accommodation",
  "transport_access",
  "marketing_media",
  "sustainability_technology",
] as const;

export type FestivalUpgradeKey = (typeof FESTIVAL_UPGRADE_KEYS)[number];

export interface PurchaseWindow {
  limit: number;
  used: number;
  remaining: number;
  windowDays: number;
  serverNow: string;
  nextAvailableAt: string | null;
}

export type FestivalEffectDeltaValue =
  | { kind: "number"; current: number; next: number; delta: number }
  | { kind: "boolean"; current: boolean; next: boolean; changed: boolean };

export interface FestivalUpgradeConstruction {
  status:
    | "not_installed"
    | "purchased"
    | "building"
    | "active"
    | "cancelled"
    | "failed";
  startedAt: string | null;
  completesAt: string | null;
  previousActiveLevel: number;
  targetOwnedLevel: number;
  remainingSeconds: number;
  activationDue: boolean;
}

export interface FestivalUpgradeCategory {
  key: FestivalUpgradeKey;
  displayName: string;
  description: string;
  ownedLevel: number;
  activeLevel: number;
  effectiveLevel: number;
  maximumLevel: number;
  bandKey: string;
  bandName: string;
  bandStartLevel: number;
  bandEndLevel: number;
  nextMilestoneLevel: number | null;
  nextMilestoneName: string | null;
  levelsUntilMilestone: number | null;
  status:
    | "not_installed"
    | "purchased"
    | "building"
    | "active"
    | "cancelled"
    | "failed";
  currentUpkeepMinor: number;
  nextLevel: number | null;
  nextCostMinor: number | null;
  nextUpkeepMinor: number | null;
  buildDurationHours: number | null;
  effects: Record<string, number | boolean>;
  nextEffects: Record<string, number | boolean> | null;
  effectDelta: Record<string, FestivalEffectDeltaValue> | null;
  missingRequirements: { code: string; message: string }[];
  affordable: boolean;
  construction: FestivalUpgradeConstruction;
  delinquent: boolean;
}

export interface FestivalLicenceTier {
  key: string;
  name: string;
  rank: number;
  feeMinor: number;
  maxAttendance: number;
  maxDays: number;
  maxStages: number;
  maxActsPerDay: number;
  campingAllowed: boolean;
  validityDays: number;
}

export interface FestivalCurrentLicence extends FestivalLicenceTier {
  status: string;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  daysRemaining: number | null;
}

export interface FestivalLicenceRequirement {
  code: string;
  description: string;
  complete: boolean;
  currentValue: number;
  requiredValue: number;
}

export type FestivalLicenceAction = "apply" | "upgrade" | "renew";

export interface FestivalLicenceProgress {
  licenceVersion: number;
  current: FestivalCurrentLicence | null;
  highestEligible: FestivalLicenceTier | null;
  target: FestivalLicenceTier | null;
  next: { key: string; name: string; feeMinor: number } | null;
  action: FestivalLicenceAction | null;
  requirements: FestivalLicenceRequirement[];
  canApply: boolean;
  affordable: boolean;
  reasonCodes: string[];
  availableBalanceMinor: number;
  currentReputation: number;
  renewalOpensAt: string | null;
}

export interface FestivalCompanyUpgradeState {
  festivalCompanyId: string;
  catalogueVersion: number;
  companyVersion: number;
  currencyCode: string;
  availableBalanceMinor: number;
  purchaseWindow: PurchaseWindow;
  categories: FestivalUpgradeCategory[];
  licence: FestivalLicenceProgress;
}

export interface FestivalUpgradePreview {
  category: FestivalUpgradeCategory;
  catalogueVersion: number;
  companyVersion: number;
  purchaseWindow: PurchaseWindow;
  balanceMinor: number;
  remainingBalanceMinor: number;
  eligible: boolean;
  reasonCodes: string[];
  licenceImplications: string[];
}

export const FESTIVAL_UPGRADE_MESSAGES: Record<string, string> = {
  FESTIVAL_UPGRADE_CATEGORY_NOT_FOUND: "That upgrade category is unavailable.",
  FESTIVAL_UPGRADE_LEVEL_SEQUENCE_INVALID:
    "Upgrades must be purchased one level at a time.",
  FESTIVAL_UPGRADE_PREREQUISITE_MISSING:
    "Complete the listed prerequisite upgrades first.",
  FESTIVAL_UPGRADE_LICENCE_REQUIRED:
    "Your current licence does not permit this upgrade.",
  FESTIVAL_UPGRADE_REPUTATION_REQUIRED: "The company needs more reputation.",
  FESTIVAL_UPGRADE_INSUFFICIENT_FUNDS:
    "The available company balance is too low.",
  FESTIVAL_UPGRADE_VERSION_CONFLICT:
    "The company changed. Refresh and try again.",
  FESTIVAL_UPGRADE_CATALOGUE_CHANGED:
    "Upgrade prices changed. Review the new quote.",
  FESTIVAL_UPGRADE_BUILD_IN_PROGRESS:
    "Finish the current construction first.",
  FESTIVAL_UPGRADE_DELINQUENT:
    "Settle overdue upgrade upkeep before purchasing.",
  FESTIVAL_UPGRADE_ROLLING_LIMIT_REACHED:
    "Two upgrades have already been purchased in the rolling 30-day window.",
  FESTIVAL_UPGRADE_COMPLETE: "This category is at its maximum level.",
  FESTIVAL_UPGRADE_IDEMPOTENCY_CONFLICT:
    "This request key was already used for another purchase.",
  FESTIVAL_UPGRADE_ACCESS_DENIED:
    "You do not have permission to manage these upgrades.",
  FESTIVAL_UPGRADE_RESPONSE_INVALID:
    "The server returned an invalid upgrade response.",
};

export const FESTIVAL_LICENCE_MESSAGES: Record<string, string> = {
  FESTIVAL_LICENCE_REQUIREMENTS_INCOMPLETE:
    "Complete the licence requirements before applying.",
  FESTIVAL_LICENCE_INSUFFICIENT_FUNDS:
    "The Festival company does not have enough available funds for this licence.",
  FESTIVAL_LICENCE_NOT_DUE:
    "This licence cannot be renewed until the final 30 days of its term.",
  FESTIVAL_LICENCE_COMPLETE:
    "The company already holds the highest Festival licence.",
  FESTIVAL_LICENCE_TARGET_CHANGED:
    "Licence eligibility changed. Review the latest licence details.",
  FESTIVAL_LICENCE_VERSION_CONFLICT:
    "The licence changed. Refresh and try again.",
  FESTIVAL_LICENCE_IDEMPOTENCY_CONFLICT:
    "This request key was already used for another licence action.",
  FESTIVAL_LICENCE_ACCESS_DENIED:
    "You do not have permission to manage this Festival licence.",
  FESTIVAL_LICENCE_TIER_NOT_FOUND: "That Festival licence is unavailable.",
};
