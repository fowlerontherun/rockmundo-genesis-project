import { describe, expect, it } from "vitest";
import { representativeCrowdCount, REPRESENTATIVE_CROWD_MAX, REPRESENTATIVE_CROWD_MIN } from "../engine/RepresentativeCrowd";

describe("representative crowd", () => {
  it("derives deterministic bounded counts from gig data", () => { const input = { attendance: 18_000, capacity: 20_000, archetype: "arena" as const }; expect(representativeCrowdCount(input)).toBe(representativeCrowdCount(input)); expect(representativeCrowdCount(input)).toBeLessThanOrEqual(REPRESENTATIVE_CROWD_MAX); });
  it("enforces minimum and maximum caps", () => { expect(representativeCrowdCount({ attendance: 1, capacity: 10, archetype: "pub" })).toBe(REPRESENTATIVE_CROWD_MIN); expect(representativeCrowdCount({ attendance: 1_000_000, capacity: 1_000_000, archetype: "stadium" })).toBe(REPRESENTATIVE_CROWD_MAX); });
  it("provides archetype-specific safe fallbacks", () => { expect(representativeCrowdCount({ archetype: "pub" })).toBeLessThan(representativeCrowdCount({ archetype: "stadium" })); });
});
