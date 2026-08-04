import type { GigViewerReplay } from "../../events/types";
import type { CrowdEntity, CrowdLayoutPlan } from "./CrowdLifecycle";
import { buildCrowdPlan } from "./CrowdLifecycle";
import type { Point, Rect, Size } from "./Viewport";
import type { ScaledVenuePreset } from "./VenueLayout";

export interface CrowdTuningOptions {
  densityMultiplier: number;
  depthSpread: number;
  lateralSpread: number;
  stagePull: number;
  randomness: number;
  fanScale: number;
  arrivalSpeed: number;
}

export const CROWD_TUNING_STORAGE_KEY = "rockmundo:gig-viewer-demo:crowd-tuning";

export const DEFAULT_CROWD_TUNING: CrowdTuningOptions = {
  densityMultiplier: 2,
  depthSpread: 1,
  lateralSpread: 1,
  stagePull: 0,
  randomness: 0,
  fanScale: 1,
  arrivalSpeed: 1,
};

export const CROWD_TUNING_PRESETS = {
  production: {
    label: "Production default",
    description: "Matches the standard live gig viewer.",
    values: DEFAULT_CROWD_TUNING,
  },
  frontCrush: {
    label: "Front-row crush",
    description: "A dense crowd pulled tightly toward the stage and centre.",
    values: {
      densityMultiplier: 3,
      depthSpread: 0.55,
      lateralSpread: 0.65,
      stagePull: 0.8,
      randomness: 0.08,
      fanScale: 1.05,
      arrivalSpeed: 1.2,
    },
  },
  denseClub: {
    label: "Dense club",
    description: "Maximum visual density with compact floor coverage.",
    values: {
      densityMultiplier: 4,
      depthSpread: 0.7,
      lateralSpread: 0.8,
      stagePull: 0.5,
      randomness: 0.15,
      fanScale: 0.9,
      arrivalSpeed: 1.25,
    },
  },
  balanced: {
    label: "Balanced",
    description: "Keeps the front-first rule while adding a little organic variation.",
    values: {
      densityMultiplier: 2,
      depthSpread: 0.95,
      lateralSpread: 0.95,
      stagePull: 0.15,
      randomness: 0.15,
      fanScale: 1,
      arrivalSpeed: 1,
    },
  },
  wideFestival: {
    label: "Wide festival",
    description: "Spreads the audience deeper and wider across outdoor layouts.",
    values: {
      densityMultiplier: 1.5,
      depthSpread: 1.2,
      lateralSpread: 1.4,
      stagePull: 0.05,
      randomness: 0.3,
      fanScale: 0.85,
      arrivalSpeed: 0.9,
    },
  },
  sparseBooking: {
    label: "Sparse booking",
    description: "A visibly thin audience that still gathers near the front.",
    values: {
      densityMultiplier: 0.75,
      depthSpread: 0.85,
      lateralSpread: 0.7,
      stagePull: 0.35,
      randomness: 0.35,
      fanScale: 1.1,
      arrivalSpeed: 0.8,
    },
  },
} as const satisfies Record<
  string,
  { label: string; description: string; values: CrowdTuningOptions }
>;

export type CrowdTuningPresetKey = keyof typeof CROWD_TUNING_PRESETS;

export function normalizeCrowdTuning(value?: Partial<CrowdTuningOptions> | null): CrowdTuningOptions {
  return {
    densityMultiplier: clampNumber(value?.densityMultiplier, 0.5, 4, DEFAULT_CROWD_TUNING.densityMultiplier),
    depthSpread: clampNumber(value?.depthSpread, 0.45, 1.5, DEFAULT_CROWD_TUNING.depthSpread),
    lateralSpread: clampNumber(value?.lateralSpread, 0.45, 1.5, DEFAULT_CROWD_TUNING.lateralSpread),
    stagePull: clampNumber(value?.stagePull, 0, 1, DEFAULT_CROWD_TUNING.stagePull),
    randomness: clampNumber(value?.randomness, 0, 0.8, DEFAULT_CROWD_TUNING.randomness),
    fanScale: clampNumber(value?.fanScale, 0.6, 1.6, DEFAULT_CROWD_TUNING.fanScale),
    arrivalSpeed: clampNumber(value?.arrivalSpeed, 0.5, 2, DEFAULT_CROWD_TUNING.arrivalSpeed),
  };
}

