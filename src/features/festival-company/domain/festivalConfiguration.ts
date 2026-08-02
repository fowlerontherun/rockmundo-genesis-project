export const festivalScales = [
  "local",
  "small",
  "medium",
  "large",
  "major",
] as const;
export const festivalConfigurationStatuses = [
  "not_started",
  "in_progress",
  "identity_complete",
  "schedule_complete",
  "draft_complete",
  "ready_for_planning",
] as const;
export type FestivalScale = (typeof festivalScales)[number];
export type FestivalConfigurationStatus =
  (typeof festivalConfigurationStatuses)[number];
export const festivalVibes = ["community", "alternative", "mainstream", "premium"] as const;
export const festivalSiteTypes = ["indoor", "outdoor", "mixed"] as const;
export const festivalEnvironmentalPolicies = ["standard", "responsible", "regenerative"] as const;
export type FestivalVibe = (typeof festivalVibes)[number];
export type FestivalSiteType = (typeof festivalSiteTypes)[number];
export type FestivalEnvironmentalPolicy = (typeof festivalEnvironmentalPolicies)[number];

export interface FestivalScaleOption {
  key: FestivalScale;
  displayName: string;
  description: string;
  minimumCapacity: number;
  maximumCapacity: number;
  maximumDurationDays: number;
  complexity: string;
}
export interface FestivalCity {
  id: string;
  name: string;
  country: string;
  timezone: string | null;
}
export interface FestivalConfiguration {
  festivalCompanyId: string;
  legalCompanyName: string;
  publicName: string;
  shortName: string;
  tagline: string;
  description: string;
  homeCity: FestivalCity | null;
  festivalScale: FestivalScale | null;
  annualMonth: number | null;
  countryCode: string;
  vibe: FestivalVibe | null;
  siteType: FestivalSiteType | null;
  environmentalPolicy: FestivalEnvironmentalPolicy | null;
  festivalEditionId: string | null;
  editionYear: number | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  durationDays: number | null;
  setupStatus: FestivalConfigurationStatus;
  currentStep: number;
  configurationVersion: number;
  updatedAt: string | null;
  canWrite: boolean;
  scales: FestivalScaleOption[];
  cities: FestivalCity[];
}
export interface FestivalConfigurationDraft {
  publicName: string;
  shortName: string;
  tagline: string;
  description: string;
  homeCityId: string | null;
  festivalScale: FestivalScale | null;
  annualMonth: number | null;
  vibe: FestivalVibe | null;
  siteType: FestivalSiteType | null;
  environmentalPolicy: FestivalEnvironmentalPolicy | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  currentStep: number;
  complete: boolean;
}

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const validDate = (value: string) =>
  isoDate.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const validTimestamp = (value: string) => !Number.isNaN(Date.parse(value));
const validTimezone = (value: string) => {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};
const parseCity = (value: unknown): FestivalCity | null => {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !uuid.test(value.id) ||
    !nonEmpty(value.name) ||
    !nonEmpty(value.country) ||
    !(
      value.timezone === null ||
      (typeof value.timezone === "string" && validTimezone(value.timezone))
    )
  )
    return null;
  return {
    id: value.id,
    name: value.name,
    country: value.country,
    timezone: value.timezone as string | null,
  };
};
const parseScale = (value: unknown): FestivalScaleOption | null => {
  if (
    !object(value) ||
    !festivalScales.includes(value.key as FestivalScale) ||
    !nonEmpty(value.displayName) ||
    !nonEmpty(value.description) ||
    !Number.isInteger(value.minimumCapacity) ||
    (value.minimumCapacity as number) < 0 ||
    !Number.isInteger(value.maximumCapacity) ||
    (value.maximumCapacity as number) < (value.minimumCapacity as number) ||
    !Number.isInteger(value.maximumDurationDays) ||
    (value.maximumDurationDays as number) < 1 ||
    (value.maximumDurationDays as number) > 7 ||
    !nonEmpty(value.complexity)
  )
    return null;
  return value as unknown as FestivalScaleOption;
};
const malformed = (): never => {
  throw new Error("malformed_festival_configuration_result");
};

export function inclusiveDuration(
  start: string | null,
  end: string | null,
): number | null {
  if (!start || !end || !validDate(start) || !validDate(end)) return null;
  const days =
    Math.floor(
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
        86_400_000,
    ) + 1;
  return days > 0 ? days : null;
}

