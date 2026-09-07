import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Festival experience simplification", () => {
  const annualPlan = source(
    "src/features/festivals/annual-plan/FestivalAnnualPlan.tsx",
  );
  const lineup = source(
    "src/features/festival-company/ui/FestivalLineupWorkflowManager.tsx",
  );

  it("keeps annual planning focused on four player decisions", () => {
    for (const label of ["When & where", "Festival", "Promotion", "Values"]) {
      expect(annualPlan).toContain(label);
    }

    expect(annualPlan).toContain("What these choices mean");
    expect(annualPlan).toContain("Festival countdown");
    expect(annualPlan).toContain("operational detail are generated automatically");
  });

  it("shows the line-up as a Festival bill before workflow administration", () => {
    expect(lineup).toContain("Annual Festival bill");
    expect(lineup).toContain("Headliners");
    expect(lineup).toContain("HEADLINER REQUIRED");
    expect(lineup).toContain("SimplifiedFestivalLineupManager");
  });
});
