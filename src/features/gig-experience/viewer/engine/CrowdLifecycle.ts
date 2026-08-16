import type { GigViewerReplay } from "../../events/types";
import type { Point, Rect, Size } from "./Viewport";
import { pointInRect } from "./Viewport";
import { selectVenuePreset, scaleVenuePreset } from "./VenueLayout";

export type CrowdEntityState = "queued" | "entering" | "moving_to_zone" | "settling" | "waiting";

export interface CrowdEntity {
  id: string;
  seedIndex: number;
  weight: number;
  entranceId: string;
  targetZoneId: string;
  x: number;
  y: number;
  start: Point;
  waypoint: Point;
  target: Point;
  spawnOffsetMs: number;
  travelMs: number;
  speed: number;
  state: CrowdEntityState;
  radius: number;
  idlePhase: number;
  visible: boolean;
}

export interface CrowdMilestone {
  key: string;
  label: string;
  progress: number;
  reached: boolean;
}

export interface CrowdState {
  entities: CrowdEntity[];
  attendance: number;
  capacity: number;
  cap: number;
  fillProgress: number;
  phaseLabel: string;
  occupiedZones: string[];
  milestones: CrowdMilestone[];
  diagnostics: { entityCount: number; movingCount: number; settledCount: number };
}

export interface CrowdLayoutPlan {
  baseEntities: CrowdEntity[];
  attendance: number;
  capacity: number;
  cap: number;
  entryStartMs: number;
  entryEndMs: number;
  milestones: CrowdMilestone[];
}

export interface CrowdPackingCell {
  id: string;
  rect: Rect;
  stageDistance: number;
  lateralDistance: number;
  area: number;
}

export const CROWD_DENSITY_MULTIPLIER = 2;
export const CROWD_ENTITY_CAPS = {
  reducedMotion: 300,
  mobileLow: 1800,
  mobileDefault: 2800,
  tablet: 3800,
  desktopDefault: 5800,
  desktopHigh: 9200,
} as const;

const PACKING_DEPTH_BANDS = 8;
const PACKING_LATERAL_BANDS = 5;
const LATERAL_COLUMN_ORDER = [2, 1, 3, 0, 4] as const;
const LATERAL_LABELS = ["outer-left", "inner-left", "centre", "inner-right", "outer-right"] as const;

export function selectCrowdEntityCap({
  reducedMotion,
  width,
  devicePixelRatio = 1,
  attendanceRatio = 0,
  highPerformance = false,
}: {
  reducedMotion: boolean;
  width: number;
  devicePixelRatio?: number;
  attendanceRatio?: number;
  highPerformance?: boolean;
}) {
  if (reducedMotion) return CROWD_ENTITY_CAPS.reducedMotion;
  if (width < 420 || devicePixelRatio > 2.75) return CROWD_ENTITY_CAPS.mobileLow;
  if (width < 760) return CROWD_ENTITY_CAPS.mobileDefault;
  if (width < 1024) return CROWD_ENTITY_CAPS.tablet;
  return highPerformance && attendanceRatio > 0.85
    ? CROWD_ENTITY_CAPS.desktopHigh
    : CROWD_ENTITY_CAPS.desktopDefault;
}

export function representedWeights(attendance: number, cap: number, densityMultiplier = 1): number[] {
  const total = Math.max(0, Math.floor(attendance));
  const safeMultiplier = Math.max(1, Number.isFinite(densityMultiplier) ? densityMultiplier : 1);
  const count = Math.min(Math.max(0, Math.floor(cap)), Math.ceil(total * safeMultiplier));
  if (count === 0) return [];

  if (count > total) {
    const weight = total / count;
    const weights = Array.from({ length: count }, () => weight);
    weights[count - 1] += total - weights.reduce((sum, value) => sum + value, 0);
    return weights;
  }

  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i >= count - remainder ? 1 : 0));
}


export interface CrowdRowSlot {
  id: string;
  point: Point;
  rowIndex: number;
  lateralDistance: number;
  stageDistance: number;
}

const ROW_LATERAL_JITTER = .22;
const ROW_DEPTH_JITTER = .3;

