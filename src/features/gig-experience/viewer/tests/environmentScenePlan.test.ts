import { describe, expect, it } from "vitest";
import { resolveEnvironment } from "../engine/EnvironmentRegistry";
import { buildEnvironmentScenePlan } from "../engine/EnvironmentScenePlan";
import type { VenueArchetype } from "../engine/VenueSceneRegistry";

const plan = (city: string, venueArchetype: VenueArchetype = "club", reducedMotion = false) => buildEnvironmentScenePlan({
  environment: resolveEnvironment({ gigId: "gig-env", venueArchetype, city, scheduledDate: "2026-08-16T21:30:00Z" }),
  venueArchetype,
  reducedMotion,
});

describe("environment scene packs", () => {
  it("is deterministic for identical inputs", () => {
    expect(JSON.stringify(plan("Manchester"))).toEqual(JSON.stringify(plan("Manchester")));
  });

  it("distinguishes profiles by skyline and vegetation", () => {
    expect(plan("Manchester").skyline).toBe("brick");
    expect(plan("London").skyline).toBe("tower");
    expect(plan("Prague").skyline).toBe("roofline");
    expect(plan("Zurich").vegetation[0]?.kind).toBe("conifer");
    expect(plan("Dubai").vegetation[0]?.kind).toBe("scrub");
  });

  it("only allows boats where the profile has water", () => {
    expect(plan("Liverpool").movers.some((mover) => mover.kind === "boat")).toBe(true);
    expect(plan("Dubai").movers.some((mover) => mover.kind === "boat")).toBe(false);
    expect(plan("Liverpool").hasWater).toBe(true);
    expect(plan("Manchester").hasWater).toBe(false);
  });

  it("shows stars at night and none during the day", () => {
    const night = plan("London");
    expect(night.starField.length).toBeGreaterThan(0);
    const day = buildEnvironmentScenePlan({
      environment: resolveEnvironment({ gigId: "gig-env", venueArchetype: "club", city: "London", scheduledDate: "2026-08-16T12:00:00Z" }),
      venueArchetype: "club",
    });
    expect(day.starField).toHaveLength(0);
  });

  it("spends no motion budget under reduced motion", () => {
    const reduced = plan("Brighton", "beach", true);
    expect(reduced.motionBudget).toBe(0);
    expect(reduced.movers).toHaveLength(0);
    expect(reduced.particles).toHaveLength(0);
    expect(reduced.buildings.length).toBeGreaterThan(0);
  });
});
