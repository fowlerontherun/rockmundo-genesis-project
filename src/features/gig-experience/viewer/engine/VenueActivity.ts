import type { GigViewerReplay } from "../../events/types";
import { seededRandom } from "./SeededRandom";
import type { StoryModel } from "./StoryEngine";
import type { ServicePoint, VenueSceneDescriptor } from "./VenueSceneRegistry";
import type { Point, Rect } from "./Viewport";

export type FanActivityState =
  | "watching_stage" | "walking_to_bar" | "queueing_at_bar" | "being_served_at_bar" | "returning_from_bar"
  | "walking_to_merchandise" | "browsing_merchandise" | "queueing_for_merchandise"
  | "being_served_at_merchandise" | "returning_from_merchandise";
export type ServiceKind = "bar" | "merchandise";
export type VenueStaffState = "idle" | "walking_to_customer" | "serving" | "walking_to_stock" | "restocking" | "returning_to_station";
/** Presentation evidence mode. `event_replay` is reserved for a future timestamped commerce schema. */
export type VenueActivityEvidenceMode = "ambient" | "aggregate" | "event_replay";

export interface VenueActivityVisit {
  id: string; actorId: string; service: ServiceKind; stationId: string; stationIndex: number;
  departureMs: number; walkMs: number; browseMs: number;
  queueMs: number; serviceMs: number; returnMs: number; queueSlot: number; origin: Point; destination: Point;
  /** Seeded crowd slot the fan settles into afterwards; deliberately different from `origin`. */
  returnDestination: Point;
  routeOut: Point[]; routeBack: Point[]; appearance: number; carriedItem: "cup" | "shirt" | "poster" | "bag";
}
export interface VenueStaffPlan {
  id: string; service: ServiceKind; stationId: string; stationIndex: number; staffIndex: number; bounds: Rect;
  appearance: number; cycleOffsetMs: number;
  homePosition: Point; servicePosition: Point; stockPosition: Point;
}
export interface VenueActivityPlan {
  seed: string; evidenceMode: VenueActivityEvidenceMode; visits: VenueActivityVisit[]; staff: VenueStaffPlan[];
  minimumWatchingFans: number; maximumActiveFans: number;
}
export interface VenueActivityActor {
  id: string; state: FanActivityState; position: Point; queueSlot: number | null; service: ServiceKind | null;
  progress: number; appearance: number; carriedItem: VenueActivityVisit["carriedItem"] | null;
}
export interface VenueStaffActor {
  id: string; service: ServiceKind; stationId: string; stationIndex: number; state: VenueStaffState; position: Point;
  progress: number; appearance: number; servingActorId: string | null;
}

const CAPS = { pub: 2, club: 4, theatre: 5, arena: 6, stadium: 8, festival: 8, beach: 4 } as const;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const inside = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
const validPoint = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
const validRoute = (route: Point[] | undefined, stage: Rect) => !!route && route.length >= 2 && route.every((p) => validPoint(p) && !inside(p, stage));
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const STAFF_IDLE_CYCLE_MS = 9_000;

function routePoint(route: Point[], progress: number, reducedMotion: boolean): Point {
  if (reducedMotion) return route[Math.min(route.length - 1, Math.floor(clamp01(progress) * route.length))];
  const scaled = clamp01(progress) * (route.length - 1); const index = Math.min(route.length - 2, Math.floor(scaled));
  return lerp(route[index], route[index + 1], scaled - index);
}

interface ActivityStation {
  id: string; service: ServiceKind; index: number; bounds: Rect;
  queuePoints: Point[]; staffPositions: Point[]; routeOut: Point[]; routeBack: Point[];
}

