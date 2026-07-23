import { describe, it, expect } from "vitest";
import { resolveFestivalFeatureFlags } from "../config/featureFlags";

describe("festival feature flags", () => {
  it("defaults legacy on and new off", () => {
    const flags = resolveFestivalFeatureFlags({
      legacyFestivalSystemEnabled: undefined,
      newFestivalSystemEnabled: undefined,
      festivalCreationEnabled: undefined,
      festivalApplicationsEnabled: undefined,
      festivalLivePerformanceEnabled: undefined,
    } as never);
    expect(flags.legacyFestivalSystemEnabled).toBe(true);
    expect(flags.newFestivalSystemEnabled).toBe(false);
    expect(flags.festivalCreationEnabled).toBe(false);
    expect(flags.festivalApplicationsEnabled).toBe(false);
    expect(flags.festivalLivePerformanceEnabled).toBe(false);
  });

  it("respects explicit overrides", () => {
    const flags = resolveFestivalFeatureFlags({
      legacyFestivalSystemEnabled: false,
      newFestivalSystemEnabled: true,
      festivalCreationEnabled: true,
    });
    expect(flags.legacyFestivalSystemEnabled).toBe(false);
    expect(flags.newFestivalSystemEnabled).toBe(true);
    expect(flags.festivalCreationEnabled).toBe(true);
  });
});
