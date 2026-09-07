import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("simplified Festival company setup experience", () => {
  const wizard = source(
    "src/features/festival-company/ui/FestivalConfigurationWizard.tsx",
  );

  it("reduces founding to four high-impact choices", () => {
    for (const label of [
      "Festival name",
      "Home city",
      "Starting size",
      "First Festival date",
    ]) {
      expect(wizard).toContain(label);
    }

    expect(wizard).toContain("Start the Festival company with four decisions");
    expect(wizard).not.toContain("compactSteps");
    expect(wizard).not.toContain("Festival defaults");
  });

  it("derives technical defaults instead of asking the player twice", () => {
    expect(wizard).toContain('configuration.vibe ?? "community"');
    expect(wizard).toContain('configuration.siteType ?? "outdoor"');
    expect(wizard).toContain('"standard"');
    expect(wizard).toContain("annualMonth");
    expect(wizard).toContain("plannedEndDate: addDays");
  });

  it("hands successful setup directly to the exact first annual Plan", () => {
    expect(wizard).toContain("Create Festival & start planning");
    expect(wizard).toMatch(
      /canonical\.festivalEditionId[\s\S]*festivalRoutes\.edition\([\s\S]*festivalCompanyId,[\s\S]*canonical\.festivalEditionId/,
    );
  });

  it("keeps authoritative load errors and retry handling", () => {
    expect(wizard).toContain("festivalConfigurationErrorMessage(query.error)");
    expect(wizard).toContain("query.refetch()");
    expect(wizard).toContain("festivalConfigurationErrorMessage(save.error)");
  });
});
