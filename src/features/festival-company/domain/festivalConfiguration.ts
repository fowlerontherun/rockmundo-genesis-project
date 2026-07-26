export const festivalScales = ["local", "small", "medium", "large", "major"] as const;
export const festivalConfigurationStatuses = ["not_started", "in_progress", "identity_complete", "schedule_complete", "draft_complete", "ready_for_planning"] as const;
export type FestivalScale = typeof festivalScales[number];
export type FestivalConfigurationStatus = typeof festivalConfigurationStatuses[number];

export interface FestivalScaleOption { key: FestivalScale; displayName: string; description: string; minimumCapacity: number; maximumCapacity: number; maximumDurationDays: number; complexity: string }
export interface FestivalCity { id: string; name: string; country: string; timezone: string | null }
export interface FestivalConfiguration {
  festivalCompanyId: string; legalCompanyName: string; publicName: string; shortName: string; tagline: string; description: string;
  homeCity: FestivalCity | null; festivalScale: FestivalScale | null; plannedStartDate: string | null; plannedEndDate: string | null;
  durationDays: number | null; setupStatus: FestivalConfigurationStatus; currentStep: number; configurationVersion: number;
  updatedAt: string | null; canWrite: boolean; scales: FestivalScaleOption[]; cities: FestivalCity[];
}
export interface FestivalConfigurationDraft { publicName: string; shortName: string; tagline: string; description: string; homeCityId: string | null; festivalScale: FestivalScale | null; plannedStartDate: string | null; plannedEndDate: string | null; currentStep: number; complete: boolean }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";
const city = (v: unknown): v is FestivalCity => object(v) && typeof v.id === "string" && uuid.test(v.id) && typeof v.name === "string" && typeof v.country === "string" && (v.timezone === null || typeof v.timezone === "string");
const scale = (v: unknown): v is FestivalScaleOption => object(v) && festivalScales.includes(v.key as FestivalScale) && typeof v.displayName === "string" && typeof v.description === "string" && Number.isInteger(v.minimumCapacity) && Number.isInteger(v.maximumCapacity) && Number.isInteger(v.maximumDurationDays) && typeof v.complexity === "string";

export function parseFestivalConfiguration(v: unknown): FestivalConfiguration {
  if (!object(v) || typeof v.festivalCompanyId !== "string" || !uuid.test(v.festivalCompanyId) || typeof v.legalCompanyName !== "string" || typeof v.publicName !== "string" ||
    !festivalConfigurationStatuses.includes(v.setupStatus as FestivalConfigurationStatus) || !Number.isInteger(v.currentStep) || !Number.isInteger(v.configurationVersion) ||
    typeof v.canWrite !== "boolean" || !Array.isArray(v.scales) || !v.scales.every(scale) || !Array.isArray(v.cities) || !v.cities.every(city) || (v.homeCity !== null && !city(v.homeCity))) throw new Error("malformed_festival_configuration_result");
  return v as unknown as FestivalConfiguration;
}

export const inclusiveDuration = (start: string | null, end: string | null) => {
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  const days = Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
  return days > 0 ? days : null;
};
