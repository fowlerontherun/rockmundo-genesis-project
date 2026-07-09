import { describe, expect, it, vi } from "vitest";
import {
  validateDurationHours,
  validateFutureOrTodayDate,
  validateRequired,
  getErrorMessage,
} from "../formValidation";

describe("form validation helpers", () => {
  it("validates required strings consistently", () => {
    expect(validateRequired("Rock Stars", "Band name")).toEqual({
      valid: true,
    });
    expect(validateRequired("   ", "Band name")).toEqual({
      valid: false,
      message: "Band name is required.",
    });
  });

  it("validates durations with friendly messages", () => {
    expect(validateDurationHours(2, 1, 6)).toEqual({ valid: true });
    expect(validateDurationHours(0, 1, 6).message).toBe(
      "Duration must be at least 1 hour.",
    );
    expect(validateDurationHours(8, 1, 6).message).toBe(
      "Duration cannot be more than 6 hours.",
    );
    expect(validateDurationHours("nope").message).toBe(
      "Choose a valid duration.",
    );
  });

  it("validates date selections against past days", () => {
    vi.setSystemTime(new Date("2026-07-09T12:00:00Z"));
    expect(validateFutureOrTodayDate(new Date("2026-07-09T00:00:00Z"))).toEqual(
      { valid: true },
    );
    expect(
      validateFutureOrTodayDate(new Date("2026-07-08T23:00:00Z")).message,
    ).toBe("Date cannot be in the past.");
    vi.useRealTimers();
  });

  it("normalizes API error messages", () => {
    expect(getErrorMessage({ message: "Supabase failed" })).toBe(
      "Supabase failed",
    );
    expect(getErrorMessage(null, "Fallback")).toBe("Fallback");
  });
});
