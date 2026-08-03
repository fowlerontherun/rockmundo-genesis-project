import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("simplified company-owned Festival owner flow", () => {
  it("keeps the annual owner navigation to five high-impact screens", () => {
    const routes = source(
      "src/features/festivals/ui/CanonicalFestivalRoutes.tsx",
    );

    expect(routes).toContain('{ section: "overview", label: "Plan" }');
    expect(routes).toContain(
      '{ section: "applications", label: "Line-up" }',
    );
    expect(routes).toContain(
      '{ section: "finance", label: "Tickets & budget" }',
    );
    expect(routes).toContain(
      '{ section: "live", label: "Run Festival" }',
    );
    expect(routes).toContain(
      '{ section: "history", label: "Results" }',
    );

    expect(routes).not.toMatch(/label: "Schedule"/);
    expect(routes).not.toMatch(/label: "Contracts"/);
    expect(routes).not.toMatch(/label: "Operations"/);
    expect(routes).not.toMatch(/label: "Settlement"/);
  });

  it("redirects retained detailed owner URLs instead of mounting their workspaces", () => {
    const routes = source(
      "src/features/festivals/ui/CanonicalFestivalRoutes.tsx",
    );

    expect(routes).toMatch(/case "schedule":\s*case "contracts":\s*case "operations":/s);
    expect(routes).toMatch(/case "settlement":[\s\S]*festivalRoutes\.live/);
    expect(routes).not.toContain("FestivalScheduleWorkspace");
    expect(routes).not.toContain("FestivalOperationsPlanner");
    expect(routes).not.toContain("FestivalSponsorshipPlanner");
    expect(routes).not.toContain("EditionSettlementWorkspace");
  });

  it("keeps company upgrades central and detailed operations automatic", () => {
    const sections = source(
      "src/features/festivals/ui/FestivalEditionSections.tsx",
    );
    const contract = source(
      "docs/festivals/FESTIVAL_COMPANY_SIMPLIFIED_PRODUCT_CONTRACT.md",
    );

    expect(sections).toContain("View eleven upgrades");
    expect(sections).toContain("Generated automatically by the game");
    expect(contract).toContain("A Festival is a **player-owned company type**");
    expect(contract).toContain("The existing categories remain the long-term company progression system");
    expect(contract).toContain("edit a minute-by-minute stage timetable");
    expect(contract).toContain("build staff departments or individual shifts");
    expect(contract).toContain("compare supplier tenders");
  });

  it("unlocks each simplified planner from the prior high-level choice", () => {
    const sections = source(
      "src/features/festivals/ui/FestivalEditionSections.tsx",
    );

    expect(sections).toMatch(
      /FestivalEditionApplications[\s\S]*requiredBindings=\{\["tickets"\]\}/,
    );
    expect(sections).toMatch(
      /FestivalEditionFinance[\s\S]*requiredBindings=\{\["site"\]\}/,
    );
    expect(sections).not.toContain('requiredBindings={["artists"]}');
    expect(sections).not.toContain(
      'requiredBindings={["site", "tickets"]}',
    );
  });
});
