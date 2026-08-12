import { describe, expect, it } from "vitest";
import { ENVIRONMENT_REGISTRY, resolveEnvironment } from "../engine/EnvironmentRegistry";

const resolve = (overrides: Partial<Parameters<typeof resolveEnvironment>[0]> = {}) => resolveEnvironment({ gigId: "gig-1", venueArchetype: "club", ...overrides });
describe("venue environment resolution", () => {
  it("supports every required typed profile", () => { expect(Object.keys(ENVIRONMENT_REGISTRY)).toEqual(expect.arrayContaining(["urban", "industrial", "riverside", "coastal", "beach", "countryside", "historic", "tropical", "desert", "alpine", "generic"])); });
  it("normalises known cities and aliases", () => { expect(resolve({ city: "Manchester, UK" }).profile.kind).toBe("industrial"); expect(resolve({ city: "RIO-DE-JANEIRO" }).profile.kind).toBe("tropical"); expect(resolve({ city: "Liverpool" }).profile.kind).toBe("riverside"); });
  it("uses explicit classification first and safely falls back", () => { expect(resolve({ environment: "Historic City", city: "Manchester" }).profile.kind).toBe("historic"); expect(resolve({ city: "Unknown Place" }).profile.kind).toBe("generic"); });
  it("forces beach compatibility and is stable for rerenders and resize-independent", () => { const input = { gigId: "beach-gig", venueArchetype: "beach" as const, city: "London" }; expect(resolveEnvironment(input)).toEqual(resolveEnvironment(input)); expect(resolveEnvironment(input).profile.kind).toBe("beach"); });
  it("allows different gigs to select valid stable variations", () => { const values = new Set(Array.from({ length: 12 }, (_, i) => resolve({ gigId: `gig-${i}`, city: "London" }).variation)); expect(values.size).toBeGreaterThan(1); });
});
