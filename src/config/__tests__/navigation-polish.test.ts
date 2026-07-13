import { describe, expect, it } from "vitest";
import { FM_MODULES, findModuleForPath } from "../fmNavigation";
import { isHubNavigationItemActive } from "@/components/hub/HubLayout";
import { socialHubNavigation, worldHubNavigation } from "../hubNavigation";

const primaryModules = () => FM_MODULES.filter((module) => module.primary ?? true);
const socialItem = (id: string) => socialHubNavigation.find((entry) => entry.id === id)!;

describe("navigation polish regression coverage", () => {
  it("keeps the final primary navigation concise and permission-ready", () => {
    expect(primaryModules().map((module) => module.label)).toEqual([
      "Home",
      "Character",
      "Music",
      "Band",
      "Career",
      "Business",
      "World",
      "Social",
      "Schedule",
      "Admin",
    ]);
    expect(FM_MODULES.find((module) => module.id === "media")?.primary).toBe(false);
  });

  it("resolves each top-level hub to its stable landing route", () => {
    expect(FM_MODULES.find((module) => module.id === "overview")?.rootPath).toBe("/home");
    expect(FM_MODULES.find((module) => module.id === "character")?.rootPath).toBe("/character");
    expect(FM_MODULES.find((module) => module.id === "music")?.rootPath).toBe("/music");
    expect(FM_MODULES.find((module) => module.id === "band-live")?.rootPath).toBe("/band");
    expect(FM_MODULES.find((module) => module.id === "business")?.rootPath).toBe("/business");
    expect(FM_MODULES.find((module) => module.id === "world")?.rootPath).toBe("/world");
    expect(FM_MODULES.find((module) => module.id === "social")?.rootPath).toBe("/social");
    expect(FM_MODULES.find((module) => module.id === "schedule")?.rootPath).toBe("/schedule");
    expect(FM_MODULES.find((module) => module.id === "career")?.rootPath).toBe("/career");
    expect(FM_MODULES.find((module) => module.id === "admin")?.rootPath).toBe("/admin");
  });

  it("matches query-string legacy aliases without selecting the bare hub", () => {
    expect(isHubNavigationItemActive("/social?tab=friends", socialItem("friends"))).toBe(true);
    expect(isHubNavigationItemActive("/social", socialItem("friends"))).toBe(false);
    expect(isHubNavigationItemActive("/social?tab=messages", socialItem("messages"))).toBe(true);
    expect(isHubNavigationItemActive("/social?tab=discover&page=2", socialItem("players"))).toBe(true);
  });

  it("keeps similar route prefixes in the intended owning hub", () => {
    expect(findModuleForPath("/band-rankings").id).toBe("band-live");
    expect(findModuleForPath("/band").id).toBe("band-live");
    expect(findModuleForPath("/business/finances").id).toBe("business");
    expect(findModuleForPath("/world/current-city").id).toBe("world");
    expect(worldHubNavigation.find((entry) => entry.id === "current-city")?.label).toBe("Location");
  });
});
