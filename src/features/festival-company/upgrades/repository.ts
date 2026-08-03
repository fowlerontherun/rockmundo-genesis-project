import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  FESTIVAL_LICENCE_MESSAGES,
  FESTIVAL_UPGRADE_KEYS,
  FESTIVAL_UPGRADE_MESSAGES,
  type FestivalCompanyUpgradeState,
  type FestivalUpgradeKey,
  type FestivalUpgradePreview,
} from "./types";

const rpc = supabase.rpc.bind(supabase) as unknown as (
  name: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

const upgradeError = (value: { message?: string }) => {
  const code =
    Object.keys(FESTIVAL_UPGRADE_MESSAGES).find((candidate) =>
      value.message?.includes(candidate),
    ) ?? "FESTIVAL_UPGRADE_UNAVAILABLE";
  return Object.assign(
    new Error(
      FESTIVAL_UPGRADE_MESSAGES[code] ??
        "Festival upgrades are temporarily unavailable.",
    ),
    { code },
  );
};

const licenceError = (value: { message?: string }) => {
  const code =
    Object.keys(FESTIVAL_LICENCE_MESSAGES).find((candidate) =>
      value.message?.includes(candidate),
    ) ?? "FESTIVAL_LICENCE_UNAVAILABLE";
  return Object.assign(
    new Error(
      FESTIVAL_LICENCE_MESSAGES[code] ??
        "Festival licences are temporarily unavailable.",
    ),
    { code },
  );
};

const effect = z.record(z.string(), z.union([z.number(), z.boolean()]));
const effectDeltaValue = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("number"),
    current: z.number(),
    next: z.number(),
    delta: z.number(),
  }),
  z.object({
    kind: z.literal("boolean"),
    current: z.boolean(),
    next: z.boolean(),
    changed: z.boolean(),
  }),
]);
const construction = z.object({
  status: z.enum([
    "not_installed",
    "purchased",
    "building",
    "active",
    "cancelled",
    "failed",
  ]),
  startedAt: z.string().datetime({ offset: true }).nullable(),
  completesAt: z.string().datetime({ offset: true }).nullable(),
  previousActiveLevel: z.number().int().nonnegative(),
  targetOwnedLevel: z.number().int().nonnegative(),
  remainingSeconds: z.number().int().nonnegative(),
  activationDue: z.boolean(),
});
const windowSchema = z.object({
  limit: z.number().int().positive(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  windowDays: z.number().int().positive(),
  serverNow: z.string().datetime({ offset: true }),
  nextAvailableAt: z.string().datetime({ offset: true }).nullable(),
});
const category = z
  .object({
    key: z.enum(FESTIVAL_UPGRADE_KEYS),
    displayName: z.string(),
    description: z.string(),
    ownedLevel: z.number().int().nonnegative(),
    activeLevel: z.number().int().nonnegative(),
    effectiveLevel: z.number().int().nonnegative(),
    maximumLevel: z.number().int().positive(),
    bandKey: z.string(),
    bandName: z.string(),
    bandStartLevel: z.number().int().positive(),
    bandEndLevel: z.number().int().positive(),
    nextMilestoneLevel: z.number().int().positive().nullable(),
    nextMilestoneName: z.string().nullable(),
    levelsUntilMilestone: z.number().int().nonnegative().nullable(),
    status: z.enum([
      "not_installed",
      "purchased",
      "building",
      "active",
      "cancelled",
      "failed",
    ]),
    currentUpkeepMinor: z.number().nonnegative(),
    nextLevel: z.number().int().positive().nullable(),
    nextCostMinor: z.number().nonnegative().nullable(),
    nextUpkeepMinor: z.number().nonnegative().nullable(),
    buildDurationHours: z.number().nonnegative().nullable(),
    effects: effect,
    nextEffects: effect.nullable(),
    effectDelta: z.record(z.string(), effectDeltaValue).nullable(),
    missingRequirements: z.array(
      z.object({ code: z.string(), message: z.string() }),
    ),
    affordable: z.boolean(),
    construction,
    delinquent: z.boolean(),
  })
  .superRefine((value, context) => {
    if (
      value.ownedLevel > value.maximumLevel ||
      value.activeLevel > value.ownedLevel ||
      value.effectiveLevel > value.activeLevel ||
      value.bandEndLevel > value.maximumLevel ||
      (value.ownedLevel === value.maximumLevel && value.nextLevel !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "invalid authoritative levels",
      });
    }
  });

