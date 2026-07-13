import { describe, expect, it } from "vitest";
import { isHubNavigationItemActive } from "@/components/hub/HubLayout";
import { businessHubNavigation, careerHubNavigation } from "../hubNavigation";
import { FM_MODULES, findModuleForPath } from "../fmNavigation";

const businessItem = (id: string) => businessHubNavigation.find((entry) => entry.id === id)!;
const careerItem = (id: string) => careerHubNavigation.find((entry) => entry.id === id)!;

describe("business and career hub navigation", () => {
  it("uses stable Business and Career overview landing routes", () => {
    expect(FM_MODULES.find((module) => module.id === "business")?.rootPath).toBe("/business");
    expect(FM_MODULES.find((module) => module.id === "career")?.rootPath).toBe("/career");
    expect(isHubNavigationItemActive("/business", businessItem("overview"))).toBe(true);
    expect(isHubNavigationItemActive("/career", careerItem("overview"))).toBe(true);
  });

  it("separates public company discovery from business management selection", () => {
    expect(findModuleForPath("/world/companies").id).toBe("world");
    expect(findModuleForPath("/company/company-1").id).toBe("business");
    expect(isHubNavigationItemActive("/world/companies", businessItem("companies"))).toBe(false);
    expect(isHubNavigationItemActive("/company/company-1", businessItem("staff"))).toBe(true);
  });

  it("selects business child routes and legacy management aliases", () => {
    expect(isHubNavigationItemActive("/business/companies?tab=all", businessItem("companies"))).toBe(true);
    expect(isHubNavigationItemActive("/my-companies", businessItem("companies"))).toBe(true);
    expect(isHubNavigationItemActive("/venue-business/venue-1", businessItem("staff"))).toBe(true);
    expect(isHubNavigationItemActive("/labels/label-1/manage", businessItem("labels"))).toBe(true);
  });

  it("selects career child routes and legacy progression aliases", () => {
    expect(isHubNavigationItemActive("/career/employment", careerItem("employment"))).toBe(true);
    expect(isHubNavigationItemActive("/employment?tab=current", careerItem("employment"))).toBe(true);
    expect(isHubNavigationItemActive("/awards", careerItem("awards"))).toBe(true);
    expect(isHubNavigationItemActive("/release-manager", careerItem("discography"))).toBe(true);
    expect(isHubNavigationItemActive("/legacy", careerItem("history"))).toBe(true);
  });
});
