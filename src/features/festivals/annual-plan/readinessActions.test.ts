import { describe, expect, it } from "vitest";
import { getAnnualPlanReadinessLabel, getReadinessAction } from "./readinessActions";

describe("Festival annual-plan owner readiness actions", () => {
  it.each([
    ["festival_dates_required", "when"],
    ["festival_city_required", "when"],
    ["festival_site_style_required", "festival"],
    ["festival_scale_required", "festival"],
    ["festival_vibe_required", "festival"],
    ["festival_marketing_required", "promotion"],
  ] as const)("directs %s to the editable %s section", (code, section) => {
    expect(getReadinessAction(code)).toMatchObject({ kind: "section", section });
  });

  it.each([
    "festival_licence_required",
    "festival_licence_capacity_exceeded",
    "festival_licence_duration_exceeded",
  ])("routes %s to the licence options rather than silently reducing capacity", (code) => {
    expect(getReadinessAction(code).kind).toBe("licence");
  });

  it("keeps unknown server-reported blockers visible without guessing a fix", () => {
    expect(getReadinessAction("future_validation_rule")).toEqual({ kind: "review", label: "Review the plan" });
  });

  it("never marks a blocked or unverified plan ready from its score alone", () => {
    const blocked = { planningStatus: "ready" as const, readinessScore: 100, blockers: [{ code: "festival_city_required", message: "Choose city" }] };
    expect(getAnnualPlanReadinessLabel(blocked)).toBe("Action required");
    expect(getAnnualPlanReadinessLabel({ ...blocked, blockers: [] })).toBe("Plan ready");
    expect(getAnnualPlanReadinessLabel({ ...blocked, planningStatus: "in_progress", blockers: [] })).toBe("Taking shape");
    expect(getAnnualPlanReadinessLabel({ ...blocked, readinessScore: 80 })).toBe("Action required");
  });
});
