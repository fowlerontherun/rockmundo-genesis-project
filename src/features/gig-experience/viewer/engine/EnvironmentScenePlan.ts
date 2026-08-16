import type { EnvironmentProfile, ResolvedEnvironment } from "./EnvironmentRegistry";
import { seededRandom } from "./SeededRandom";
import type { VenueArchetype } from "./VenueSceneRegistry";

/**
 * Phase 4 environment packs. Everything here is computed once per gig from the
 * resolved environment seed so background detail is deterministic across
 * resize, seek, playback speed and React re-renders. Nothing in this module
 * reads live network data, the clock, or Math.random.
 */

export type SkylineStyle = "tower" | "brick" | "roofline" | "shed" | "resort" | "none";
export type MoverKind = "car" | "boat" | "plane" | "train" | "none";
export type VegetationKind = "palm" | "broadleaf" | "conifer" | "scrub" | "none";

export interface SkylineBuilding {
  /** Normalised 0..1 positions relative to the exterior band. */
  x: number;
  width: number;
  height: number;
  depth: 0 | 1;
  tone: number;
  windowRows: number;
  windowColumns: number;
  roof: "flat" | "pitched" | "spire" | "dome" | "saw";
}

export interface RidgeSilhouette { x: number; width: number; height: number; snow: boolean }
export interface VegetationMark { x: number; scale: number; kind: VegetationKind; variant: number }
export interface StreetFurnitureMark { x: number; kind: "lamp" | "sign" | "hydrant" | "bin" | "bollard"; variant: number }
export interface MoverPlan { kind: MoverKind; lane: number; speed: number; phase: number; direction: 1 | -1; tone: number }
export interface WeatherParticle { x: number; y: number; speed: number; length: number; drift: number }

export interface EnvironmentScenePlan {
  seed: string;
  skyline: SkylineStyle;
  buildings: readonly SkylineBuilding[];
  ridges: readonly RidgeSilhouette[];
  vegetation: readonly VegetationMark[];
  streetFurniture: readonly StreetFurnitureMark[];
  movers: readonly MoverPlan[];
  particles: readonly WeatherParticle[];
  hasWater: boolean;
  waterWaves: readonly { y: number; amplitude: number; wavelength: number; phase: number }[];
  starField: readonly { x: number; y: number; radius: number }[];
  /** Motion budget: total animated background primitives allowed per frame. */
  motionBudget: number;
}

const SKYLINE_BY_KIND: Readonly<Record<EnvironmentProfile["kind"], SkylineStyle>> = Object.freeze({
  urban: "tower",
  industrial: "brick",
  riverside: "shed",
  coastal: "resort",
  beach: "resort",
  countryside: "none",
  historic: "roofline",
  tropical: "resort",
  desert: "shed",
  alpine: "roofline",
  generic: "tower",
});

const VEGETATION_BY_KIND: Readonly<Record<EnvironmentProfile["kind"], VegetationKind>> = Object.freeze({
  urban: "broadleaf",
  industrial: "none",
  riverside: "broadleaf",
  coastal: "palm",
  beach: "palm",
  countryside: "broadleaf",
  historic: "broadleaf",
  tropical: "palm",
  desert: "scrub",
  alpine: "conifer",
  generic: "broadleaf",
});

/** Movers are gated by profile features so boats never appear without water. */
function moverPool(profile: EnvironmentProfile, archetype: VenueArchetype): MoverKind[] {
  const pool: MoverKind[] = [];
  const water = profile.features.includes("water");
  if (water) pool.push("boat", "boat");
  if (profile.features.includes("buildings") || profile.features.includes("brick") || profile.features.includes("roofs")) pool.push("car", "car");
  if (profile.kind === "industrial" || profile.kind === "riverside") pool.push("train");
  if (profile.kind === "urban" || profile.kind === "coastal" || profile.kind === "desert") pool.push("plane");
  if (archetype === "festival") pool.push("car");
  return pool.length ? pool : ["car"];
}