export function parseFestivalConfiguration(
  value: unknown,
): FestivalConfiguration {
  if (
    !object(value) ||
    typeof value.festivalCompanyId !== "string" ||
    !uuid.test(value.festivalCompanyId) ||
    !nonEmpty(value.legalCompanyName) ||
    typeof value.publicName !== "string" ||
    typeof value.shortName !== "string" ||
    typeof value.tagline !== "string" ||
    typeof value.description !== "string" ||
    !festivalConfigurationStatuses.includes(
      value.setupStatus as FestivalConfigurationStatus,
    ) ||
    !Number.isInteger(value.currentStep) ||
    (value.currentStep as number) < 1 ||
    (value.currentStep as number) > 4 ||
    !Number.isInteger(value.configurationVersion) ||
    (value.configurationVersion as number) < 1 ||
    typeof value.canWrite !== "boolean" ||
    !Array.isArray(value.scales) ||
    !Array.isArray(value.cities)
  )
    return malformed();
  const scales = value.scales.map(parseScale);
  const cities = value.cities.map(parseCity);
  if (scales.some((entry) => !entry) || cities.some((entry) => !entry))
    return malformed();
  const homeCity = value.homeCity === null ? null : parseCity(value.homeCity);
  const festivalScale = value.festivalScale;
  const start = value.plannedStartDate;
  const end = value.plannedEndDate;
  const duration = value.durationDays;
  const updatedAt = value.updatedAt;
  if (
    (value.homeCity !== null && !homeCity) ||
    !(
      festivalScale === null ||
      festivalScales.includes(festivalScale as FestivalScale)
    ) ||
    !(start === null || (typeof start === "string" && validDate(start))) ||
    !(end === null || (typeof end === "string" && validDate(end))) ||
    !(
      duration === null ||
      (Number.isInteger(duration) && (duration as number) > 0)
    ) ||
    !(
      updatedAt === null ||
      (typeof updatedAt === "string" && validTimestamp(updatedAt))
    )
  )
    return malformed();
  const calculated = inclusiveDuration(
    start as string | null,
    end as string | null,
  );
  if (
    (start === null) !== (end === null) ||
    (start !== null && (calculated === null || calculated !== duration)) ||
    (festivalScale !== null &&
      !(scales as FestivalScaleOption[]).some(
        (entry) => entry.key === festivalScale,
      )) ||
    (homeCity &&
      !(cities as FestivalCity[]).some((entry) => entry.id === homeCity.id))
  )
    return malformed();
  const status = value.setupStatus as FestivalConfigurationStatus;
  if (
    (status === "schedule_complete" ||
      status === "draft_complete" ||
      status === "ready_for_planning") &&
    calculated === null
  )
    return malformed();
  if (
    status === "ready_for_planning" &&
    (value.publicName.trim().length < 3 ||
      !homeCity ||
      !festivalScale ||
      calculated === null)
  )
    return malformed();
  return {
    festivalCompanyId: value.festivalCompanyId,
    legalCompanyName: value.legalCompanyName,
    publicName: value.publicName,
    shortName: value.shortName,
    tagline: value.tagline,
    description: value.description,
    homeCity,
    festivalScale: festivalScale as FestivalScale | null,
    plannedStartDate: start as string | null,
    plannedEndDate: end as string | null,
    durationDays: duration as number | null,
    setupStatus: status,
    currentStep: value.currentStep as number,
    configurationVersion: value.configurationVersion as number,
    updatedAt: updatedAt as string | null,
    canWrite: value.canWrite,
    scales: scales as FestivalScaleOption[],
    cities: cities as FestivalCity[],
    annualMonth: Number.isInteger(value.annualMonth) ? value.annualMonth as number : null,
    countryCode: typeof value.countryCode === "string" ? value.countryCode : (homeCity?.country ?? ""),
    vibe: festivalVibes.includes(value.vibe as FestivalVibe) ? value.vibe as FestivalVibe : null,
    siteType: festivalSiteTypes.includes(value.siteType as FestivalSiteType) ? value.siteType as FestivalSiteType : null,
    environmentalPolicy: festivalEnvironmentalPolicies.includes(value.environmentalPolicy as FestivalEnvironmentalPolicy) ? value.environmentalPolicy as FestivalEnvironmentalPolicy : null,
    festivalEditionId: typeof value.festivalEditionId === "string" && uuid.test(value.festivalEditionId) ? value.festivalEditionId : null,
    editionYear: Number.isInteger(value.editionYear) ? value.editionYear as number : null,
  };
}

export const configurationToDraft = (
  configuration: FestivalConfiguration,
): FestivalConfigurationDraft => ({
  publicName: configuration.publicName,
  shortName: configuration.shortName,
  tagline: configuration.tagline,
  description: configuration.description,
  homeCityId: configuration.homeCity?.id ?? null,
  festivalScale: configuration.festivalScale,
  annualMonth: configuration.annualMonth,
  vibe: configuration.vibe,
  siteType: configuration.siteType,
  environmentalPolicy: configuration.environmentalPolicy,
  plannedStartDate: configuration.plannedStartDate,
  plannedEndDate: configuration.plannedEndDate,
  currentStep: configuration.currentStep,
  complete: configuration.setupStatus === "ready_for_planning",
});

export const draftsEqual = (
  left: FestivalConfigurationDraft,
  right: FestivalConfigurationDraft,
) => JSON.stringify(left) === JSON.stringify(right);
