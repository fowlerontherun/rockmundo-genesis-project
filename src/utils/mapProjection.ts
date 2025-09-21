import type { Coordinates } from "./worldTravel";

export interface MapProjectionOptions {
  width: number;
  height: number;
  padding?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeLongitude = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  let longitude = value;
  while (longitude < -180) {
    longitude += 360;
  }
  while (longitude > 180) {
    longitude -= 360;
  }
  return longitude;
};

const normalizeLatitude = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return clamp(value, -90, 90);
};

/**
 * Projects latitude/longitude coordinates into an x/y point using an equirectangular projection.
 * Useful for rendering pins on a flat world map background.
 */
export const projectCoordinates = (
  coordinates: Coordinates | null | undefined,
  options: MapProjectionOptions,
) => {
  const width = Math.max(1, Math.floor(options.width || 0));
  const height = Math.max(1, Math.floor(options.height || 0));
  const paddingInput = options.padding ?? 0;
  const maxPadding = Math.min(width, height) / 2;
  const padding = clamp(Number.isFinite(paddingInput) ? paddingInput : 0, 0, maxPadding);

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const lat = normalizeLatitude(coordinates?.lat ?? 0);
  const lng = normalizeLongitude(coordinates?.lng ?? 0);

  const normalizedX = (lng + 180) / 360;
  const normalizedY = (90 - lat) / 180;

  const x = clamp(padding + normalizedX * usableWidth, 0, width);
  const y = clamp(padding + normalizedY * usableHeight, 0, height);

  return { x, y };
};

export type ProjectedPoint = ReturnType<typeof projectCoordinates>;