export function buildEnvironmentScenePlan(input: {
  environment: ResolvedEnvironment;
  venueArchetype: VenueArchetype;
  reducedMotion?: boolean;
}): EnvironmentScenePlan {
  const { environment, venueArchetype } = input;
  const { profile, variation, atmosphere, timeOfDay } = environment;
  const seed = `${environment.seed}:pack:${profile.kind}:${venueArchetype}:${variation}`;
  const random = seededRandom(seed);
  const skyline = SKYLINE_BY_KIND[profile.kind];
  const vegetationKind = VEGETATION_BY_KIND[profile.kind];
  const hasWater = profile.features.includes("water");
  const outdoor = venueArchetype === "festival" || venueArchetype === "beach";

  const buildingCount = skyline === "none" ? 0 : skyline === "tower" ? 20 : skyline === "roofline" ? 16 : 12;
  const buildings: SkylineBuilding[] = Array.from({ length: buildingCount }, (_, index) => {
    const depth: 0 | 1 = index % 3 === 0 ? 0 : 1;
    const tall = skyline === "tower";
    const heightBase = tall ? .38 : skyline === "roofline" ? .3 : .22;
    return {
      x: index / Math.max(1, buildingCount) + random() * .02,
      width: (tall ? .045 : .07) + random() * .03,
      height: heightBase * (.45 + random() * .9) * (depth === 0 ? .8 : 1),
      depth,
      tone: Math.floor(random() * 4),
      windowRows: 2 + Math.floor(random() * (tall ? 8 : 4)),
      windowColumns: 2 + Math.floor(random() * 3),
      roof: skyline === "roofline"
        ? (random() < .25 ? "spire" : random() < .4 ? "dome" : "pitched")
        : skyline === "brick"
          ? (random() < .5 ? "saw" : "flat")
          : skyline === "resort"
            ? (random() < .4 ? "pitched" : "flat")
            : "flat",
    };
  });

  const ridgeCount = profile.features.includes("mountains") ? 7 : profile.features.includes("rocks") ? 5 : 0;
  const ridges: RidgeSilhouette[] = Array.from({ length: ridgeCount }, (_, index) => ({
    x: index / Math.max(1, ridgeCount) - .08 + random() * .04,
    width: .2 + random() * .16,
    height: (profile.kind === "alpine" ? .5 : .3) * (.5 + random() * .8),
    snow: profile.kind === "alpine" && random() < .7,
  }));

  const vegetationCount = vegetationKind === "none" ? 0 : vegetationKind === "scrub" ? 10 : outdoor ? 14 : 9;
  const vegetation: VegetationMark[] = Array.from({ length: vegetationCount }, (_, index) => ({
    x: (index + .5) / Math.max(1, vegetationCount) + (random() - .5) * .04,
    scale: .7 + random() * .7,
    kind: vegetationKind,
    variant: Math.floor(random() * 4),
  }));

  const furnitureCount = skyline === "none" ? 3 : 9;
  const furnitureKinds: StreetFurnitureMark["kind"][] = outdoor
    ? ["bollard", "sign", "bin", "lamp"]
    : ["lamp", "sign", "hydrant", "bin", "bollard"];
  const streetFurniture: StreetFurnitureMark[] = Array.from({ length: furnitureCount }, (_, index) => ({
    x: (index + .5) / furnitureCount + (random() - .5) * .03,
    kind: furnitureKinds[Math.floor(random() * furnitureKinds.length)],
    variant: Math.floor(random() * 3),
  }));

  const pool = moverPool(profile, venueArchetype);
  const moverCount = input.reducedMotion ? 0 : Math.min(6, 3 + Math.floor(random() * 3));
  const movers: MoverPlan[] = Array.from({ length: moverCount }, () => {
    const kind = pool[Math.floor(random() * pool.length)];
    return {
      kind,
      lane: kind === "plane" ? .06 + random() * .06 : kind === "boat" ? .27 + random() * .07 : .3 + random() * .03,
      speed: (kind === "boat" ? .012 : kind === "plane" ? .02 : kind === "train" ? .05 : .035) * (.7 + random() * .8),
      phase: random(),
      direction: random() < .5 ? -1 : 1,
      tone: Math.floor(random() * 4),
    };
  });

  const particleCount = input.reducedMotion || atmosphere === "clear" || atmosphere === "hazy"
    ? 0
    : atmosphere === "rainy" ? 90 : atmosphere === "foggy" ? 0 : 26;
  const particles: WeatherParticle[] = Array.from({ length: particleCount }, () => ({
    x: random(),
    y: random(),
    speed: .5 + random() * .9,
    length: .01 + random() * .025,
    drift: (random() - .5) * .4,
  }));

  const waterWaves = hasWater
    ? Array.from({ length: 5 }, (_, index) => ({
      y: .25 + index * .026,
      amplitude: 1.2 + random() * 2.4,
      wavelength: .12 + random() * .2,
      phase: random() * Math.PI * 2,
    }))
    : [];

  const starField = timeOfDay === "night"
    ? Array.from({ length: 70 }, () => ({ x: random(), y: random() * .26, radius: .4 + random() * 1.1 }))
    : [];

  return {
    seed,
    skyline,
    buildings,
    ridges,
    vegetation,
    streetFurniture,
    movers,
    particles,
    hasWater,
    waterWaves,
    starField,
    motionBudget: input.reducedMotion ? 0 : movers.length + particles.length + waterWaves.length,
  };
}