export function crowdTuningSignature(value?: Partial<CrowdTuningOptions> | null) {
  if (!value) return "production";
  const normalized = normalizeCrowdTuning(value);
  return Object.values(normalized).map((number) => number.toFixed(3)).join(":");
}

export function buildTunedCrowdPlan({
  replay,
  attendance,
  capacity,
  size,
  preset,
  reducedMotion = false,
  devicePixelRatio = 1,
  tuning,
}: {
  replay: GigViewerReplay;
  attendance: number;
  capacity: number;
  size: Size;
  preset: ScaledVenuePreset;
  reducedMotion?: boolean;
  devicePixelRatio?: number;
  tuning?: Partial<CrowdTuningOptions> | null;
}): CrowdLayoutPlan {
  const plan = buildCrowdPlan({
    replay,
    attendance,
    capacity,
    size,
    reducedMotion,
    devicePixelRatio,
  });

  // Production replays do not provide an override and therefore retain the
  // exact canonical crowd plan produced by CrowdLifecycle.
  if (!tuning || plan.baseEntities.length === 0) return plan;

  const options = normalizeCrowdTuning(tuning);
  const desiredCount = Math.min(
    plan.cap,
    Math.max(1, Math.ceil(Math.max(0, plan.attendance) * options.densityMultiplier)),
  );
  const resized = resizeEntities(plan.baseEntities, desiredCount, replay.simulationSeed, preset);
  const axes = crowdAxes(preset);
  const weight = plan.attendance / Math.max(1, resized.length);
  let assignedWeight = 0;

  const baseEntities = resized.map((entity, index) => {
    const target = tunePoint(entity.target, index, replay.simulationSeed, preset, axes, options);
    const waypoint = {
      x: entity.start.x + (target.x - entity.start.x) * 0.45,
      y: entity.start.y + (target.y - entity.start.y) * 0.35,
    };
    const entityWeight = index === resized.length - 1 ? plan.attendance - assignedWeight : weight;
    assignedWeight += entityWeight;
    const travelMs = reducedMotion ? 0 : Math.max(250, entity.travelMs / options.arrivalSpeed);

    return {
      ...entity,
      id: `crowd-${index}`,
      seedIndex: index,
      weight: entityWeight,
      target,
      waypoint,
      travelMs,
      speed: travelMs ? distance(entity.start, target) / travelMs : 0,
      radius: Math.max(0.7, Math.min(3.5, entity.radius * options.fanScale)),
    };
  });

  return { ...plan, baseEntities };
}

function resizeEntities(
  entities: CrowdEntity[],
  desiredCount: number,
  seed: string,
  preset: ScaledVenuePreset,
): CrowdEntity[] {
  if (desiredCount <= entities.length) return entities.slice(0, desiredCount);
  const random = deterministicRandom(`${seed}:crowd-tuning:resize`);
  return Array.from({ length: desiredCount }, (_, index) => {
    const source = entities[index % entities.length];
    if (index < entities.length) return source;
    const cycle = Math.floor(index / entities.length);
    const offset = 1.5 + Math.min(4, cycle) * 0.75;
    const target = clampToCrowdArea(
      {
        x: source.target.x + (random() - 0.5) * offset * 2,
        y: source.target.y + (random() - 0.5) * offset * 2,
      },
      preset,
    );
    return {
      ...source,
      id: `crowd-tuned-${index}`,
      seedIndex: index,
      target,
      x: source.x + (random() - 0.5) * 2,
      y: source.y + (random() - 0.5) * 2,
      idlePhase: random() * Math.PI * 2,
      spawnOffsetMs: source.spawnOffsetMs + cycle * 12,
    };
  });
}