/** Prefers the authored distributed service points, falling back to the legacy single-fixture paths. */
function resolveStations(scene: VenueSceneDescriptor): ActivityStation[] {
  const routeById = new Map(scene.routes.map((route) => [route.id, route.waypoints.map((point) => ({ ...point }))] as const));
  const distributed = ([...(scene.bars ?? []), ...(scene.merchandiseStands ?? [])] as readonly ServicePoint[])
    .map((point, order): ActivityStation | null => {
      const out = routeById.get(point.approachRouteId);
      const back = routeById.get(point.returnRouteId);
      const queuePoints = point.queuePoints.map((p) => ({ ...p })).filter(validPoint);
      if (!queuePoints.length || !validRoute(out, scene.stage) || !validRoute(back, scene.stage)) return null;
      return {
        id: point.id, service: point.kind, index: order, bounds: { ...point.bounds },
        queuePoints, staffPositions: point.staffPositions.map((p) => ({ ...p })).filter(validPoint),
        routeOut: out!, routeBack: back!,
      };
    })
    .filter((station): station is ActivityStation => !!station && station.staffPositions.length > 0);
  if (distributed.length) {
    // Keep station indexes contiguous per service so staff/queue matching stays stable.
    const counters = { bar: 0, merchandise: 0 };
    return distributed.map((station) => ({ ...station, index: counters[station.service]++ }));
  }
  return (["bar", "merchandise"] as const).flatMap((service): ActivityStation[] => {
    const out = [...(service === "bar" ? scene.paths.crowdToBar : scene.paths.crowdToMerchandise)];
    const back = [...(service === "bar" ? scene.paths.barToCrowd : scene.paths.merchandiseToCrowd)];
    const queuePoints = scene.queuePoints[service].map((p) => ({ ...p })).filter(validPoint);
    if (!queuePoints.length || !validRoute(out, scene.stage) || !validRoute(back, scene.stage)) return [];
    const bounds = service === "bar" ? scene.bar : scene.merchandise;
    return [{
      id: `legacy:${service}`, service, index: 0, bounds: { ...bounds }, queuePoints,
      staffPositions: [{ ...scene.staffPositions[service] }], routeOut: out, routeBack: back,
    }];
  });
}

/**
 * Demand windows: fans leave the crowd before the show, between songs and during
 * comparatively weak songs, and stay put through highlights, the encore and the finale.
 */
function buildDemandWeights(replay: GigViewerReplay, story: StoryModel): number[] {
  const buckets = 96; const size = Math.max(1, replay.durationMs / buckets);
  const highlights = story.highlights.filter((h) => h.importance === "important" || h.importance === "critical").map((h) => h.offsetMs);
  const protectedFrom = Math.min(
    story.encoreEvent?.scheduledOffsetMs ?? Number.POSITIVE_INFINITY,
    story.finaleEvent?.scheduledOffsetMs ?? Number.POSITIVE_INFINITY,
    story.resultOffsetMs ?? Number.POSITIVE_INFINITY,
  );
  return Array.from({ length: buckets }, (_, index) => {
    const time = index * size + size / 2;
    const song = story.songs.find((candidate) => time >= candidate.startMs && time < candidate.endMs) ?? null;
    let weight = 1;
    if (!song) weight = time < (story.songs[0]?.startMs ?? 0) ? 3 : 2.4; // doors/between-set gaps
    else if (song.isWeakest) weight = 2.2;
    else if (song.isBest || song.isFinale || song.isTurningPoint) weight = .25;
    else weight = time >= song.peakStartMs ? .4 : 1;
    if (time >= protectedFrom) weight = Math.min(weight, .12);
    if (highlights.some((offset) => Math.abs(time - offset) < 3_500)) weight = Math.min(weight, .1);
    return weight;
  });
}

function scheduleDepartures(weights: number[], count: number, durationMs: number, cycleFor: (index: number) => number, random: () => number): number[] {
  const size = Math.max(1, durationMs / weights.length);
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const departures: number[] = [];
  for (let index = 0; index < count; index += 1) {
    // Even quantiles across the weighted timeline keep visits spread while honouring demand.
    let target = total * ((index + .5) / count); let bucket = 0;
    for (let i = 0; i < weights.length; i += 1) { target -= weights[i]; if (target <= 0) { bucket = i; break; } bucket = i; }
    const jittered = bucket * size + random() * size;
    const cycle = cycleFor(index);
    departures.push(Math.max(0, Math.min(jittered, Math.max(0, durationMs - cycle - 250))));
  }
  return departures;
}

