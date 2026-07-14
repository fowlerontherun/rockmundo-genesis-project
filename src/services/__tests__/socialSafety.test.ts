import { describe, expect, it } from "vitest";
import { BLOCK_REASON_OPTIONS, REPORT_CATEGORIES } from "@/services/socialSafety";

describe("social safety configuration", () => {
  it("keeps block reasons private and optional by providing prefer-not-to-say", () => {
    expect(BLOCK_REASON_OPTIONS.map((option) => option.value)).toContain("prefer_not_to_say");
    expect(BLOCK_REASON_OPTIONS.every((option) => option.label.length > 0)).toBe(true);
  });

  it("marks urgent report categories that require real-world safety messaging", () => {
    const urgent = REPORT_CATEGORIES.filter((category) => "emergency" in category && category.emergency).map((category) => category.value);
    expect(urgent).toContain("threats_intimidation");
    expect(REPORT_CATEGORIES.map((category) => category.value)).toContain("personal_information");
  });

  it("centralizes report categories so forms can reuse the same list", () => {
    expect(new Set(REPORT_CATEGORIES.map((category) => category.value)).size).toBe(REPORT_CATEGORIES.length);
    expect(REPORT_CATEGORIES.length).toBeGreaterThanOrEqual(12);
  });
});
