import { describe, expect, it } from "vitest";

import { worldHubNavigation } from "../hubNavigation";
import { FM_MODULES, findModuleForPath } from "../fmNavigation";
import { isHubNavigationItemActive } from "@/components/hub/HubLayout";

describe("world navigation consolidation", () => {
  const world = FM_MODULES.find((module) => module.id === "world");

  it("uses World Overview as the stable module landing route", () => {
    expect(world?.rootPath).toBe("/world");
    expect(world?.subTabs[0]).toMatchObject({ label: "Overview", path: "/world" });
  });

  it("recognizes canonical world child routes and legacy aliases", () => {
    expect(findModuleForPath("/world/travel").id).toBe("world");
    expect(findModuleForPath("/travel?destination=london").id).toBe("world");
    expect(findModuleForPath("/world/cities/london").id).toBe("world");
    expect(findModuleForPath("/festivals/festival-1").id).toBe("world");
  });

  it("selects logical child items for entity and legacy routes", () => {
    const cities = worldHubNavigation.find((item) => item.id === "cities")!;
    const festivals = worldHubNavigation.find((item) => item.id === "festivals")!;
    const companies = worldHubNavigation.find((item) => item.id === "companies")!;

    expect(isHubNavigationItemActive("/cities/london?tab=venues", cities)).toBe(true);
    expect(isHubNavigationItemActive("/festivals/festival-1", festivals)).toBe(true);
    expect(isHubNavigationItemActive("/company/company-1", companies)).toBe(true);
  });
});
