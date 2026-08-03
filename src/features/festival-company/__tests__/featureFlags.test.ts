import { describe, it, expect } from "vitest";
import { resolveFestivalFeatureFlags } from "../config/featureFlags";

describe("festival feature flags", () => {
  it("defaults legacy read on and the replacement system on (Phase 11 activation)", () => {
    const flags = resolveFestivalFeatureFlags({
      legacyFestivalSystemEnabled: undefined,
      newFestivalSystemEnabled: undefined,
      festivalCreationEnabled: undefined,
      festivalApplicationsEnabled: undefined,
      festivalLivePerformanceEnabled: undefined,
    } as never);
    expect(flags.legacyFestivalSystemEnabled).toBe(true);
    expect(flags.legacyFestivalWriteEnabled).toBe(false);
    expect(flags.newFestivalSystemEnabled).toBe(true);
    expect(flags.festivalCreationEnabled).toBe(true);
    expect(flags.festivalApplicationsEnabled).toBe(true);
    expect(flags.festivalLivePerformanceEnabled).toBe(true);
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
