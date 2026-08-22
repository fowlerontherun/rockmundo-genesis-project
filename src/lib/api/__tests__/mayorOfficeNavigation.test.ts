import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const moduleTabs = readFileSync("src/components/fm/ModuleTabs.tsx", "utf8");
const sidebar = readFileSync("src/components/fm/FMSidebar.tsx", "utf8");
const subTabs = readFileSync("src/components/fm/SubTabs.tsx", "utf8");
const mayorPage = readFileSync("src/pages/MayorDashboard.tsx", "utf8");
const mayorNav = readFileSync("src/config/mayorOfficeNavigation.ts", "utf8");

describe("Mayor's Office navigation", () => {
  it("surfaces City Hall only when a current mayor office exists", () => {
    expect(moduleTabs).toContain("useCurrentMayorOffice");
    expect(moduleTabs).toContain("if (!mayorOffice) return null");
    expect(moduleTabs).toContain("MAYOR_OFFICE_MODULE_LABEL");
  });

  it("turns the existing mayor route into a dedicated shell", () => {
    expect(mayorNav).toContain('MAYOR_OFFICE_ROUTE = "/cities/:cityId/mayor-dashboard"');
    expect(sidebar).toContain("MAYOR_OFFICE_SIDEBAR");
    expect(subTabs).toContain("MAYOR_OFFICE_TABS");
    expect(sidebar).toContain("MAYOR_OFFICE_MODULE_LABEL");
  });

  it("provides the complete City Hall management areas", () => {
    for (const section of [
      "overview",
      "treasury",
      "projects",
      "laws",
      "services",
      "opinion",
      "promises",
      "communications",
      "elections",
      "history",
    ]) {
      expect(mayorNav).toContain(`"${section}"`);
    }
  });

  it("routes the Mayor Dashboard through the dedicated management components", () => {
    for (const component of [
      "MayorOfficeOverview",
      "MayorBudgetTab",
      "MayorProjectsTab",
      "MayorLawPolicyEditor",
      "MayorCityServicesTab",
      "MayorPublicOpinionTab",
      "MayorPromiseTracker",
      "MayorPublicRelationsTab",
      "MayorElectionTermTab",
      "MayorHistoryTab",
    ]) {
      expect(mayorPage).toContain(component);
    }
  });

  it("keeps the existing city-specific access gate", () => {
    expect(mayorPage).toContain("useIsCurrentMayor(cityId)");
    expect(mayorPage).toContain("Mayor access required");
  });
});
