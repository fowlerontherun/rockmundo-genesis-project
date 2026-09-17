import { describe, expect, it } from "vitest";
import { totpAudienceChoreography, totpAudienceCrowdTuning, totpAudienceReactionLabel } from "./studioAudience";

describe("Top of the Pops studio audience", () => {
  it("maps reaction scores to readable broadcast labels", () => {
    expect(totpAudienceReactionLabel(-3)).toBe("Nervous");
    expect(totpAudienceReactionLabel(0)).toBe("Settled");
    expect(totpAudienceReactionLabel(3)).toBe("Warm");
    expect(totpAudienceReactionLabel(5)).toBe("Loud");
    expect(totpAudienceReactionLabel(8)).toBe("Roaring");
  });

  it("maps the locked reaction into television-only choreography", () => {
    expect(totpAudienceChoreography(-3)).toBe("tv_nervous");
    expect(totpAudienceChoreography(0)).toBe("tv_settled");
    expect(totpAudienceChoreography(3)).toBe("tv_warm");
    expect(totpAudienceChoreography(5)).toBe("tv_loud");
    expect(totpAudienceChoreography(8)).toBe("tv_roaring");
  });

  it("makes a roaring studio visually denser and closer than a nervous one", () => {
    const nervous = totpAudienceCrowdTuning(-5);
    const roaring = totpAudienceCrowdTuning(8);

    expect(roaring.densityMultiplier).toBeGreaterThan(nervous.densityMultiplier!);
    expect(roaring.stagePull).toBeGreaterThan(nervous.stagePull!);
    expect(roaring.arrivalSpeed).toBeGreaterThan(nervous.arrivalSpeed!);
    expect(roaring.depthSpread).toBeLessThan(nervous.depthSpread!);
  });
});
