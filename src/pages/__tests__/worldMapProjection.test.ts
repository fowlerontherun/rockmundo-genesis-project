import { describe, expect, it } from "bun:test";

import { projectCoordinates } from "../../utils/mapProjection";

const projectionConfig = { width: 1000, height: 500, padding: 50 } as const;

describe("projectCoordinates", () => {
  it("places the prime meridian and equator near the center of the map", () => {
    const { x, y } = projectCoordinates({ lat: 0, lng: 0 }, projectionConfig);

    expect(Math.round(x)).toBe(500);
    expect(Math.round(y)).toBe(250);
  });

  it("projects northern latitudes toward the top and eastern longitudes to the right", () => {
    const { x, y } = projectCoordinates({ lat: 60, lng: 90 }, projectionConfig);

    expect(x).toBeGreaterThan(500);
    expect(y).toBeLessThan(250);
  });

  it("clamps out-of-range coordinates inside the map bounds", () => {
    const { x, y } = projectCoordinates({ lat: 200, lng: 400 }, projectionConfig);

    expect(x).toBeLessThanOrEqual(projectionConfig.width);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(projectionConfig.height);
    expect(y).toBeGreaterThanOrEqual(0);
  });

  it("falls back to the origin when coordinates are missing", () => {
    const { x, y } = projectCoordinates(null, projectionConfig);

    expect(Math.round(x)).toBe(500);
    expect(Math.round(y)).toBe(250);
  });
});