function seededCrowdPoint(zones: VenueSceneDescriptor["crowdZones"], random: () => number, avoid: Point | null): Point {
  const candidates = zones.filter((zone) => !avoid || !inside(avoid, zone));
  const pool = candidates.length ? candidates : zones;
  if (!pool.length) return avoid ?? { x: .5, y: .7 };
  const zone = pool[Math.floor(random() * pool.length) % pool.length];
  return { x: zone.x + zone.width * (.15 + random() * .7), y: zone.y + zone.height * (.2 + random() * .6) };
}

/** Creates immutable visual-only visits. It has no service, inventory or finance dependencies. */
export function buildVenueActivityPlan(input: { replay: GigViewerReplay; story: StoryModel; scene: VenueSceneDescriptor; displayedCrowd: number }): VenueActivityPlan {
  const { replay, story, scene } = input;
  const seed = `${replay.simulationSeed || replay.gigId}:venue-activity-v2`;
  const random = seededRandom(seed);
  const settledCounts = replay.commerce ? { bar: Math.max(0, replay.commerce.bar.drinksServed), merchandise: Math.max(0, replay.commerce.merchandise.itemsSold) } : null;
  const evidenceMode: VenueActivityEvidenceMode = settledCounts ? "aggregate" : "ambient";
  const stations = resolveStations(scene).filter((station) => !settledCounts || settledCounts[station.service] > 0);
  const services = (["bar", "merchandise"] as const).filter((service) => stations.some((station) => station.service === service));
  const max = Math.min(CAPS[scene.archetype], Math.max(0, input.displayedCrowd - Math.max(4, Math.ceil(input.displayedCrowd * .55))));
  const slots = stations.reduce((sum, station) => sum + station.queuePoints.length, 0);
  const actorCount = Math.min(max, slots);
  const visits: VenueActivityVisit[] = [];
  const serviceVisits: ServiceKind[] = [];
  if (settledCounts && services.length) {
    const total = services.reduce((sum, service) => sum + settledCounts[service], 0);
    for (const service of services) {
      const capacity = stations.filter((station) => station.service === service).reduce((sum, station) => sum + station.queuePoints.length, 0);
      const proportional = Math.max(1, Math.round(actorCount * settledCounts[service] / Math.max(1, total)));
      for (let i = 0; i < Math.min(proportional, capacity); i += 1) serviceVisits.push(service);
    }
    while (serviceVisits.length > actorCount) serviceVisits.pop();
  } else {
    for (let i = 0; i < actorCount; i += 1) serviceVisits.push(services[i % Math.max(1, services.length)]);
  }

  const weights = buildDemandWeights(replay, story);
  const cycleFor = (index: number) => 12_500 + (index % 3) * 1_200;
  const departures = scheduleDepartures(weights, serviceVisits.length, replay.durationMs, cycleFor, seededRandom(`${seed}:departures`));
  const queueUse: Record<string, number> = {};
  const serviceUse = { bar: 0, merchandise: 0 };
  for (let index = 0; index < serviceVisits.length; index += 1) {
    const service = serviceVisits[index]; if (!service) break;
    const serviceStations = stations.filter((station) => station.service === service);
    // Round-robin across distributed stations so large venues never form one long queue.
    let station = serviceStations[serviceUse[service] % serviceStations.length];
    for (let attempt = 0; attempt < serviceStations.length; attempt += 1) {
      const candidate = serviceStations[(serviceUse[service] + attempt) % serviceStations.length];
      if ((queueUse[candidate.id] ?? 0) < candidate.queuePoints.length) { station = candidate; break; }
    }
    if ((queueUse[station.id] ?? 0) >= station.queuePoints.length) continue;
    serviceUse[service] += 1;
    const queueSlot = queueUse[station.id] ?? 0; queueUse[station.id] = queueSlot + 1;
    const actorId = `${seed}:fan:${index}`;
    const origin = station.routeOut[0];
    const destination = station.queuePoints[queueSlot];
    const returnDestination = seededCrowdPoint(scene.crowdZones, seededRandom(`${seed}:return:${index}`), origin);
    const mix = replay.commerce?.merchandise.lines ?? [];
    const mixTotal = mix.reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
    let merchCarry: VenueActivityVisit["carriedItem"] = "bag";
    if (service === "merchandise" && mixTotal > 0) {
      let choice = random() * mixTotal;
      const chosen = mix.find((item) => (choice -= Math.max(0, item.quantity)) <= 0) ?? mix[mix.length - 1];
      merchCarry = /shirt|hood|tee/i.test(chosen.itemType) ? "shirt" : /poster|print/i.test(chosen.itemType) ? "poster" : "bag";
    } else if (service === "merchandise" && !replay.commerce) merchCarry = (["shirt", "poster", "bag"] as const)[Math.floor(random() * 3)];
    visits.push({
      id: `${actorId}:visit:0`, actorId, service, stationId: station.id, stationIndex: station.index,
      departureMs: departures[index] ?? 0, walkMs: 3200,
      browseMs: service === "merchandise" ? 1200 + Math.floor(random() * 800) : 0,
      queueMs: 1500 + queueSlot * 750, serviceMs: 1400 + Math.floor(random() * 900), returnMs: 3200,
      queueSlot, origin, destination, returnDestination,
      routeOut: [...station.routeOut.slice(0, -1), destination],
      routeBack: [destination, ...station.routeBack.slice(1, -1), returnDestination],
      appearance: Math.floor(random() * 4), carriedItem: service === "bar" ? "cup" : merchCarry,
    });
  }

  const staff = stations.flatMap((station): VenueStaffPlan[] => station.staffPositions.map((position, staffIndex) => {
    const staffRandom = seededRandom(`${seed}:staff:${station.id}:${staffIndex}`);
    const queueHead = station.queuePoints[0] ?? position;
    return {
      id: `${seed}:staff:${station.id}:${staffIndex}`,
      service: station.service,
      stationId: station.id,
      stationIndex: station.index,
      staffIndex,
      bounds: station.bounds,
      appearance: Math.floor(staffRandom() * 4),
      cycleOffsetMs: Math.floor(staffRandom() * STAFF_IDLE_CYCLE_MS),
      homePosition: clampInto(position, station.bounds),
      servicePosition: clampInto(lerp(position, queueHead, .35), station.bounds),
      stockPosition: pointIn(station.bounds, staffIndex % 2 === 0 ? .2 : .8, .32),
    };
  }));

  return { seed, evidenceMode, visits, staff, minimumWatchingFans: Math.max(4, input.displayedCrowd - visits.length), maximumActiveFans: visits.length };
}

