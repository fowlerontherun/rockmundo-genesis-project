export const festivalConfigurationErrorCodes = [
  "festival_company_not_found",
  "festival_configuration_forbidden",
  "festival_configuration_invalid",
  "festival_configuration_stale",
  "festival_configuration_idempotency_conflict",
  "festival_name_conflict",
  "festival_city_invalid",
  "festival_scale_invalid",
  "festival_dates_invalid",
  "festival_configuration_unavailable",
] as const;
export type FestivalConfigurationErrorCode =
  (typeof festivalConfigurationErrorCodes)[number];

export class FestivalConfigurationError extends Error {
  constructor(
    public readonly code: FestivalConfigurationErrorCode,
    public readonly databaseCode?: string,
  ) {
    super(code);
    this.name = "FestivalConfigurationError";
  }
}

export function normalizeFestivalConfigurationError(
  value: unknown,
): FestivalConfigurationError {
  const candidate =
    value && typeof value === "object"
      ? (value as { message?: unknown; code?: unknown; details?: unknown })
      : {};
  const message =
    typeof candidate.message === "string" ? candidate.message : "";
  const known = festivalConfigurationErrorCodes.find(
    (code) => message === code || message.includes(code),
  );
  return new FestivalConfigurationError(
    known ?? "festival_configuration_unavailable",
    typeof candidate.code === "string" ? candidate.code : undefined,
  );
}

export const festivalConfigurationErrorMessage = (error: unknown) => {
  const code =
    error instanceof FestivalConfigurationError
      ? error.code
      : "festival_configuration_unavailable";
  const messages: Record<FestivalConfigurationErrorCode, string> = {
    festival_company_not_found: "This festival company could not be found.",
    festival_configuration_forbidden:
      "You do not have permission to change this configuration.",
    festival_configuration_invalid:
      "Some configuration details are invalid. Review the highlighted fields.",
    festival_configuration_stale: "Another session saved a newer version.",
    festival_configuration_idempotency_conflict:
      "This save request conflicts with an earlier request. Try saving again.",
    festival_name_conflict: "That public festival name is already in use.",
    festival_city_invalid: "Choose an available city.",
    festival_scale_invalid: "Choose an available festival scale.",
    festival_dates_invalid: "Review the festival dates and duration.",
    festival_configuration_unavailable:
      "Festival configuration is temporarily unavailable. Try again.",
  };
  return messages[code];
};