/** Depth axis for a zone: fans face the stage, so rows run perpendicular to the stage-to-zone direction. */
function zoneDepthAxis(zone: Rect, stage: Rect): { axis: "x" | "y"; sign: 1 | -1 } {
  const centre = rectCentre(zone);
  const stageCentre = rectCentre(stage);
  const dx = centre.x - stageCentre.x;
  const dy = centre.y - stageCentre.y;
  if (Math.abs(dx) > Math.abs(dy) * 1.2) return { axis: "x", sign: dx >= 0 ? 1 : -1 };
  return { axis: "y", sign: dy >= 0 ? 1 : -1 };
}

function distributeRowCounts(total: number, rows: number): number[] {
  const weights = Array.from({ length: rows }, (_, index) => 1 - .45 * (rows <= 1 ? 0 : index / (rows - 1)));
  const sum = weights.reduce((acc, value) => acc + value, 0);
  const counts = weights.map((weight) => Math.max(1, Math.floor((total * weight) / sum)));
  let assigned = counts.reduce((acc, value) => acc + value, 0);
  let index = 0;
  while (assigned > total && counts.some((count) => count > 1)) {
    const cursor = counts.length - 1 - (index % counts.length);
    if (counts[cursor] > 1) { counts[cursor] -= 1; assigned -= 1; }
    index += 1;
  }
  index = 0;
  while (assigned < total) { counts[index % counts.length] += 1; assigned += 1; index += 1; }
  return counts;
}

/**
 * Places fans in rows parallel to the stage: shoulder-to-shoulder and tightly aligned at the barrier,
 * progressively sparser, wider spaced and more jittered towards the back of the zone.
 */
export function buildCrowdRowsForZone(zone: Rect, stage: Rect, count: number, fillFraction: number, rand: () => number, zoneLabel: string): CrowdRowSlot[] {
  const total = Math.max(0, Math.floor(count));
  if (total === 0) return [];
  const { axis, sign } = zoneDepthAxis(zone, stage);
  const depthSpan = Math.max(1, (axis === "y" ? zone.height : zone.width) * Math.max(.12, Math.min(1, fillFraction)));
  const lateralSpan = Math.max(1, axis === "y" ? zone.width : zone.height);
  const rows = Math.max(1, Math.min(64, Math.round(Math.sqrt((total * depthSpan * 1.35) / lateralSpan)) || 1));
  const counts = distributeRowCounts(total, rows);

  const gapWeights = Array.from({ length: rows }, (_, index) => 1 + 1.25 * (rows <= 1 ? 0 : index / (rows - 1)));
  const gapSum = gapWeights.reduce((acc, value) => acc + value, 0);
  const depthOrigin = axis === "y" ? (sign > 0 ? zone.y : zone.y + zone.height) : sign > 0 ? zone.x : zone.x + zone.width;
  const lateralOrigin = axis === "y" ? zone.x : zone.y;

  const slots: CrowdRowSlot[] = [];
  let cumulative = 0;
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const gap = (gapWeights[rowIndex] / gapSum) * depthSpan;
    const rowDepth = cumulative + gap * .5;
    cumulative += gap;
    const depthFraction = rows <= 1 ? 0 : rowIndex / (rows - 1);
    const members = counts[rowIndex];
    const pitch = lateralSpan / members;
    for (let member = 0; member < members; member += 1) {
      const stagger = rowIndex % 2 === 1 ? pitch * .5 : 0;
      const jitterScale = .25 + .75 * depthFraction;
      const lateral = lateralOrigin + Math.max(pitch * .3, Math.min(lateralSpan - pitch * .3,
        (member + .5) * pitch + stagger - (stagger ? pitch * .25 : 0) + (rand() - .5) * pitch * ROW_LATERAL_JITTER * 2 * jitterScale));
      const depth = rowDepth + (rand() - .5) * gap * ROW_DEPTH_JITTER * 2 * depthFraction;
      const along = depthOrigin + sign * Math.max(1, Math.min(depthSpan, depth));
      const point = axis === "y" ? { x: lateral, y: along } : { x: along, y: lateral };
      slots.push({
        id: `${zoneLabel}-row${rowIndex}-${member}`,
        point,
        rowIndex,
        lateralDistance: Math.abs(lateral - (lateralOrigin + lateralSpan / 2)),
        stageDistance: rowDepth,
      });
    }
  }
  return slots;
}

/**
 * Builds the whole audience as realistic rows: zones fill front-to-back, so a half-full room
 * packs the front of the floor rather than scattering clusters across the venue.
 */
