import { isBefore, isValid, startOfDay } from "date-fns";

export type FormValidationResult = { valid: boolean; message?: string };

export function validateRequired(
  value: unknown,
  label: string,
): FormValidationResult {
  if (typeof value === "string") {
    return value.trim()
      ? { valid: true }
      : { valid: false, message: `${label} is required.` };
  }

  return value == null || value === false
    ? { valid: false, message: `${label} is required.` }
    : { valid: true };
}

export function validateFutureOrTodayDate(
  date: Date | null | undefined,
  label = "Date",
): FormValidationResult {
  if (!date || !isValid(date)) {
    return { valid: false, message: `Choose a valid ${label.toLowerCase()}.` };
  }

  if (isBefore(startOfDay(date), startOfDay(new Date()))) {
    return { valid: false, message: `${label} cannot be in the past.` };
  }

  return { valid: true };
}

export function validateDurationHours(
  duration: unknown,
  min = 1,
  max = 24,
): FormValidationResult {
  const numericDuration = Number(duration);

  if (!Number.isFinite(numericDuration)) {
    return { valid: false, message: "Choose a valid duration." };
  }

  if (numericDuration < min) {
    return {
      valid: false,
      message: `Duration must be at least ${min} hour${min === 1 ? "" : "s"}.`,
    };
  }

  if (numericDuration > max) {
    return {
      valid: false,
      message: `Duration cannot be more than ${max} hours.`,
    };
  }

  return { valid: true };
}

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}
