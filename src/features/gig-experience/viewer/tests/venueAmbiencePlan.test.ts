import { describe, expect, it } from "vitest";
import { AMBIENCE_TOTAL_CEILING, isOutdoorVenue, resolveVenueAmbiencePlan } from "../engine/VenueAmbiencePlan";

const base = { archetype: "club", capacityBand: "club", servicePointCount: 3, songPhase: "performing", crowdEnergy: 60 } as const;

describe("resolveVenueAmbiencePlan", () => {
  it("is deterministic for identical input", () => {
    expect(resolveVenueAmbiencePlan({ ...base })).toEqual(resolveVenueAmbiencePlan({ ...base }));
  });

  it("always includes a venue bed and stays under the ceiling", () => {
    const plan = resolveVenueAmbiencePlan({ archetype: "stadium", capacityBand: "mega", servicePointCount: 24, songPhase: "waiting", crowdEnergy: 100, environmentKind: "coastal", atmosphere: "rainy" });
    expect(plan.buses.some((bus) => bus.id === "venue_bed")).toBe(true);
    expect(plan.totalLevel).toBeLessThanOrEqual(AMBIENCE_TOTAL_CEILING + 0.001);
  });

  it("ducks bar service during peaks and lifts it between songs", () => {
    const peak = resolveVenueAmbiencePlan({ ...base, songPhase: "peak" });
    const between = resolveVenueAmbiencePlan({ ...base, songPhase: "waiting" });
    const level = (p: ReturnType<typeof resolveVenueAmbiencePlan>) => p.buses.find((b) => b.id === "bar_chatter")?.level ?? 0;
    expect(level(peak)).toBeLessThan(level(between));
  });

  it("omits service buses when there are no stations", () => {
    const plan = resolveVenueAmbiencePlan({ ...base, servicePointCount: 0 });
    expect(plan.buses.map((bus) => bus.id)).toEqual(["venue_bed"]);
  });

  it("adds an outdoor bus only for outdoor scenes", () => {
    const indoor = resolveVenueAmbiencePlan({ ...base, environmentKind: "urban" });
    const outdoor = resolveVenueAmbiencePlan({ ...base, archetype: "festival", capacityBand: "mega", environmentKind: "coastal" });
    expect(indoor.buses.some((b) => b.id === "outdoor")).toBe(false);
    expect(outdoor.buses.some((b) => b.id === "outdoor")).toBe(true);
    expect(isOutdoorVenue({ archetype: "pub" })).toBe(false);
    expect(isOutdoorVenue({ archetype: "pub", indoor: false })).toBe(true);
  });

  it("flattens modulation under reduced motion without muting ambience", () => {
    const plan = resolveVenueAmbiencePlan({ ...base, reducedMotion: true });
    expect(plan.reducedMotion).toBe(true);
    expect(plan.buses.every((bus) => bus.modulation === 0)).toBe(true);
    expect(plan.totalLevel).toBeGreaterThan(0);
  });
});
