import { describe, expect, it } from "vitest";
import { resolveTutorialRoute } from "./tutorialRoutes";

describe("resolveTutorialRoute", () => {
  it.each([
    ["/band/rehearsals", "/rehearsals"],
    ["/skill-tree", "/skills"],
    ["/equipment", "/gear-shop"],
    ["/merch", "/merchandise"],
    ["/tours", "/tour-manager"],
    ["/charts", "/music/charts"],
  ])("maps legacy tutorial route %s to %s", (legacyRoute, currentRoute) => {
    expect(resolveTutorialRoute(legacyRoute)).toBe(currentRoute);
  });

  it("leaves current routes unchanged", () => {
    expect(resolveTutorialRoute("/education")).toBe("/education");
    expect(resolveTutorialRoute("/world-map")).toBe("/world-map");
  });

  it("returns null when a tutorial step has no route", () => {
    expect(resolveTutorialRoute(null)).toBeNull();
    expect(resolveTutorialRoute(undefined)).toBeNull();
  });
});
