import { describe, expect, it } from "vitest";
import { CANONICAL_SKILLS } from "../skillCatalogue";
import { applyRecovery, applySharpnessToSkillContribution, calculateCurrentSharpness, getSharpnessModifier, isComebackEligible, isMeaningfulQualifyingUse, MAINTENANCE_POLICIES } from "../skillMaintenance";

describe("skill maintenance", () => {
  it("protects foundation and low-level skills from maintenance", () => {
    const guitar = CANONICAL_SKILLS.find((s) => s.slug === "guitar")!;
    expect(guitar.supports_maintenance).toBe(false);
    expect(guitar.maintenance_policy_key).toBe("none");
  });

  it("enables configured policies for professional skills", () => {
    const technical = CANONICAL_SKILLS.find((s) => s.slug === "technical")!;
    expect(technical.supports_maintenance).toBe(true);
    expect(technical.maintenance_policy_key).toBe("professional_standard");
    expect(technical.maintenance_grace_days).toBe(45);
  });

  it("does not rust during grace and enforces protected floor", () => {
    const now = new Date("2026-07-12T00:00:00Z");
    expect(calculateCurrentSharpness({ policyKey: "professional_standard", lastQualifiedUseAt: "2026-06-20T00:00:00Z", now })).toBe(100);
    expect(calculateCurrentSharpness({ policyKey: "professional_standard", lastQualifiedUseAt: "2025-07-12T00:00:00Z", now })).toBe(MAINTENANCE_POLICIES.professional_standard.floor);
  });

  it("uses a small bounded effectiveness modifier without changing displayed level", () => {
    expect(getSharpnessModifier(100)).toBe(1);
    expect(getSharpnessModifier(80)).toBeGreaterThan(0.95);
    expect(getSharpnessModifier(75)).toBeGreaterThanOrEqual(0.95);
    expect(applySharpnessToSkillContribution(50, 80, true)).toBeGreaterThan(48);
    expect(applySharpnessToSkillContribution(50, 60, false)).toBe(50);
  });

  it("validates meaningful use and rejects duplicates/cancellations", () => {
    const base = { activityType: "recording" as const, completed: true, attended: true, relevantRole: true, durationMinutes: 60, sourceId: "session-1", rewardValue: 1 };
    expect(isMeaningfulQualifyingUse(base, "professional_standard")).toBe(true);
    expect(isMeaningfulQualifyingUse({ ...base, duplicate: true }, "professional_standard")).toBe(false);
    expect(isMeaningfulQualifyingUse({ ...base, cancelled: true }, "professional_standard")).toBe(false);
    expect(isMeaningfulQualifyingUse({ ...base, relevantRole: false }, "professional_standard")).toBe(false);
    expect(isMeaningfulQualifyingUse({ ...base, durationMinutes: 10 }, "professional_standard")).toBe(false);
  });

  it("recovers quickly and caps comeback bonuses", () => {
    const first = applyRecovery({ currentSharpness: 80, policyKey: "professional_standard" });
    const second = applyRecovery({ currentSharpness: first, policyKey: "professional_standard", comebackActive: true });
    expect(first).toBeGreaterThanOrEqual(92);
    expect(second).toBeLessThanOrEqual(100);
    expect(second).toBeGreaterThan(first);
  });

  it("activates comeback only after long meaningful inactivity", () => {
    const now = new Date("2026-07-12T00:00:00Z");
    expect(isComebackEligible("2026-06-20T00:00:00Z", now)).toBe(false);
    expect(isComebackEligible("2026-03-01T00:00:00Z", now)).toBe(true);
  });
});
