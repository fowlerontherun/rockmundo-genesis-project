import { describe, expect, it } from "vitest";

import { FM_MODULES, findModuleForPath } from "../fmNavigation";

describe("character navigation defaults", () => {
  const character = FM_MODULES.find((module) => module.id === "character");

  it("uses Character Overview as the stable module landing route", () => {
    expect(character?.rootPath).toBe("/character");
    expect(character?.subTabs[0]).toMatchObject({ label: "Overview", path: "/character" });
  });

  it("keeps Wellness in the Character module without making it the default", () => {
    expect(findModuleForPath("/wellness").id).toBe("character");
    expect(character?.subTabs.some((tab) => tab.path === "/wellness")).toBe(true);
    expect(character?.rootPath).not.toBe("/wellness");
  });

  it("recognizes direct Character Overview URLs as Character navigation", () => {
    expect(findModuleForPath("/character").id).toBe("character");
    expect(findModuleForPath("/character/overview").id).toBe("character");
  });
});
