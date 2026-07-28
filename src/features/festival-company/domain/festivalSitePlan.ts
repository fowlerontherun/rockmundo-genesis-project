export const festivalSiteSources = [
  "existing_venue",
  "temporary_site",
  "open_land",
  "mixed_site",
] as const;
export const festivalSiteTypes = ["indoor", "outdoor", "mixed"] as const;
export const festivalSitePlanStatuses = [
  "not_started",
  "in_progress",
  "site_selected",
  "stages_configured",
  "ready_for_ticketing",
] as const;
export const festivalStageTypes = [
  "main",
  "secondary",
  "emerging",
  "acoustic",
  "dance",
  "specialist",
  "community",
] as const;
export type FestivalSiteSource = (typeof festivalSiteSources)[number];
export type FestivalSiteType = (typeof festivalSiteTypes)[number];
export type FestivalSitePlanStatus = (typeof festivalSitePlanStatuses)[number];
export type FestivalStageType = (typeof festivalStageTypes)[number];

export interface FestivalPlanningIssue {
  code: string;
  severity: "error" | "warning";
  section: "site" | "stages" | "facilities";
  field: string | null;
  message: string;
  blocking: boolean;
}
export interface FestivalScalePlanningLimits {
  minimumSiteCapacity: number;
  maximumSiteCapacity: number;
  minimumStages: number;
  maximumStages: number;
  maximumMainStageCapacity: number;
  maximumTotalStageCapacity: number;
  requiresSecondaryStage: boolean;
  requiresAccessibilityPlan: boolean;
}
export interface FestivalFacilityRecommendations {
  toiletsRequired: number;
  medicalPointsRequired: number;
  securityPositionsRequired: number;
  barsRecommended: number;
  foodVendorSpacesRecommended: number;
  waterPointsRequired: number;
  accessibleViewingRequired: number;
  backstageZonesRequired: number;
  parkingRequirement: number;
  transportRequirement: number;
}
export interface FestivalVenueOption {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
  venueType: string;
  siteType: FestivalSiteType;
  capacity: number;
  quality: number;
  active: boolean;
  festivalCompatible: boolean;
  availability: "available" | "unknown" | "unavailable";
}
export interface FestivalStage {
  id: string | null;
  name: string;
  slug: string;
  stageType: FestivalStageType;
  sortOrder: number;
  capacity: number;
  minimumArtistFame: number | null;
  performanceAreaQuality: number | null;
  soundQuality: number | null;
  lightingQuality: number | null;
  productionComplexity: string;
  indoor: boolean;
  covered: boolean;
  accessibleViewingCapacity: number;
  opensAt: string;
  closesAt: string;
  changeoverMinutes: number;
  headlineSlotMinutes: number;
  standardSlotMinutes: number;
  status: "planned" | "ready";
}
export interface FestivalSitePlan {
  id: string | null;
  siteSource: FestivalSiteSource;
  existingVenueId: string | null;
  siteName: string;
  siteType: FestivalSiteType;
  siteDescription: string;
  cityId: string;
  timezone: string | null;
  totalCapacity: number;
  usableCapacity: number;
  reservedCapacity: number;
  minimumAge: number | null;
  curfewTime: string | null;
  gatesOpenTime: string | null;
  dailyOpenTime: string;
  dailyCloseTime: string;
  accessibilityNotes: string;
  transportNotes: string;
  weatherExposure: string;
  groundCondition: string;
  status: FestivalSitePlanStatus;
}
export interface FestivalSitePlanResult {
  festivalCompanyId: string;
  festivalName: string;
  configurationStatus: string;
  sitePlan: FestivalSitePlan | null;
  venueOptions: FestivalVenueOption[];
  scaleLimits: FestivalScalePlanningLimits;
  stages: FestivalStage[];
  facilities: FestivalFacilityRecommendations;
  issues: FestivalPlanningIssue[];
  ready: boolean;
  canWrite: boolean;
  planningVersion: number;
  updatedAt: string | null;
  capacityMetrics: {
    largestStageCapacity: number;
    totalStageCapacity: number;
    mainStageShare: number;
    accessibleViewingTotal: number;
    peakCrowdConcentration: number;
  };
}
export type FestivalSitePlanDraft = {
  sitePlan: FestivalSitePlan;
  stages: FestivalStage[];
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => typeof v === "string";
const text = (v: unknown) => str(v) && v.trim().length > 0;
const integer = (v: unknown, min = 0) =>
  Number.isInteger(v) && (v as number) >= min;
const nullableUuid = (v: unknown) => v === null || (str(v) && UUID.test(v));
const nullableTime = (v: unknown) => v === null || (str(v) && TIME.test(v));
const fail = (): never => {
  throw new Error("malformed_festival_site_plan_result");
};

export function parseFestivalStage(v: unknown): FestivalStage {
  if (
    !obj(v) ||
    !nullableUuid(v.id) ||
    !text(v.name) ||
    !text(v.slug) ||
    !festivalStageTypes.includes(v.stageType as FestivalStageType) ||
    !integer(v.sortOrder) ||
    !integer(v.capacity, 1) ||
    !(v.minimumArtistFame === null || integer(v.minimumArtistFame)) ||
    !(v.performanceAreaQuality === null || integer(v.performanceAreaQuality)) ||
    !(v.soundQuality === null || integer(v.soundQuality)) ||
    !(v.lightingQuality === null || integer(v.lightingQuality)) ||
    !str(v.productionComplexity) ||
    typeof v.indoor !== "boolean" ||
    typeof v.covered !== "boolean" ||
    !integer(v.accessibleViewingCapacity) ||
    !str(v.opensAt) ||
    !TIME.test(v.opensAt) ||
    !str(v.closesAt) ||
    !TIME.test(v.closesAt) ||
    !integer(v.changeoverMinutes, 5) ||
    !integer(v.headlineSlotMinutes, 15) ||
    !integer(v.standardSlotMinutes, 10) ||
    !(v.status === "planned" || v.status === "ready")
  )
    return fail();
  if ((v.accessibleViewingCapacity as number) > (v.capacity as number)) return fail();
  return v as unknown as FestivalStage;
}
export function parseFestivalVenueOption(v: unknown): FestivalVenueOption {
  if (
    !obj(v) ||
    !str(v.id) ||
    !UUID.test(v.id) ||
    !text(v.name) ||
    !str(v.cityId) ||
    !UUID.test(v.cityId) ||
    !text(v.cityName) ||
    !text(v.venueType) ||
    !festivalSiteTypes.includes(v.siteType as FestivalSiteType) ||
    !integer(v.capacity, 1) ||
    !integer(v.quality) ||
    typeof v.active !== "boolean" ||
    typeof v.festivalCompatible !== "boolean" ||
    !["available", "unknown", "unavailable"].includes(String(v.availability))
  )
    return fail();
  return v as unknown as FestivalVenueOption;
}
const numericObject = (v: unknown, keys: string[]) =>
  obj(v) && keys.every((k) => integer(v[k]));
export function parseFestivalSitePlanResult(
  v: unknown,
): FestivalSitePlanResult {
  if (
    !obj(v) ||
    !str(v.festivalCompanyId) ||
    !UUID.test(v.festivalCompanyId) ||
    !text(v.festivalName) ||
    !str(v.configurationStatus) ||
    !Array.isArray(v.venueOptions) ||
    !Array.isArray(v.stages) ||
    !Array.isArray(v.issues) ||
    typeof v.ready !== "boolean" ||
    typeof v.canWrite !== "boolean" ||
    !integer(v.planningVersion) ||
    !(
      v.updatedAt === null ||
      (str(v.updatedAt) && !Number.isNaN(Date.parse(v.updatedAt)))
    )
  )
    return fail();
  const venues = v.venueOptions.map(parseFestivalVenueOption),
    stages = v.stages.map(parseFestivalStage);
  if (
    new Set(stages.map((s) => s.name.trim().toLocaleLowerCase("en-GB")))
      .size !== stages.length ||
    new Set(stages.map((s) => s.slug)).size !== stages.length
  )
    return fail();
  const p = v.sitePlan;
  if (
    p !== null &&
    (!obj(p) ||
      !nullableUuid(p.id) ||
      !festivalSiteSources.includes(p.siteSource as FestivalSiteSource) ||
      !nullableUuid(p.existingVenueId) ||
      !str(p.siteName) ||
      !festivalSiteTypes.includes(p.siteType as FestivalSiteType) ||
      !str(p.siteDescription) ||
      !str(p.cityId) ||
      !UUID.test(p.cityId) ||
      !(p.timezone === null || text(p.timezone)) ||
      !integer(p.totalCapacity, 1) ||
      !integer(p.usableCapacity, 1) ||
      !integer(p.reservedCapacity) ||
      !nullableTime(p.curfewTime) ||
      !nullableTime(p.gatesOpenTime) ||
      !str(p.dailyOpenTime) ||
      !TIME.test(p.dailyOpenTime) ||
      !str(p.dailyCloseTime) ||
      !TIME.test(p.dailyCloseTime) ||
      !festivalSitePlanStatuses.includes(p.status as FestivalSitePlanStatus))
  )
    return fail();
  const facilityKeys = [
    "toiletsRequired",
    "medicalPointsRequired",
    "securityPositionsRequired",
    "barsRecommended",
    "foodVendorSpacesRecommended",
    "waterPointsRequired",
    "accessibleViewingRequired",
    "backstageZonesRequired",
    "parkingRequirement",
    "transportRequirement",
  ];
  const limitKeys = [
    "minimumSiteCapacity",
    "maximumSiteCapacity",
    "minimumStages",
    "maximumStages",
    "maximumMainStageCapacity",
    "maximumTotalStageCapacity",
  ];
  const metricKeys = [
    "largestStageCapacity",
    "totalStageCapacity",
    "mainStageShare",
    "accessibleViewingTotal",
    "peakCrowdConcentration",
  ];
  if (
    !numericObject(v.facilities, facilityKeys) ||
    !numericObject(v.scaleLimits, limitKeys) ||
    !obj(v.scaleLimits) ||
    typeof v.scaleLimits.requiresSecondaryStage !== "boolean" ||
    typeof v.scaleLimits.requiresAccessibilityPlan !== "boolean" ||
    !numericObject(v.capacityMetrics, metricKeys)
  )
    return fail();
  if (
    !v.issues.every(
      (i) =>
        obj(i) &&
        text(i.code) &&
        ["error", "warning"].includes(String(i.severity)) &&
        ["site", "stages", "facilities"].includes(String(i.section)) &&
        (i.field === null || str(i.field)) &&
        text(i.message) &&
        typeof i.blocking === "boolean",
    )
  )
    return fail();
  return {
    ...v,
    venueOptions: venues,
    stages,
  } as unknown as FestivalSitePlanResult;
}
export const sitePlanToDraft = (
  result: FestivalSitePlanResult,
): FestivalSitePlanDraft | null =>
  result.sitePlan
    ? {
        sitePlan: { ...result.sitePlan },
        stages: result.stages.map((s) => ({ ...s })),
      }
    : null;
