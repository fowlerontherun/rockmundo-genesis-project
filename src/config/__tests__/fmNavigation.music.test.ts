import { describe, expect, it } from "vitest";

import { musicHubNavigation } from "../hubNavigation";
import { FM_MODULES, findModuleForPath } from "../fmNavigation";
import { isHubNavigationItemActive } from "@/components/hub/HubLayout";

describe("music navigation consolidation", () => {
  const music = FM_MODULES.find((module) => module.id === "music");

  it("uses Music Overview as the stable module landing route", () => {
    expect(music?.rootPath).toBe("/music");
    expect(music?.subTabs[0]).toMatchObject({ label: "Overview", path: "/music" });
  });

  it("recognizes canonical music child routes and legacy aliases", () => {
    expect(findModuleForPath("/music/songwriting").id).toBe("music");
    expect(findModuleForPath("/songwriting").id).toBe("music");
    expect(findModuleForPath("/music/recording").id).toBe("music");
    expect(findModuleForPath("/release/abc123").id).toBe("music");
  });

  it("selects logical child items for entity and legacy routes", () => {
    const releases = musicHubNavigation.find((item) => item.id === "releases")!;
    const songs = musicHubNavigation.find((item) => item.id === "songs")!;

    expect(isHubNavigationItemActive("/release/abc123?from=notification", releases)).toBe(true);
    expect(isHubNavigationItemActive("/song/abc123", songs)).toBe(true);
  });
});