export function buildCrowdRowPlan(zones: Rect[], stage: Rect, attendanceRatio: number, entityCount: number, rand: () => number): CrowdRowSlot[] {
  const total = Math.max(0, Math.floor(entityCount));
  if (total === 0) return [];
  const source = zones.length ? zones : [{ x: stage.x, y: stage.y + stage.height, width: stage.width, height: 1 }];
  const axes = packingAxes(source, stage);
  const ordered = [...source]
    .map((rect, originalIndex) => ({ rect, originalIndex, distance: projectedDepth(rectCentre(rect), axes) }))
    .sort((a, b) => a.distance - b.distance || a.originalIndex - b.originalIndex);

  const ratio = Math.max(.02, Math.min(1, Number.isFinite(attendanceRatio) ? attendanceRatio : 0));
  const areas = ordered.map(({ rect }) => Math.max(1, rect.width * rect.height));
  const areaTotal = areas.reduce((acc, value) => acc + value, 0);
  const reach = Math.pow(ratio, .85);

  const used: { rect: Rect; label: string; fill: number; area: number }[] = [];
  let cumulative = 0;
  for (let index = 0; index < ordered.length; index += 1) {
    const share = areas[index] / areaTotal;
    if (cumulative >= reach && used.length) break;
    const label = index === 0 ? "front" : index === ordered.length - 1 && ordered.length > 2 ? "rear" : "middle";
    used.push({ rect: ordered[index].rect, label, area: areas[index], fill: Math.max(.15, Math.min(1, (reach - cumulative) / share)) });
    cumulative += share;
  }

  const usedArea = used.reduce((acc, zone) => acc + zone.area * zone.fill, 0);
  let assigned = 0;
  const slots: CrowdRowSlot[] = [];
  used.forEach((zone, index) => {
    const count = index === used.length - 1
      ? total - assigned
      : Math.max(1, Math.min(total - assigned - (used.length - index - 1), Math.round((total * zone.area * zone.fill) / usedArea)));
    assigned += count;
    slots.push(...buildCrowdRowsForZone(zone.rect, stage, count, zone.fill, rand, `${zone.label}-${index}`)
      .map((slot) => ({ ...slot, stageDistance: index * 1e5 + slot.stageDistance })));
  });

  return slots
    .sort((a, b) => a.stageDistance - b.stageDistance || a.rowIndex - b.rowIndex || a.lateralDistance - b.lateralDistance)
    .slice(0, total);
}

export function buildCrowdPackingCells(zones: Rect[], stage: Rect): CrowdPackingCell[] {
  const source = zones.length ? zones : [{ x: stage.x, y: stage.y + stage.height, width: stage.width, height: 1 }];
  const axes = packingAxes(source, stage);
  const orderedZones = [...source]
    .map((rect, originalIndex) => ({ rect, originalIndex, distance: projectedDepth(rectCentre(rect), axes) }))
    .sort((a, b) => a.distance - b.distance || a.originalIndex - b.originalIndex);

  return orderedZones
    .flatMap(({ rect }, orderedIndex) => {
      const zoneLabel = orderedIndex === 0 ? "front" : orderedIndex === orderedZones.length - 1 && orderedZones.length > 2 ? "rear" : "middle";
      const cellWidth = rect.width / PACKING_LATERAL_BANDS;
      const cellHeight = rect.height / PACKING_DEPTH_BANDS;

      return Array.from({ length: PACKING_DEPTH_BANDS }, (_, depthIndex) =>
        LATERAL_COLUMN_ORDER.map((columnIndex) => {
          const cellRect = {
            x: rect.x + columnIndex * cellWidth,
            y: rect.y + depthIndex * cellHeight,
            width: cellWidth,
            height: cellHeight,
          };
          const centre = rectCentre(cellRect);
          return {
            id: `${zoneLabel}-${depthIndex}-${LATERAL_LABELS[columnIndex]}`,
            rect: cellRect,
            stageDistance: projectedDepth(centre, axes),
            lateralDistance: projectedLateralDistance(centre, axes),
            area: Math.max(1, cellRect.width * cellRect.height),
          };
        }),
      ).flat();
    })
    .sort(
      (a, b) =>
        a.stageDistance - b.stageDistance ||
        a.lateralDistance - b.lateralDistance ||
        a.rect.y - b.rect.y ||
        a.rect.x - b.rect.x,
    );
}

