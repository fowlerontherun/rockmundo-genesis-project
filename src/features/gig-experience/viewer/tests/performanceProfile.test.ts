import { describe, expect, it } from "vitest";
import { DEGRADATION_ORDER, crowdDrawStride, effectiveDevicePixelRatio, resolveRenderBudget } from "../engine/PerformanceProfile";

const base = { displayedCrowd: 400, devicePixelRatio: 3, archetype: "club" };

describe("resolveRenderBudget", () => {
  it("is deterministic for identical input", () => {
    expect(resolveRenderBudget({ tier: "standard", ...base })).toEqual(resolveRenderBudget({ tier: "standard", ...base }));
  });

  it("caps device pixel ratio by tier", () => {
    expect(effectiveDevicePixelRatio(resolveRenderBudget({ tier: "low", ...base }), 3)).toBe(1);
    expect(effectiveDevicePixelRatio(resolveRenderBudget({ tier: "high", ...base }), 3)).toBe(2);
    expect(effectiveDevicePixelRatio(resolveRenderBudget({ tier: "standard", ...base }), 1)).toBe(1);
  });

  it("drops ambient particles and background movers under reduced motion", () => {
    const budget = resolveRenderBudget({ tier: "high", ...base, reducedMotion: true });
    expect(budget.particles).toBe(0);
    expect(budget.backgroundMovers).toBe(0);
    expect(budget.appliedDegradations).toEqual(["ambient_particles", "background_movers"]);
  });

  it("sheds detail in the documented order as crowd pressure grows", () => {
    const light = resolveRenderBudget({ tier: "standard", ...base, displayedCrowd: 500 });
    const heavy = resolveRenderBudget({ tier: "standard", ...base, displayedCrowd: 3000 });
    const extreme = resolveRenderBudget({ tier: "standard", ...base, displayedCrowd: 9000, archetype: "stadium" });
    expect(light.appliedDegradations).toEqual([]);
    expect(light.crowdDetail).toBe("full");
    expect(heavy.appliedDegradations[0]).toBe("ambient_particles");
    expect(extreme.crowdDetail).toBe("aggregated");
    expect(extreme.appliedDegradations).toEqual(DEGRADATION_ORDER.filter((step) => extreme.appliedDegradations.includes(step)));
    expect(crowdDrawStride(extreme)).toBe(3);
    expect(crowdDrawStride(light)).toBe(1);
  });

  it("aggregates very large stadium crowds and caps dpr to 1", () => {
    const budget = resolveRenderBudget({ tier: "high", displayedCrowd: 12000, archetype: "stadium", devicePixelRatio: 3 });
    expect(budget.crowdDetail).toBe("aggregated");
    expect(budget.dprCap).toBe(1);
    expect(budget.serviceActors).toBeGreaterThanOrEqual(4);
  });
});
