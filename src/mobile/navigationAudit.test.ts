import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveCompanionPath } from "./routeRegistry";

const careerRoutes = readFileSync("src/mobile/pages/MobileCareerRoutes.tsx", "utf8");
const careerOverview = readFileSync("src/mobile/pages/MobileCareer.tsx", "utf8");
const topBar = readFileSync("src/mobile/shell/TopAppBar.tsx", "utf8");
const shell = readFileSync("src/mobile/shell/MobileShell.tsx", "utf8");

describe("mobile navigation and page contracts", () => {
  it("renders a real Career overview instead of redirecting the route to itself", () => {
    expect(careerRoutes).toContain("return <MobileCareer />");
    expect(careerRoutes).not.toContain('if (!section) return <Navigate to="/mobile/career" replace />');
    expect(careerOverview).toContain("Career areas");
  });

  it("routes desktop Home separately from My Day schedule links", () => {
    expect(resolveCompanionPath("/home")).toBe("/mobile");
    expect(resolveCompanionPath("/dashboard")).toBe("/mobile");
    expect(resolveCompanionPath("/schedule/today")).toBe("/mobile?view=day");
  });

  it("keeps direct player links useful on mobile", () => {
    expect(resolveCompanionPath("/player/example-player")).toBe("/mobile/social/profile/example-player");
  });

  it("uses direct supported mobile destinations from the top app bar", () => {
    expect(topBar).toContain('navigate("/mobile/world/travel")');
    expect(topBar).toContain('navigate("/mobile/social/messages")');
    expect(topBar).toContain('navigate("/mobile/social/notifications")');
    expect(topBar).not.toContain('navigate("/inbox")');
  });

  it("shows useful titles for nested companion pages", () => {
    expect(topBar).toContain('"/mobile/world/travel": "Travel"');
    expect(topBar).toContain('"/mobile/social/messages": "Messages"');
    expect(topBar).toContain('"/mobile/me/wellness": "Wellness"');
  });

  it("resets scroll between pages and honors quick-action hash targets", () => {
    expect(shell).toContain("location.hash");
    expect(shell).toContain("scrollIntoView");
    expect(shell).toContain("window.scrollTo");
  });
});