export function selectActivePackingCells(cells: CrowdPackingCell[], attendanceRatio: number, entityCount: number): CrowdPackingCell[] {
  if (!cells.length || entityCount <= 0) return [];
  const ratio = Math.max(0, Math.min(1, Number.isFinite(attendanceRatio) ? attendanceRatio : 0));
  const activeCount = Math.min(cells.length, entityCount, Math.max(1, Math.ceil(cells.length * ratio)));
  return cells.slice(0, activeCount);
}

export function buildCrowdPlan({
  replay,
  attendance,
  capacity,
  size,
  reducedMotion = false,
  devicePixelRatio = 1,
}: {
  replay: GigViewerReplay;
  attendance: number;
  capacity: number;
  size: Size;
  reducedMotion?: boolean;
  devicePixelRatio?: number;
}): CrowdLayoutPlan {
  const safeAttendance = Math.max(0, Math.floor(Number.isFinite(attendance) ? attendance : 0));
  const safeCapacity = Math.max(0, Math.floor(Number.isFinite(capacity) ? capacity : 0));
  const ratio = safeCapacity > 0 ? Math.min(1, safeAttendance / safeCapacity) : 0;
  const cap = selectCrowdEntityCap({
    reducedMotion,
    width: size.width,
    devicePixelRatio,
    attendanceRatio: ratio,
    highPerformance: ratio > 0.85,
  });
  const preset = scaleVenuePreset(selectVenuePreset({ capacity: safeCapacity }), size);
  const weights = representedWeights(safeAttendance, cap, CROWD_DENSITY_MULTIPLIER);

  const entryStartMs = findEventOffset(replay, "venue_open", 0);
  const crowdFill = replay.events.filter((event) => event.visualPayload.type === "crowd_fill");
  const firstSong = replay.events.find((event) => event.visualPayload.type === "song_start")?.scheduledOffsetMs;
  const lastFillEnd = crowdFill.reduce(
    (maximum, event) => Math.max(maximum, event.scheduledOffsetMs + Math.max(1000, event.durationMs || 0)),
    entryStartMs + 9000,
  );
  const entryEndMs = Math.max(
    entryStartMs + 4000,
    Math.min(firstSong ?? lastFillEnd, Math.max(lastFillEnd, entryStartMs + 9000)),
  );
  const rand = deterministicRandom(
    `${replay.simulationSeed}:crowd-entry:${preset.name}:${Math.round(size.width)}x${Math.round(size.height)}`,
  );
  const rowRand = deterministicRandom(
    `${replay.simulationSeed}:crowd-rows:${preset.name}:${Math.round(size.width)}x${Math.round(size.height)}:${weights.length}`,
  );
  const rowSlots = buildCrowdRowPlan(
    preset.crowdZones.length ? preset.crowdZones : [preset.audience],
    preset.stage,
    ratio,
    weights.length,
    rowRand,
  );

  const baseEntities = weights.map((weight, i) => {
    const entranceIndex = weightedIndex(i, preset.entrances.length || 1, replay.simulationSeed);
    const entrance = preset.entrances[entranceIndex] ?? fallbackEntrance(preset.audience);
    const start = boundedEntrancePoint(entrance, preset.audience, rand, i);
    const slot = rowSlots[i] ?? {
      id: "front-0-row0-0",
      point: rectCentre(preset.audience),
      rowIndex: 0,
      lateralDistance: 0,
      stageDistance: 0,
    };
    const target = slot.point;
    const waypoint = {
      x: start.x + (target.x - start.x) * 0.45,
      y: Math.max(preset.audience.y + 8, start.y + (target.y - start.y) * 0.35),
    };
    const stagger = weights.length <= 1 ? 0 : i / (weights.length - 1);
    const spawnOffsetMs = entryStartMs + stagger * Math.max(1, entryEndMs - entryStartMs) * 0.72;
    const travelMs = reducedMotion ? 0 : 2400 + rand() * 2200;

    return {
      id: `crowd-${i}`,
      seedIndex: i,
      weight,
      entranceId: `entrance-${entranceIndex}`,
      targetZoneId: slot.id,
      x: start.x,
      y: start.y,
      start,
      waypoint,
      target,
      spawnOffsetMs,
      travelMs,
      speed: travelMs ? distance(start, target) / travelMs : 0,
      state: "queued" as CrowdEntityState,
      radius: Math.max(1, Math.min(2.4, 1 + Math.sqrt(weight) * 0.08)),
      idlePhase: rand() * Math.PI * 2,
      visible: false,
    };
  });

  return {
    baseEntities,
    attendance: safeAttendance,
    capacity: safeCapacity,
    cap,
    entryStartMs,
    entryEndMs,
    milestones: milestoneTemplates(),
  };
}