export function deriveVenueActivity(plan: VenueActivityPlan, positionMs: number, reducedMotion = false): VenueActivityActor[] {
  return plan.visits.map((visit): VenueActivityActor => {
    const elapsed = positionMs - visit.departureMs; const browseEnd = visit.walkMs + visit.browseMs; const queueEnd = browseEnd + visit.queueMs; const serviceEnd = queueEnd + visit.serviceMs; const end = serviceEnd + visit.returnMs;
    let state: FanActivityState = "watching_stage"; let position = elapsed >= end ? visit.returnDestination : visit.origin; let progress = 0; let carriedItem: VenueActivityActor["carriedItem"] = null;
    if (elapsed >= 0 && elapsed < visit.walkMs) { state = visit.service === "bar" ? "walking_to_bar" : "walking_to_merchandise"; progress = elapsed / visit.walkMs; position = routePoint(visit.routeOut, progress, reducedMotion); }
    else if (elapsed >= visit.walkMs && elapsed < browseEnd) { state = "browsing_merchandise"; position = visit.destination; progress = (elapsed - visit.walkMs) / Math.max(1, visit.browseMs); }
    else if (elapsed >= browseEnd && elapsed < queueEnd) { state = visit.service === "bar" ? "queueing_at_bar" : "queueing_for_merchandise"; position = visit.destination; progress = (elapsed - browseEnd) / visit.queueMs; }
    else if (elapsed >= queueEnd && elapsed < serviceEnd) { state = visit.service === "bar" ? "being_served_at_bar" : "being_served_at_merchandise"; position = visit.destination; progress = (elapsed - queueEnd) / visit.serviceMs; }
    else if (elapsed >= serviceEnd && elapsed < end) { state = visit.service === "bar" ? "returning_from_bar" : "returning_from_merchandise"; progress = (elapsed - serviceEnd) / visit.returnMs; position = routePoint(visit.routeBack, progress, reducedMotion); carriedItem = visit.carriedItem; }
    return { id: visit.actorId, state, position, queueSlot: state.includes("queueing") || state.includes("served") ? visit.queueSlot : null, service: state === "watching_stage" ? null : visit.service, progress: clamp01(progress), appearance: visit.appearance, carriedItem };
  });
}

