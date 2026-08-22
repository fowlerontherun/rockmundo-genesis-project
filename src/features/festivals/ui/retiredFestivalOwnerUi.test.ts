import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const retiredOwnerUi = [
  "src/features/festival-company/ui/FestivalCompanySetupPage.tsx",
  "src/features/festival-company/ui/FestivalSitePlanner.tsx",
  "src/features/festival-company/ui/FestivalOperationsPlanner.tsx",
  "src/features/festival-company/ui/FestivalSponsorshipPlanner.tsx",
  "src/features/festival-company/ui/FestivalTimetablePlanner.tsx",
  "src/features/festival-company/ui/FestivalLaunchManager.tsx",
  "src/features/festival-company/ui/PlanNextAnnualEdition.tsx",
];

describe("retired detailed Festival owner UI", () => {
  it("does not keep disconnected detailed owner planner components", () => {
    for (const path of retiredOwnerUi) {
      expect(existsSync(resolve(process.cwd(), path)), path).toBe(false);
    }
  });

  it("keeps detailed operational modules out of the Festival-company UI barrel", () => {
    const barrel = readFileSync(
      resolve(process.cwd(), "src/features/festival-company/index.ts"),
      "utf8",
    );

    for (const component of [
      "FestivalOperationsPlanner",
      "FestivalSponsorshipPlanner",
      "FestivalTimetablePlanner",
      "FestivalLaunchManager",
    ]) {
      expect(barrel).not.toContain(`./ui/${component}`);
    }

    expect(barrel).toContain("Detailed operations remain available to the server/domain layer");
  });
});
