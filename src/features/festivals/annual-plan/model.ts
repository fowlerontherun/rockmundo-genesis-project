import { z } from "zod";

const nullableDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const catalogueOptionSchema = z.object({
  key: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string(),
});

export const annualPlanCitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  country: z.string().min(1),
  timezone: z.string().min(1),
});

export const annualPlanScaleSchema = catalogueOptionSchema.extend({
  minimumCapacity: z.number().int().positive(),
  maximumCapacity: z.number().int().positive(),
  maximumDurationDays: z.number().int().min(1).max(7),
  complexity: z.string().min(1),
});

export const annualPlanMarketingSchema = catalogueOptionSchema.extend({
  demandBasisPoints: z.number().int().nonnegative(),
  costBasisPoints: z.number().int().nonnegative(),
  reputationBasisPoints: z.number().int().nonnegative(),
  localArtistBasisPoints: z.number().int().min(0).max(10000),
});

export const annualPlanBlockerSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export const festivalAnnualPlanSchema = z.object({
  festivalCompanyId: z.string().uuid(),
  festivalEditionId: z.string().uuid(),
  editionYear: z.number().int().positive(),
  name: z.string().min(1),
  status: z.string().min(1),
  editable: z.boolean(),
  version: z.number().int().nonnegative(),
  startsOn: nullableDate,
  endsOn: nullableDate,
  preferredMonth: z.number().int().min(1).max(12).nullable(),
  city: annualPlanCitySchema.nullable(),
  siteType: z.string().nullable(),
  festivalScale: z.string().nullable(),
  durationDays: z.number().int().min(1).max(7).nullable(),
  vibe: z.string().nullable(),
  environmentalPolicy: z.string().nullable(),
  marketingEmphasis: z.string().nullable(),
  expectedCapacity: z.number().int().positive().nullable(),
  estimatedOperatingCostMinor: z.number().int().nonnegative(),
  planningStatus: z.enum(["not_started", "in_progress", "ready"]),
  readinessScore: z.number().int().min(0).max(100),
  planningEffects: z.record(z.string(), z.unknown()),
  blockers: z.array(annualPlanBlockerSchema),
  canWrite: z.boolean(),
  updatedAt: z.string().nullable(),
  cities: z.array(annualPlanCitySchema),
  scales: z.array(annualPlanScaleSchema),
  vibes: z.array(catalogueOptionSchema),
  siteTypes: z.array(catalogueOptionSchema),
  environmentalPolicies: z.array(catalogueOptionSchema),
  marketingEmphases: z.array(annualPlanMarketingSchema),
});

export type FestivalAnnualPlan = z.infer<typeof festivalAnnualPlanSchema>;
export type FestivalAnnualPlanScale = z.infer<typeof annualPlanScaleSchema>;
export type FestivalAnnualPlanMarketing = z.infer<typeof annualPlanMarketingSchema>;

export type FestivalAnnualPlanDraft = {
  startsOn: string;
  preferredMonth: number;
  cityId: string;
  siteType: string;
  festivalScale: string;
  durationDays: number;
  vibe: string;
  environmentalPolicy: string;
  marketingEmphasis: string;
};

export type FestivalCapacityProjection = {
  potentialCapacity: number | null;
  licensedCapacity: number | null;
  licenceCapacityLimit: number | null;
  capacityRestrictedByLicence: boolean;
  reservedUntilLicenceUpgrade: number;
};

const planningEffectNumber = (
  effects: Record<string, unknown>,
  key: string,
): number | null => {
  const value = effects[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
};

export function getAnnualPlanCapacityProjection(
  plan: Pick<FestivalAnnualPlan, "expectedCapacity" | "planningEffects">,
): FestivalCapacityProjection {
  const potentialCapacity =
    planningEffectNumber(plan.planningEffects, "potentialCapacity") ??
    plan.expectedCapacity;
  const licensedCapacity =
    planningEffectNumber(plan.planningEffects, "licensedCapacity") ??
    planningEffectNumber(plan.planningEffects, "capacity") ??
    plan.expectedCapacity;
  const licenceCapacityLimit = planningEffectNumber(
    plan.planningEffects,
    "licenceCapacityLimit",
  );
  const explicitRestriction =
    plan.planningEffects.capacityRestrictedByLicence === true;
  const capacityRestrictedByLicence = Boolean(
    explicitRestriction ||
      (potentialCapacity !== null &&
        licensedCapacity !== null &&
        potentialCapacity > licensedCapacity),
  );

  return {
    potentialCapacity,
    licensedCapacity,
    licenceCapacityLimit,
    capacityRestrictedByLicence,
    reservedUntilLicenceUpgrade:
      potentialCapacity !== null && licensedCapacity !== null
        ? Math.max(0, potentialCapacity - licensedCapacity)
        : 0,
  };
}

export const annualPlanToDraft = (
  plan: FestivalAnnualPlan,
): FestivalAnnualPlanDraft => ({
  startsOn: plan.startsOn ?? "",
  preferredMonth: plan.preferredMonth ?? 6,
  cityId: plan.city?.id ?? plan.cities[0]?.id ?? "",
  siteType: plan.siteType ?? plan.siteTypes[0]?.key ?? "outdoor",
  festivalScale: plan.festivalScale ?? plan.scales[0]?.key ?? "local",
  durationDays: plan.durationDays ?? 1,
  vibe: plan.vibe ?? plan.vibes[0]?.key ?? "community",
  environmentalPolicy:
    plan.environmentalPolicy ??
    plan.environmentalPolicies[0]?.key ??
    "standard",
  marketingEmphasis:
    plan.marketingEmphasis ?? plan.marketingEmphases[0]?.key ?? "balanced",
});

export function calculateAnnualPlanEndDate(
  startsOn: string,
  durationDays: number,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || durationDays < 1) return null;
  const date = new Date(`${startsOn}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + durationDays - 1);
  return date.toISOString().slice(0, 10);
}

export function annualPlanDraftIsComplete(
  draft: FestivalAnnualPlanDraft,
): boolean {
  if (
    !draft.startsOn ||
    !draft.cityId ||
    !draft.siteType ||
    !draft.festivalScale ||
    !draft.vibe ||
    !draft.environmentalPolicy ||
    !draft.marketingEmphasis ||
    draft.durationDays < 1 ||
    draft.preferredMonth < 1 ||
    draft.preferredMonth > 12
  ) {
    return false;
  }
  const date = new Date(`${draft.startsOn}T12:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCMonth() + 1 === draft.preferredMonth
  );
}
