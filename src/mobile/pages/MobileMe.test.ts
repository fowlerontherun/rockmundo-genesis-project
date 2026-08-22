import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/mobile/pages/MobileMe.tsx", "utf8");
const home = readFileSync("src/mobile/pages/MobileHome.tsx", "utf8");
const wellness = readFileSync("src/hooks/useWellnessState.ts", "utf8");
const wellnessApi = readFileSync("src/lib/api/wellnessActivities.ts", "utf8");
const mobileLayout = readFileSync("src/mobile/shell/MobileLayout.tsx", "utf8");
const activityBar = readFileSync("src/mobile/shell/MobileActivityBar.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

describe("mobile Me companion contract", () => {
  it("keeps overview and wellness as the only functional personal mobile surfaces", () => {
    expect(source).toContain('section === "wellness"');
    expect(source).toContain("DESKTOP_ONLY");
    for (const section of ["inventory", "wardrobe", "skills", "education", "achievements", "settings"]) expect(source).toContain(section);
  });

  it("uses one authoritative mobile day schedule and wellness state instead of fake defaults", () => {
    expect(source).toContain("useMobileDaySchedule");
    expect(home).toContain("useMobileDaySchedule");
    expect(activityBar).toContain("useMobileDaySchedule");
    expect(source).toContain("useWellnessState");
    expect(source).not.toContain("80);");
    expect(source).not.toContain("70);");
    expect(source).not.toContain("85);");
    expect(home).toContain("useWellnessState");
    expect(home).toContain("resolveCompanionPath");
    expect(home).toContain("No placeholder values are shown");
  });

  it("uses the canonical active profile on the dedicated wellness route", () => {
    expect(source).toContain("const { profileId } = useActiveProfile();");
    expect(source).toContain("const state = useWellnessState(profileId ?? null);");
    expect(source).not.toContain("useWellnessState(profile?.id ?? null)");
  });

  it("does not depend on wellness compatibility objects absent from repository migrations", () => {
    expect(wellnessApi).toContain('.from("wellness_activity_log" as any)');
    expect(wellnessApi).toContain("const ailments = await listActiveAilments(profileId)");
    expect(wellnessApi).not.toContain('.from("wellness_cooldowns_view"');
    expect(wellnessApi).not.toContain('.from("wellness_blocks"');
  });

  it("does not claim the character is available when the core day schedule is unavailable", () => {
    expect(source).toContain("coreScheduleAvailable");
    expect(source).toContain("Status uncertain");
    expect(source).toContain("mobile cannot safely say that you are free");
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
