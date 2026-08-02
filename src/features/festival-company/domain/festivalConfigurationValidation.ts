import {
  inclusiveDuration,
  type FestivalConfigurationDraft,
  type FestivalScaleOption,
  type FestivalCity,
} from "./festivalConfiguration";

export interface FieldValidation {
  valid: boolean;
  code?: string;
  message?: string;
}
export interface FestivalDraftValidation {
  fields: Record<
    | "publicName"
    | "shortName"
    | "tagline"
    | "description"
    | "homeCityId"
    | "festivalScale"
    | "annualMonth"
    | "vibe"
    | "siteType"
    | "environmentalPolicy"
    | "plannedStartDate"
    | "plannedEndDate",
    FieldValidation
  >;
  identityValid: boolean;
  locationValid: boolean;
  datesValid: boolean;
  allValid: boolean;
  durationDays: number | null;
}
const ok = (): FieldValidation => ({ valid: true });
const error = (code: string, message: string): FieldValidation => ({
  valid: false,
  code,
  message,
});
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateValid = (value: string) =>
  datePattern.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function validateFestivalDraft(
  draft: FestivalConfigurationDraft,
  cities: FestivalCity[],
  scales: FestivalScaleOption[],
  today = new Date().toISOString().slice(0, 10),
): FestivalDraftValidation {
  const nameLength = draft.publicName.trim().length;
  const publicName =
    nameLength < 3 || nameLength > 80
      ? error(
          "festival_public_name_length",
          "Public name must be between 3 and 80 characters.",
        )
      : ok();
  const shortName =
    draft.shortName.trim().length > 24
      ? error(
          "festival_short_name_length",
          "Short name must be 24 characters or fewer.",
        )
      : ok();
  const tagline =
    draft.tagline.trim().length > 120
      ? error(
          "festival_tagline_length",
          "Tagline must be 120 characters or fewer.",
        )
      : ok();
  const description =
    draft.description.trim().length > 1_000
      ? error(
          "festival_description_length",
          "Description must be 1,000 characters or fewer.",
        )
      : ok();
  const homeCityId = !draft.homeCityId
    ? error("festival_city_required", "Choose a home city.")
    : !cities.some((city) => city.id === draft.homeCityId)
      ? error(
          "festival_city_inactive",
          "The selected city is no longer available. Choose another city.",
        )
      : ok();
  const selectedScale = scales.find(
    (scale) => scale.key === draft.festivalScale,
  );
  const festivalScale = !draft.festivalScale
    ? error("festival_scale_required", "Choose an initial scale.")
    : !selectedScale
      ? error(
          "festival_scale_inactive",
          "The selected scale is no longer available. Choose another scale.",
        )
      : ok();
  const annualMonth = !Number.isInteger(draft.annualMonth) || draft.annualMonth! < 1 || draft.annualMonth! > 12 ? error("festival_annual_month_required", "Choose the recurring annual month.") : ok();
  const vibe = !draft.vibe ? error("festival_vibe_required", "Choose a festival vibe.") : ok();
  const siteType = !draft.siteType ? error("festival_site_type_required", "Choose a site approach.") : ok();
  const environmentalPolicy = !draft.environmentalPolicy ? error("festival_environmental_policy_required", "Choose an environmental policy.") : ok();
  const plannedStartDate = !draft.plannedStartDate
    ? error("festival_start_required", "Choose a start date.")
    : !dateValid(draft.plannedStartDate)
      ? error("festival_start_malformed", "Enter a valid start date.")
      : draft.plannedStartDate < today
        ? error("festival_start_past", "Start date cannot be in the past.")
        : ok();
  let plannedEndDate = !draft.plannedEndDate
    ? error("festival_end_required", "Choose an end date.")
    : !dateValid(draft.plannedEndDate)
      ? error("festival_end_malformed", "Enter a valid end date.")
      : ok();
  const durationDays = inclusiveDuration(
    draft.plannedStartDate,
    draft.plannedEndDate,
  );
  if (plannedStartDate.valid && plannedEndDate.valid && durationDays === null)
    plannedEndDate = error(
      "festival_end_before_start",
      "End date cannot be before the start date.",
    );
  if (
    durationDays &&
    selectedScale &&
    durationDays > selectedScale.maximumDurationDays
  )
    plannedEndDate = error(
      "festival_duration_too_long",
      `This scale supports a maximum of ${selectedScale.maximumDurationDays} days.`,
    );
  const fields = {
    publicName,
    shortName,
    tagline,
    description,
    homeCityId,
    festivalScale,
    annualMonth,
    vibe,
    siteType,
    environmentalPolicy,
    plannedStartDate,
    plannedEndDate,
  };
  const identityValid =
    publicName.valid && shortName.valid && tagline.valid && description.valid;
  const locationValid = homeCityId.valid && festivalScale.valid && annualMonth.valid && vibe.valid && siteType.valid && environmentalPolicy.valid;
  const datesValid =
    plannedStartDate.valid && plannedEndDate.valid && durationDays !== null;
  return {
    fields,
    identityValid,
    locationValid,
    datesValid,
    allValid: identityValid && locationValid && datesValid,
    durationDays,
  };
}

export const maximumReachableStep = (validation: FestivalDraftValidation) =>
  !validation.identityValid
    ? 1
    : !validation.locationValid
      ? 2
      : !validation.datesValid
        ? 3
        : 4;