export function reconstructCrowdState(plan: CrowdLayoutPlan, positionMs: number, reducedMotion = false): CrowdState {
  const pos = Math.max(0, positionMs);
  const entrySpan = Math.max(1, plan.entryEndMs - plan.entryStartMs);
  const fillProgress = plan.baseEntities.length
    ? Math.min(1, Math.max(0, (pos - plan.entryStartMs) / entrySpan))
    : 0;
  const entities = plan.baseEntities.map((entity) => projectEntity(entity, pos, reducedMotion));
  const visible = entities.filter((entity) => entity.visible);
  const settled = visible.filter((entity) => entity.state === "waiting").length;
  const moving = visible.filter((entity) => entity.state !== "waiting").length;
  const zoneSet = new Set(
    visible
      .filter((entity) => entity.state === "waiting" || entity.state === "settling")
      .map((entity) => entity.targetZoneId),
  );
  const phaseLabel =
    plan.attendance <= 0
      ? "No audience attendance recorded."
      : fillProgress <= 0
        ? "Doors are open."
        : fillProgress < 0.25
          ? "The first fans are entering."
          : fillProgress < 0.75
            ? "The venue is filling."
            : settled < plan.baseEntities.length
              ? "The audience is settling."
              : "The audience has settled before the band enters.";

  return {
    entities,
    attendance: plan.attendance,
    capacity: plan.capacity,
    cap: plan.cap,
    fillProgress,
    phaseLabel,
    occupiedZones: [...zoneSet],
    milestones: plan.milestones.map((milestone) => ({ ...milestone, reached: fillProgress >= milestone.progress })),
    diagnostics: { entityCount: entities.length, movingCount: moving, settledCount: settled },
  };
}

function allocatePackingSlots(cells: CrowdPackingCell[], entityCount: number) {
  if (!cells.length || entityCount <= 0) return [];
  const allocations = Array.from({ length: cells.length }, () => 1);
  let remaining = Math.max(0, entityCount - cells.length);
  const totalArea = cells.reduce((sum, cell) => sum + cell.area, 0);
  const fractions = cells.map((cell, index) => {
    const exact = totalArea > 0 ? (remaining * cell.area) / totalArea : remaining / cells.length;
    const whole = Math.floor(exact);
    allocations[index] += whole;
    return { index, fraction: exact - whole };
  });
  remaining -= allocations.reduce((sum, count) => sum + count, 0) - cells.length;
  fractions
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    .slice(0, remaining)
    .forEach(({ index }) => {
      allocations[index] += 1;
    });

  return cells.flatMap((cell, cellIndex) =>
    Array.from({ length: allocations[cellIndex] }, (_, localIndex) => ({
      cell,
      localIndex,
      localCount: allocations[cellIndex],
    })),
  );
}

