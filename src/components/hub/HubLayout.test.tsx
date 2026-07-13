import { describe, expect, it } from "vitest";
import { isHubNavItemActive, type HubNavItem } from "./HubLayout";

describe("hub navigation matching", () => {
  const characterWellness: HubNavItem = {
    id: "wellness",
    label: "Wellness",
    path: "/character/wellness",
    matchPaths: ["/wellness"],
  };

  it("matches exact child routes and nested child routes", () => {
    expect(isHubNavItemActive("/character/wellness", characterWellness)).toBe(true);
    expect(isHubNavItemActive("/character/wellness/recovery", characterWellness)).toBe(true);
  });

  it("normalizes query-free paths and trailing slashes", () => {
    expect(isHubNavItemActive("/character/wellness/", characterWellness)).toBe(true);
  });

  it("supports legacy alias paths without selecting unrelated items", () => {
    expect(isHubNavItemActive("/wellness", characterWellness)).toBe(true);
    expect(isHubNavItemActive("/wellness-plan", characterWellness)).toBe(false);
    expect(isHubNavItemActive("/character/skills", characterWellness)).toBe(false);
  });

  it("keeps overview routes exact unless a nested route is under the base", () => {
    const overview: HubNavItem = { id: "overview", label: "Overview", path: "/character", matchPaths: ["/hub/character"], end: true };
    expect(isHubNavItemActive("/character", overview)).toBe(true);
    expect(isHubNavItemActive("/character/skills", overview)).toBe(false);
    expect(isHubNavItemActive("/characters", overview)).toBe(false);
  });
});
