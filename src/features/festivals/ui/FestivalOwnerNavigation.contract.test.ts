import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Festival owner management navigation", () => {
  it("keeps one persistent company-management strip across owner surfaces", () => {
    const navigation = source("src/features/festivals/ui/FestivalOwnerNavigation.tsx");
    const routes = source("src/features/festivals/ui/CanonicalFestivalRoutes.tsx");
    const editions = source("src/features/festivals/editions/FestivalCompanyEditionsPage.tsx");
    const upgrades = source("src/features/festival-company/upgrades/FestivalUpgradeWorkspace.tsx");

    for (const label of [
      "Overview",
      "Current Festival",
      "Upgrades & licence",
      "Festival history",
      "Company finances",
    ]) {
      expect(navigation).toContain(label);
    }

    expect(routes.match(/<FestivalOwnerNavigation/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(editions).toContain("<FestivalOwnerNavigation");
    expect(upgrades).toContain("<FestivalOwnerNavigation");
    expect(editions).toContain("Continue Festival");
    expect(editions).toContain('id="festival-history"');
  });

  it("never treats a historical result as the current editable Festival", () => {
    const navigation = source("src/features/festivals/ui/FestivalOwnerNavigation.tsx");
    expect(navigation).toContain("currentEditionIsEditable");
    expect(navigation).toContain("edition.editable && edition.festivalEditionId === currentEditionId");
  });
});
