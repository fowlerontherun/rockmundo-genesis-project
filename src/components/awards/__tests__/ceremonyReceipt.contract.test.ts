import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ceremony = readFileSync("src/components/awards/AwardCeremonyExperience.tsx", "utf8");
const page = readFileSync("src/pages/Awards.tsx", "utf8");
const hook = readFileSync("src/hooks/useAwards.ts", "utf8");

describe("award ceremony receipt and phase contracts", () => {
  it("matches the allowed server-side outfit choices and fame", () => {
    expect(ceremony).not.toContain('id: "casual"');
    expect(ceremony).not.toContain('id: "outrageous"');
    for (const [outfit, fame] of [["standard", 25], ["designer", 50], ["custom", 75]] as const) {
      expect(ceremony).toContain(`id: "${outfit}"`);
      expect(ceremony).toContain(`fame: ${fame}`);
    }
  });

  it("never advances before the red carpet write succeeds", () => {
    expect(ceremony).toContain("await onAttendRedCarpet(outfit.id)");
    expect(ceremony).toMatch(/await onAttendRedCarpet\(outfit\.id\);\s*setRedCarpetComplete\(true\)/);
    expect(ceremony).not.toContain("setTimeout(() => setCurrentPhase");
    expect(hook).toContain("attendRedCarpetAsync: attendRedCarpet.mutateAsync");
    expect(page).toContain('from("award_red_carpet_events")');
    expect(page).toContain("redCarpetAttended={hasRedCarpetAttendance}");
  });

  it("does not allow jumping forward or declaring winners from a preview", () => {
    expect(ceremony).toContain("disabled={idx > currentPhaseIndex}");
    expect(ceremony).toContain('setCurrentPhase("after_party")');
    expect(ceremony).toContain('currentPhase === "after_party"');
    expect(ceremony).toContain("Official winners appear in Awards History");
    expect(ceremony).toContain("await onBookPerformance(slot.label, slot.stage)");
  });
});
