import type { FloorPattern } from "./VenueLayout";
import type { VenueArchetype, VenueSceneLayout } from "./VenueSceneRegistry";
import { seededIndex, seededRandom } from "./SeededRandom";

export type VenueServiceTheme = "wood" | "neon" | "heritage" | "concourse" | "outdoor";

export interface FloorTextureMark {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  variant: number;
}

export interface ServiceStockMark {
  x: number;
  y: number;
  variant: number;
}

export interface VenueServiceDetail {
  theme: VenueServiceTheme;
  accent: string;
  canopy: boolean;
  signStyle: number;
  stock: readonly ServiceStockMark[];
}

export interface VenueDetailPlan {
  seed: string;
  floorPattern: FloorPattern;
  floorMarks: readonly FloorTextureMark[];
  services: Readonly<{
    bar: VenueServiceDetail;
    merchandise: VenueServiceDetail;
  }>;
}

const SERVICE_THEMES: Readonly<Record<VenueArchetype, VenueServiceTheme>> = Object.freeze({
  pub: "wood",
  club: "neon",
  theatre: "heritage",
  arena: "concourse",
  stadium: "concourse",
  festival: "outdoor",
  beach: "outdoor",
});

const SERVICE_STOCK_COUNTS: Readonly<Record<VenueArchetype, number>> = Object.freeze({
  pub: 8,
  club: 10,
  theatre: 10,
  arena: 12,
  stadium: 14,
  festival: 8,
  beach: 8,
});

const SERVICE_ACCENTS = ["#22d3ee", "#f472b6", "#f59e0b", "#a3e635"] as const;

/**
 * Builds immutable cosmetic detail once per gig. All positions are relative to
 * their owning floor or service rectangle so resize and seek cannot reshuffle
 * the venue.
 */
export function buildVenueDetailPlan(input: {
  scene: VenueSceneLayout;
  floorPattern: FloorPattern;
}): VenueDetailPlan {
  const seed = `${input.scene.seed}:venue-detail-v1`;
  const floorMarks = buildFloorMarks(seed, input.floorPattern);
  const theme = SERVICE_THEMES[input.scene.archetype];
  const stockCount = SERVICE_STOCK_COUNTS[input.scene.archetype];

  return {
    seed,
    floorPattern: input.floorPattern,
    floorMarks,
    services: {
      bar: buildServiceDetail(seed, "bar", theme, stockCount, input.scene.archetype),
      merchandise: buildServiceDetail(seed, "merchandise", theme, stockCount, input.scene.archetype),
    },
  };
}

function buildFloorMarks(seed: string, pattern: FloorPattern): FloorTextureMark[] {
  const count = pattern === "grass" ? 150 : pattern === "concrete" ? 76 : pattern === "asphalt" ? 58 : 0;
  const random = seededRandom(`${seed}:floor:${pattern}`);
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    width: .0015 + random() * (pattern === "grass" ? .004 : .0025),
    height: .0015 + random() * (pattern === "grass" ? .006 : .0025),
    opacity: .025 + random() * .07,
    variant: Math.floor(random() * 4),
  }));
}

function buildServiceDetail(
  seed: string,
  service: "bar" | "merchandise",
  theme: VenueServiceTheme,
  stockCount: number,
  archetype: VenueArchetype,
): VenueServiceDetail {
  const random = seededRandom(`${seed}:service:${service}`);
  return {
    theme,
    accent: SERVICE_ACCENTS[seededIndex(`${seed}:service:${service}:accent`, SERVICE_ACCENTS.length)],
    canopy: archetype === "festival" || archetype === "beach",
    signStyle: seededIndex(`${seed}:service:${service}:sign`, 3),
    stock: Array.from({ length: stockCount }, () => ({
      x: .12 + random() * .76,
      y: .26 + random() * .42,
      variant: Math.floor(random() * 4),
    })),
  };
}
