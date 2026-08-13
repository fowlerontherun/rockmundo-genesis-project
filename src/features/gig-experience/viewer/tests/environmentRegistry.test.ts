import { describe, expect, it } from "vitest";
import {
  ENVIRONMENT_REGISTRY,
  resolveEnvironment,
  resolveGigEnvironment,
} from "../engine/EnvironmentRegistry";

const resolve = (overrides: Partial<Parameters<typeof resolveEnvironment>[0]> = {}) => resolveEnvironment({
  gigId: "gig-1",
  venueArchetype: "club",
  ...overrides,
});

describe("venue environment resolution", () => {
  it("supports every required typed profile", () => {
    expect(Object.keys(ENVIRONMENT_REGISTRY)).toEqual(expect.arrayContaining([
      "urban",
      "industrial",
      "riverside",
      "coastal",
      "beach",
      "countryside",
      "historic",
      "tropical",
      "desert",
      "alpine",
      "generic",
    ]));
  });

  it("normalises known RockMundo cities and aliases", () => {
    expect(resolve({ city: "Manchester, UK" }).profile.kind).toBe("industrial");
    expect(resolve({ city: "RIO-DE-JANEIRO" }).profile.kind).toBe("tropical");
    expect(resolve({ city: "Liverpool" }).profile.kind).toBe("riverside");
    expect(resolve({ city: "Edinburgh" }).profile.kind).toBe("historic");
    expect(resolve({ city: "Los Angeles, USA" }).profile.kind).toBe("coastal");
  });

  it("uses explicit classification before city and safely falls back", () => {
    expect(resolve({ environment: "Historic City", city: "Manchester" }).profile.kind).toBe("historic");
    expect(resolve({ city: "Unknown Place" }).profile.kind).toBe("generic");
  });

  it("uses climate, coastal, region, and country metadata for uncatalogued cities", () => {
    expect(resolve({ city: "Unknown", climateType: "arid", isCoastal: true }).profile.kind).toBe("desert");
    expect(resolve({ city: "Unknown", climateType: "oceanic", isCoastal: true }).profile.kind).toBe("coastal");
    expect(resolve({ city: "Unknown", region: "Mountain district" }).profile.kind).toBe("alpine");
    expect(resolve({ city: "Unknown", country: "Jamaica" }).profile.kind).toBe("tropical");
  });

  it("consumes linked city metadata through the real-gig environment adapter", () => {
    const environment = resolveGigEnvironment({
      gigId: "gig-city",
      scheduledDate: "2026-08-10T20:00:00Z",
      venueArchetype: "club",
      venue: {
        type: "club",
        location: "Legacy free text",
        city: {
          name: "Bangkok",
          country: "Thailand",
          region: "Central Thailand",
          climateType: "tropical",
          isCoastal: false,
          timezone: "Asia/Bangkok",
        },
      },
    });

    expect(environment.profile.kind).toBe("tropical");
    expect(environment.timeOfDay).toBe("night");
  });

  it("uses the venue time zone for scheduled local time and a deterministic UTC fallback", () => {
    const scheduledDate = "2026-08-10T20:00:00Z";
    expect(resolve({ scheduledDate, timeZone: "America/Los_Angeles" }).timeOfDay).toBe("day");
    expect(resolve({ scheduledDate, timeZone: "Europe/London" }).timeOfDay).toBe("night");
    expect(resolve({ scheduledDate, timeZone: "Invalid/Legacy" }).timeOfDay).toBe("sunset");
  });

  it("selects only climate-compatible static atmospheres", () => {
    const values = Array.from({ length: 20 }, (_, index) => resolve({
      gigId: `arid-gig-${index}`,
      city: "Unknown",
      climateType: "arid",
    }));
    expect(values.every((value) => value.profile.kind === "desert")).toBe(true);
    expect(values.every((value) => ["clear", "cloudy", "hazy"].includes(value.atmosphere))).toBe(true);
  });

  it("forces beach compatibility and is stable for rerenders and resize-independent", () => {
    const input = { gigId: "beach-gig", venueArchetype: "beach" as const, city: "London" };
    expect(resolveEnvironment(input)).toEqual(resolveEnvironment(input));
    expect(resolveEnvironment(input).profile.kind).toBe("beach");
  });

  it("allows different gigs to select valid stable variations", () => {
    const values = new Set(Array.from({ length: 12 }, (_, index) => resolve({
      gigId: `gig-${index}`,
      city: "London",
    }).variation));
    expect(values.size).toBeGreaterThan(1);
  });
});
