import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Festival owner experience", () => {
  const upgrades = source(
    "src/features/festival-company/upgrades/FestivalUpgradeWorkspace.tsx",
  );
  const live = source(
    "src/features/festivals/runtime/FestivalLiveControlRoom.tsx",
  );

  it("groups the detailed upgrade catalogue into four player-facing areas", () => {
    for (const label of [
      "Venue & infrastructure",
      "Production & safety",
      "Commercial & marketing",
      "Audience experience",
    ]) {
      expect(upgrades).toContain(label);
    }

    for (const key of [
      "site_infrastructure",
      "stages_production",
      "security_crowd_control",
      "medical_welfare",
      "sanitation_utilities",
      "artist_backstage",
      "audience_facilities",
      "camping_accommodation",
      "transport_access",
      "marketing_media",
      "sustainability_technology",
    ]) {
      expect(upgrades).toContain(key);
    }
  });

  it("keeps authoritative upgrade and licence mutations", () => {
    expect(upgrades).toContain("previewFestivalUpgrade");
    expect(upgrades).toContain("purchaseFestivalUpgrade");
    expect(upgrades).toContain("applyFestivalCompanyLicence");
    expect(upgrades).toContain("idempotencyKey: crypto.randomUUID()");
  });

  it("presents runtime data as Festival Day instead of a simulation report", () => {
    expect(live).toContain("FESTIVAL DAY");
    expect(live).toContain("Stages now");
    expect(live).toContain("Festival timeline");
    expect(live).toContain("Incidents & pressure points");
    expect(live).toContain("runtime.recentEvents");
    expect(live).toContain("runtime.stages");
    expect(live).toContain("runtime.incidents");
    expect(live).toContain("runtime.gates.queueSize");
    expect(live).toContain("runtime.weather.condition");
  });

  it("retains the simplified one-action Festival launch boundary", () => {
    expect(live).toContain("getFestivalRunReadiness");
    expect(live).toContain("runSimplifiedFestival");
    expect(live).toContain("Open Festival gates");
    expect(live).not.toContain("prepareEditionRuntime(");
    expect(live).not.toContain("transitionEditionRuntime(");
  });
});