const licenceTier = z.object({
  key: z.string(),
  name: z.string(),
  rank: z.number().int().positive(),
  feeMinor: z.number().nonnegative(),
  maxAttendance: z.number().int().nonnegative(),
  maxDays: z.number().int().positive(),
  maxStages: z.number().int().positive(),
  maxActsPerDay: z.number().int().positive(),
  campingAllowed: z.boolean(),
  validityDays: z.number().int().positive(),
});
const currentLicence = licenceTier.extend({
  status: z.string(),
  active: z.boolean(),
  validFrom: z.string().datetime({ offset: true }).nullable(),
  validUntil: z.string().datetime({ offset: true }).nullable(),
  daysRemaining: z.number().int().nonnegative().nullable(),
});
const licence = z.object({
  licenceVersion: z.number().int().nonnegative(),
  current: currentLicence.nullable(),
  highestEligible: licenceTier.nullable(),
  target: licenceTier.nullable(),
  next: z
    .object({
      key: z.string(),
      name: z.string(),
      feeMinor: z.number().nonnegative(),
    })
    .nullable(),
  action: z.enum(["apply", "upgrade", "renew"]).nullable(),
  requirements: z.array(
    z.object({
      code: z.string(),
      description: z.string(),
      complete: z.boolean(),
      currentValue: z.number(),
      requiredValue: z.number(),
    }),
  ),
  canApply: z.boolean(),
  affordable: z.boolean(),
  reasonCodes: z.array(z.string()),
  availableBalanceMinor: z.number(),
  currentReputation: z.number(),
  renewalOpensAt: z.string().datetime({ offset: true }).nullable(),
});
const stateSchema = z
  .object({
    festivalCompanyId: z.string().uuid(),
    catalogueVersion: z.number().int().positive(),
    companyVersion: z.number().int().nonnegative(),
    currencyCode: z.string(),
    availableBalanceMinor: z.number(),
    purchaseWindow: windowSchema,
    categories: z.array(category).length(11),
    licence,
  })
  .superRefine((value, context) => {
    if (
      !FESTIVAL_UPGRADE_KEYS.every((key) =>
        value.categories.some((entry) => entry.key === key),
      )
    ) {
      context.addIssue({ code: "custom", message: "missing category" });
    }
  });
const previewSchema = z.object({
  category,
  catalogueVersion: z.number().int().positive(),
  companyVersion: z.number().int().nonnegative(),
  purchaseWindow: windowSchema,
  balanceMinor: z.number(),
  remainingBalanceMinor: z.number(),
  eligible: z.boolean(),
  reasonCodes: z.array(z.string()),
  licenceImplications: z.array(z.string()),
});

function invalid(): never {
  throw Object.assign(
    new Error(FESTIVAL_UPGRADE_MESSAGES.FESTIVAL_UPGRADE_RESPONSE_INVALID),
    { code: "FESTIVAL_UPGRADE_RESPONSE_INVALID" },
  );
}

function state(value: unknown): FestivalCompanyUpgradeState {
  const parsed = stateSchema.safeParse(value);
  if (!parsed.success) invalid();
  return parsed.data as FestivalCompanyUpgradeState;
}

export async function getFestivalCompanyUpgrades(id: string) {
  const { data, error } = await rpc("get_festival_company_upgrades", {
    p_festival_company_id: id,
  });
  if (error) throw upgradeError(error);
  return state(data);
}

export async function previewFestivalUpgrade(input: {
  festivalCompanyId: string;
  categoryKey: FestivalUpgradeKey;
}) {
  const { data, error } = await rpc("get_festival_upgrade_purchase_preview", {
    p_festival_company_id: input.festivalCompanyId,
    p_category_key: input.categoryKey,
  });
  if (error) throw upgradeError(error);
  const parsed = previewSchema.safeParse(data);
  if (!parsed.success) invalid();
  return parsed.data as FestivalUpgradePreview;
}

export async function purchaseFestivalUpgrade(input: {
  festivalCompanyId: string;
  categoryKey: FestivalUpgradeKey;
  nextLevel: number;
  catalogueVersion: number;
  companyVersion: number;
  idempotencyKey: string;
}) {
  const { data, error } = await rpc("purchase_festival_company_upgrade", {
    p_festival_company_id: input.festivalCompanyId,
    p_category_key: input.categoryKey,
    p_requested_level: input.nextLevel,
    p_expected_catalogue_version: input.catalogueVersion,
    p_expected_company_version: input.companyVersion,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw upgradeError(error);
  return state(data);
}

export async function applyFestivalCompanyLicence(input: {
  festivalCompanyId: string;
  tierKey: string;
  licenceVersion: number;
  idempotencyKey: string;
}) {
  const { data, error } = await rpc("apply_festival_company_licence", {
    p_festival_company_id: input.festivalCompanyId,
    p_requested_tier_key: input.tierKey,
    p_expected_licence_version: input.licenceVersion,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw licenceError(error);
  return state(data);
}
