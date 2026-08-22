import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("simplified Festival company home", () => {
  it("shows the permanent company state required by the simplified product contract", () => {
    const home = source(
      "src/features/festivals/ui/CanonicalFestivalRoutes.tsx",
    );

    expect(home).toContain("getFestivalCompanyUpgrades");
    expect(home).toContain("festivalCompanyEditionsQueryKey");
    expect(home).toContain("currentReputation");
    expect(home).toContain('title="Festival licence"');
    expect(home).toContain("Licence progression");
    expect(home).toContain("Current annual Festival");
  });

  it("provides a direct continue action for the active annual Festival", () => {
    const home = source(
      "src/features/festivals/ui/CanonicalFestivalRoutes.tsx",
    );

    expect(home).toContain("currentAnnualFestival.festivalEditionId");
    expect(home).toContain("festivalRoutes.edition(");
    expect(home).toContain("Continue Festival");
    expect(home).toContain("Plan next annual Festival");
  });

  it("keeps annual Festival management on the five-screen simplified loop", () => {
    const home = source(
      "src/features/festivals/ui/CanonicalFestivalRoutes.tsx",
    );

    expect(home).toContain('{ section: "overview", label: "Plan" }');
    expect(home).toContain('{ section: "applications", label: "Line-up" }');
    expect(home).toContain('{ section: "finance", label: "Tickets & budget" }');
    expect(home).toContain('{ section: "live", label: "Run Festival" }');
    expect(home).toContain('{ section: "history", label: "Results" }');
  });
});