function deterministicPackedPoint(rect: Rect, rand: () => number, localIndex: number, localCount: number): Point {
  const aspect = Math.max(0.2, rect.width / Math.max(1, rect.height));
  const columns = Math.max(1, Math.ceil(Math.sqrt(localCount * aspect)));
  const rows = Math.max(1, Math.ceil(localCount / columns));
  const column = localIndex % columns;
  const row = Math.floor(localIndex / columns);
  const jitterX = (rand() - 0.5) * 0.28;
  const jitterY = (rand() - 0.5) * 0.28;
  return {
    x: rect.x + ((column + 0.5 + jitterX) / columns) * rect.width,
    y: rect.y + ((row + 0.5 + jitterY) / rows) * rect.height,
  };
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function projectEntity(entity: CrowdEntity, pos: number, reducedMotion: boolean): CrowdEntity {
  if (reducedMotion) {
    const visible = pos >= entity.spawnOffsetMs;
    return {
      ...entity,
      x: entity.target.x,
      y: entity.target.y,
      state: visible ? "waiting" : "queued",
      visible,
    };
  }
  if (pos < entity.spawnOffsetMs) {
    return { ...entity, x: entity.start.x, y: entity.start.y, state: "queued", visible: false };
  }

  const progress = Math.min(1, (pos - entity.spawnOffsetMs) / Math.max(1, entity.travelMs));
  const point =
    progress < 0.35
      ? lerp(entity.start, entity.waypoint, ease(progress / 0.35))
      : lerp(entity.waypoint, entity.target, ease((progress - 0.35) / 0.65));
  const state =
    progress < 0.18
      ? "entering"
      : progress < 0.92
        ? "moving_to_zone"
        : progress < 1
          ? "settling"
          : "waiting";
  const idle = state === "waiting" ? Math.sin(pos / 950 + entity.idlePhase) * 1.2 : 0;
  return { ...entity, x: point.x + idle, y: point.y, state, visible: true };
}

function rectCentre(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function packingAxes(zones: Rect[], stage: Rect) {
  const stageCentre = rectCentre(stage);
  const audienceBounds = zones.reduce(
    (bounds, zone) => ({
      x: Math.min(bounds.x, zone.x),
      y: Math.min(bounds.y, zone.y),
      right: Math.max(bounds.right, zone.x + zone.width),
      bottom: Math.max(bounds.bottom, zone.y + zone.height),
    }),
    { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY, bottom: Number.NEGATIVE_INFINITY },
  );
  const audienceCentre = {
    x: (audienceBounds.x + audienceBounds.right) / 2,
    y: (audienceBounds.y + audienceBounds.bottom) / 2,
  };
  const rawDepth = { x: audienceCentre.x - stageCentre.x, y: audienceCentre.y - stageCentre.y };
  const length = Math.hypot(rawDepth.x, rawDepth.y) || 1;
  const depth = { x: rawDepth.x / length, y: rawDepth.y / length };
  const lateral = { x: -depth.y, y: depth.x };
  const stageCorners = [
    { x: stage.x, y: stage.y },
    { x: stage.x + stage.width, y: stage.y },
    { x: stage.x, y: stage.y + stage.height },
    { x: stage.x + stage.width, y: stage.y + stage.height },
  ];
  const stageFrontProjection = Math.max(...stageCorners.map((point) => dot(point, depth)));
  return { stageCentre, depth, lateral, stageFrontProjection };
}

function projectedDepth(point: Point, axes: ReturnType<typeof packingAxes>) {
  return Math.max(0, dot(point, axes.depth) - axes.stageFrontProjection);
}

function projectedLateralDistance(point: Point, axes: ReturnType<typeof packingAxes>) {
  return Math.abs(dot({ x: point.x - axes.stageCentre.x, y: point.y - axes.stageCentre.y }, axes.lateral));
}

function dot(a: Point, b: Point) {
  return a.x * b.x + a.y * b.y;
}

function boundedEntrancePoint(entrance: Point, audience: Rect, rand: () => number, i: number): Point {
  const spread = 18;
  const point = {
    x: entrance.x + (rand() - 0.5) * spread + ((i % 5) - 2) * 2,
    y: entrance.y + (rand() - 0.5) * 10,
  };
  return pointInRect(point, audience)
    ? point
    : {
        x: Math.min(audience.x + audience.width - 8, Math.max(audience.x + 8, point.x)),
        y: Math.min(audience.y + audience.height - 8, Math.max(audience.y + 8, point.y)),
      };
}

function fallbackEntrance(audience: Rect): Point {
  return { x: audience.x + audience.width / 2, y: audience.y + audience.height - 8 };
}

function weightedIndex(i: number, count: number, seed: string) {
  const safeCount = Math.max(1, count);
  return (i + stableSeedOffset(seed, safeCount)) % safeCount;
}

function stableSeedOffset(seed: string, count: number) {
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  return (hash >>> 0) % count;
}

function findEventOffset(replay: GigViewerReplay, type: string, fallback: number) {
  return replay.events.find((event) => event.visualPayload.type === type)?.scheduledOffsetMs ?? fallback;
}

function milestoneTemplates(): CrowdMilestone[] {
  return [
    { key: "doors", label: "Doors are open.", progress: 0, reached: false },
    { key: "first", label: "The first fans are entering.", progress: 0.05, reached: false },
    { key: "quarter", label: "The venue is one quarter full.", progress: 0.25, reached: false },
    { key: "half", label: "The venue is half full.", progress: 0.5, reached: false },
    { key: "three-quarter", label: "The venue is three quarters full.", progress: 0.75, reached: false },
    { key: "full", label: "Target attendance has arrived.", progress: 1, reached: false },
  ];
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function ease(t: number) {
  return t * t * (3 - 2 * t);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
