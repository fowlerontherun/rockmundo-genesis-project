import { describe, expect, it } from "vitest";
import { festivalAtmosphere, festivalSeasonAt, seasonalFestivalWeather } from "./festivalSeasonalAtmosphere";

describe("edition seasonal atmosphere", () => {
  it.each([
    ["2026-01-01T00:00:00Z", "winter"],
    ["2026-01-21T00:00:00Z", "spring"],
    ["2026-02-20T00:00:00Z", "summer"],
    ["2026-03-22T00:00:00Z", "autumn"],
    ["2026-05-01T00:00:00Z", "winter"],
  ])("uses the edition date %s on the 120-day game calendar", (timestamp, season) => {
    expect(festivalSeasonAt(timestamp)?.season).toBe(season);
  });
  it("does not invent a season for invalid dates", () => {
    expect(festivalSeasonAt("invalid")).toBeNull();
  });
  it("keeps shared city/day weather deterministic regardless of edition or stage", () => {
    const probabilities = { sunny: 50, rainy: 50 };
    const first = seasonalFestivalWeather("city:1:6:150", probabilities, 18);
    expect(first).toEqual(seasonalFestivalWeather("city:1:6:150", { rainy: 50, sunny: 50 }, 18));
    expect(first?.temperature).toBeGreaterThanOrEqual(15);
    expect(first?.temperature).toBeLessThanOrEqual(21);
  });
  it("does not fabricate clear weather when climate data is absent or invalid", () => {
    expect(seasonalFestivalWeather("city", null, 20)).toBeNull();
    expect(seasonalFestivalWeather("city", { sunny: -1, rainy: NaN }, 20)).toBeNull();
    expect(seasonalFestivalWeather("city", { sunny: 1 }, null)).toBeNull();
    expect(festivalAtmosphere("winter", null, null, null)).toMatchObject({ source: "scenery", condition: null, ground: "grass" });
  });
  it("uses actual city snow probabilities, not winter alone, for snow", () => {
    const snow = seasonalFestivalWeather("city", { snowy: 1 }, -2);
    expect(festivalAtmosphere("winter", snow, null, null)).toMatchObject({ condition: "snowy", ground: "snow" });
    expect(festivalAtmosphere("winter", { condition: "sunny", temperature: 22 }, null, null).ground).toBe("grass");
  });
  it("gives authoritative runtime weather priority without passing estimated temperature as a fact", () => {
    expect(festivalAtmosphere("summer", { condition: "sunny", temperature: 22 }, "heavy_rain", "muddy"))
      .toEqual({ season: "summer", condition: "rainy", temperature: null, source: "runtime", ground: "mud" });
  });
  it("does not turn cold alone into invented snowfall", () => {
    expect(festivalAtmosphere("winter", { condition: "snowy", temperature: -2 }, "cold", "dry"))
      .toMatchObject({ condition: "cloudy", ground: "grass" });
  });
});