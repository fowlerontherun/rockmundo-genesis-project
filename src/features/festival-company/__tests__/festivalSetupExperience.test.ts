import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("simplified Festival company setup experience", () => {
  const wizard = source(
    "src/features/festival-company/ui/FestivalConfigurationWizard.tsx",
  );

  it("presents four owner-facing setup steps instead of the old six-screen flow", () => {
    for (const label of [
      "Festival identity",
      "Festival defaults",
      "First annual Festival",
      "Review & create",
    ]) {
      expect(wizard).toContain(`title: "${label}"`);
    }

    expect(wizard).toContain("Plan → Line-up → Tickets & budget → Run Festival → Results");
    expect(wizard).not.toContain("FestivalWizardProgress");
  });

  it("makes the permanent-company versus annual-event boundary explicit", () => {
    expect(wizard).toContain("permanent Festival company brand");
    expect(wizard).toContain("starting preferences for future annual Festivals");
    expect(wizard).toContain("This step only seeds your first annual Festival");
    expect(wizard).toContain("you will not return to this company setup wizard for yearly planning");
  });

  it("hands successful setup directly to the exact first annual Plan", () => {
    expect(wizard).toContain("Finish setup & open Plan");
    expect(wizard).toMatch(
      /complete && canonical\.festivalEditionId[\s\S]*festivalRoutes\.edition\([\s\S]*festivalCompanyId,[\s\S]*canonical\.festivalEditionId/,
    );
  });

  it("keeps authoritative load errors, retry and stale-write conflict handling", () => {
    expect(wizard).toContain("festivalConfigurationErrorMessage(query.error)");
    expect(wizard).toContain("query.refetch()");
    expect(wizard).toContain('error.code === "festival_configuration_stale"');
    expect(wizard).toContain("FestivalConflictAlert");
  });
});