/** Reconstructs service-staff movement directly from playback time and visit facts. */
export function deriveVenueStaffActivity(plan: VenueActivityPlan, positionMs: number, reducedMotion = false): VenueStaffActor[] {
  return plan.staff.map((staff) => {
    const stationStaffCount = plan.staff.filter((candidate) => candidate.stationId === staff.stationId).length;
    const visit = plan.visits.find((candidate) => {
      if (candidate.stationId !== staff.stationId || candidate.queueSlot % Math.max(1, stationStaffCount) !== staff.staffIndex) return false;
      const serviceStart = candidate.departureMs + candidate.walkMs + candidate.browseMs + candidate.queueMs;
      return positionMs >= serviceStart && positionMs < serviceStart + candidate.serviceMs;
    });

    if (visit) return deriveServingStaff(staff, visit, positionMs, reducedMotion);
    return deriveIdleStaff(staff, positionMs, reducedMotion);
  });
}

function deriveServingStaff(staff: VenueStaffPlan, visit: VenueActivityVisit, positionMs: number, reducedMotion: boolean): VenueStaffActor {
  const serviceStart = visit.departureMs + visit.walkMs + visit.browseMs + visit.queueMs;
  const serviceProgress = clamp01((positionMs - serviceStart) / Math.max(1, visit.serviceMs));
  if (serviceProgress < .22) {
    const progress = serviceProgress / .22;
    return staffActor(staff, "walking_to_customer", staffPosition(staff.homePosition, staff.servicePosition, progress, reducedMotion), progress, visit.actorId);
  }
  if (serviceProgress < .82) {
    const progress = (serviceProgress - .22) / .6;
    return staffActor(staff, "serving", staff.servicePosition, progress, visit.actorId);
  }
  const progress = (serviceProgress - .82) / .18;
  return staffActor(staff, "returning_to_station", staffPosition(staff.servicePosition, staff.homePosition, progress, reducedMotion), progress, visit.actorId);
}

function deriveIdleStaff(staff: VenueStaffPlan, positionMs: number, reducedMotion: boolean): VenueStaffActor {
  const phase = ((Math.max(0, positionMs) + staff.cycleOffsetMs) % STAFF_IDLE_CYCLE_MS) / STAFF_IDLE_CYCLE_MS;
  if (phase < .32 || phase >= .82) return staffActor(staff, "idle", staff.homePosition, phase < .32 ? phase / .32 : (phase - .82) / .18);
  if (phase < .46) {
    const progress = (phase - .32) / .14;
    return staffActor(staff, "walking_to_stock", staffPosition(staff.homePosition, staff.stockPosition, progress, reducedMotion), progress);
  }
  if (phase < .68) return staffActor(staff, "restocking", staff.stockPosition, (phase - .46) / .22);
  const progress = (phase - .68) / .14;
  return staffActor(staff, "returning_to_station", staffPosition(staff.stockPosition, staff.homePosition, progress, reducedMotion), progress);
}

function staffActor(
  staff: VenueStaffPlan,
  state: VenueStaffState,
  position: Point,
  progress: number,
  servingActorId: string | null = null,
): VenueStaffActor {
  return { id: staff.id, service: staff.service, stationId: staff.stationId, stationIndex: staff.stationIndex, state, position, progress: clamp01(progress), appearance: staff.appearance, servingActorId };
}

function staffPosition(from: Point, to: Point, progress: number, reducedMotion: boolean): Point {
  if (!reducedMotion) return lerp(from, to, clamp01(progress));
  return progress < .5 ? from : to;
}

function pointIn(bounds: Rect, x: number, y: number): Point {
  return { x: bounds.x + bounds.width * x, y: bounds.y + bounds.height * y };
}

function clampInto(point: Point, bounds: Rect): Point {
  return {
    x: Math.max(bounds.x + bounds.width * .08, Math.min(bounds.x + bounds.width * .92, point.x)),
    y: Math.max(bounds.y + bounds.height * .08, Math.min(bounds.y + bounds.height * .92, point.y)),
  };
}