function tunePoint(
  point: Point,
  index: number,
  seed: string,
  preset: ScaledVenuePreset,
  axes: ReturnType<typeof crowdAxes>,
  options: CrowdTuningOptions,
): Point {
  const relative = { x: point.x - axes.stageCentre.x, y: point.y - axes.stageCentre.y };
  const rawDepth = dot(relative, axes.depth);
  const rawLateral = dot(relative, axes.lateral);
  const audienceDepth = Math.max(0, rawDepth - axes.stageFrontProjection);
  const pullDistance = options.stagePull * Math.max(4, axes.averageCellSize * 0.8);
  const tunedDepth = axes.stageFrontProjection + Math.max(1, audienceDepth * options.depthSpread - pullDistance);
  const tunedLateral = rawLateral * options.lateralSpread;
  const random = deterministicRandom(`${seed}:crowd-tuning:${index}`);
  const jitterDistance = options.randomness * Math.max(2, axes.averageCellSize * 0.45);
  const jitterDepth = (random() - 0.5) * jitterDistance;
  const jitterLateral = (random() - 0.5) * jitterDistance;
  const tuned = {
    x:
      axes.stageCentre.x +
      axes.depth.x * (tunedDepth + jitterDepth) +
      axes.lateral.x * (tunedLateral + jitterLateral),
    y:
      axes.stageCentre.y +
      axes.depth.y * (tunedDepth + jitterDepth) +
      axes.lateral.y * (tunedLateral + jitterLateral),
  };
  return clampToCrowdArea(tuned, preset);
}

function crowdAxes(preset: ScaledVenuePreset) {
  const zones = preset.crowdZones.length ? preset.crowdZones : [preset.audience];
  const stageCentre = rectCentre(preset.stage);
  const bounds = unionRect(zones);
  const audienceCentre = rectCentre(bounds);
  const rawDepth = {
    x: audienceCentre.x - stageCentre.x,
    y: audienceCentre.y - stageCentre.y,
  };
  const length = Math.hypot(rawDepth.x, rawDepth.y) || 1;
  const depth = { x: rawDepth.x / length, y: rawDepth.y / length };
  const lateral = { x: -depth.y, y: depth.x };
  const corners = rectCorners(preset.stage);
  const stageFrontProjection = Math.max(
    ...corners.map((corner) => dot({ x: corner.x - stageCentre.x, y: corner.y - stageCentre.y }, depth)),
  );
  const averageCellSize =
    zones.reduce((sum, zone) => sum + Math.min(zone.width, zone.height), 0) / Math.max(1, zones.length * 8);
  return { stageCentre, depth, lateral, stageFrontProjection, averageCellSize };
}

function clampToCrowdArea(point: Point, preset: ScaledVenuePreset): Point {
  const zones = preset.crowdZones.length ? preset.crowdZones : [preset.audience];
  const containing = zones.find((zone) => pointInRect(point, zone));
  if (containing) return point;
  const nearest = zones
    .map((zone) => ({ zone, point: clampToRect(point, zone) }))
    .sort((a, b) => distance(point, a.point) - distance(point, b.point))[0];
  return nearest?.point ?? clampToRect(point, preset.audience);
}

function clampToRect(point: Point, rect: Rect): Point {
  const padding = Math.min(2, rect.width / 4, rect.height / 4);
  return {
    x: Math.min(rect.x + rect.width - padding, Math.max(rect.x + padding, point.x)),
    y: Math.min(rect.y + rect.height - padding, Math.max(rect.y + padding, point.y)),
  };
}

function pointInRect(point: Point, rect: Rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function unionRect(rects: Rect[]): Rect {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function rectCentre(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function rectCorners(rect: Rect): Point[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ];
}

function dot(a: Point, b: Point) {
  return a.x * b.x + a.y * b.y;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function deterministicRandom(seed: string) {
  let state = hashSeed(seed);
  return () => {
    let value = (state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clampNumber(value: number | undefined, minimum: number, maximum: number, fallback: number) {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(maximum, Math.max(minimum, safe));
}
