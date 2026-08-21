import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/mobile/pages/MobileMe.tsx", "utf8");
const home = readFileSync("src/mobile/pages/MobileHome.tsx", "utf8");
const wellness = readFileSync("src/hooks/useWellnessState.ts", "utf8");
const mobileLayout = readFileSync("src/mobile/shell/MobileLayout.tsx", "utf8");
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

  it("keeps truthful core vitals visible when optional wellness datasets fail", () => {
    expect(wellness).toContain("Promise.allSettled");
    expect(wellness).toContain("catalogError");
    expect(wellness).toContain("supplementalError");
    expect(source).toContain("Some wellness details are unavailable");
    expect(source).toContain("Recovery actions could not be loaded.");
  });

  it("refreshes both GameData and query-backed mobile resources", () => {
    expect(home).toContain("refetch: refetchGameData");
    expect(home).toContain("const refreshAll = async");
    expect(home).toContain("refetchGameData()");
    expect(home).toContain("wellness.refresh()");
    expect(home).toContain("refetchNotifications()");
    expect(home).toContain("qc.invalidateQueries()");
  });

  it("uses the same no-active-character boundary on direct mobile routes", () => {
    expect(mobileLayout).toContain("NoActiveCharacterGate");
    expect(mobileLayout).toContain("<NoActiveCharacterGate>");
    expect(mobileLayout).toContain("<CharacterGate>");
  });

  it("keeps direct Me links inside the mobile shell", () => {
    expect(app).toContain('path="/mobile" element={<MobileLayout />}');
    expect(app).toContain('path="me/:section" element={<MobileMe />}');
    expect(app).toContain('path="me/:section/:id" element={<MobileMe />}');
  });
});