import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/mobile/pages/MobileMe.tsx", "utf8");
const home = readFileSync("src/mobile/pages/MobileHome.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

describe("mobile Me companion contract", () => {
  it("keeps overview and wellness as the only functional personal mobile surfaces", () => {
    expect(source).toContain('section === "wellness"');
    expect(source).toContain("DESKTOP_ONLY");
    for (const section of ["inventory", "wardrobe", "skills", "education", "achievements", "settings"]) expect(source).toContain(section);
  });

  it("uses authoritative schedule and wellness state instead of fake mobile defaults", () => {
    expect(source).toContain("useScheduledActivities");
    expect(source).toContain("useWellnessState");
    expect(source).not.toContain("80);");
    expect(source).not.toContain("70);");
    expect(source).not.toContain("85);");
    expect(home).toContain("useWellnessState");
    expect(home).toContain("resolveCompanionPath");
    expect(home).toContain("No placeholder values are shown");
  });

  it("keeps direct Me links inside the mobile shell", () => {
    expect(app).toContain('path="/mobile" element={<MobileLayout />}');
    expect(app).toContain('path="me/:section" element={<MobileMe />}');
    expect(app).toContain('path="me/:section/:id" element={<MobileMe />}');
  });
});
