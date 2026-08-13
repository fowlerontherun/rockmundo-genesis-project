import type { GigViewerReplay } from "../../events/types";
import { seededRandom } from "./SeededRandom";
import type { StoryModel } from "./StoryEngine";
import type { VenueSceneLayout } from "./VenueSceneRegistry";
import type { Point, Rect } from "./Viewport";

export type FanActivityState =
  | "watching_stage" | "walking_to_bar" | "queueing_at_bar" | "being_served_at_bar" | "returning_from_bar"
  | "walking_to_merchandise" | "browsing_merchandise" | "queueing_for_merchandise"
  | "being_served_at_merchandise" | "returning_from_merchandise";
export type ServiceKind = "bar" | "merchandise";
export type VenueStaffState = "idle" | "walking_to_customer" | "serving" | "walking_to_stock" | "restocking" | "returning_to_station";

export interface VenueActivityVisit {
  id: string; actorId: string; service: ServiceKind; departureMs: number; walkMs: number; browseMs: number;
  queueMs: number; serviceMs: number; returnMs: number; queueSlot: number; origin: Point; destination: Point;
  routeOut: Point[]; routeBack: Point[]; appearance: number; carriedItem: "cup" | "shirt" | "poster" | "bag";
}
export interface VenueStaffPlan {
  id: string; service: ServiceKind; stationIndex: number; appearance: number; cycleOffsetMs: number;
  homePosition: Point; servicePosition: Point; stockPosition: Point;
}
export interface VenueActivityPlan {
  seed: string; visits: VenueActivityVisit[]; staff: VenueStaffPlan[];
  minimumWatchingFans: number; maximumActiveFans: number;
}
export interface VenueActivityActor {
  id: string; state: FanActivityState; position: Point; queueSlot: number | null; service: ServiceKind | null;
  progress: number; appearance: number; carriedItem: VenueActivityVisit["carriedItem"] | null;
}
export interface VenueStaffActor {
  id: string; service: ServiceKind; stationIndex: number; state: VenueStaffState; position: Point;
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

/** Creates immutable visual-only visits. It has no service, inventory or finance dependencies. */
export function buildVenueActivityPlan(input: { replay: GigViewerReplay; story: StoryModel; scene: VenueSceneLayout; displayedCrowd: number }): VenueActivityPlan {
  const { replay, story, scene } = input; const seed = `${replay.simulationSeed || replay.gigId}:venue-activity-v1`; const random = seededRandom(seed);
  const settledCounts = replay.commerce ? { bar: Math.max(0, replay.commerce.bar.drinksServed), merchandise: Math.max(0, replay.commerce.merchandise.itemsSold) } : null;
  const services = (["bar", "merchandise"] as const).filter((service) => {
    const out = service === "bar" ? scene.paths.crowdToBar : scene.paths.crowdToMerchandise;
    const back = service === "bar" ? scene.paths.barToCrowd : scene.paths.merchandiseToCrowd;
    return (!settledCounts || settledCounts[service] > 0) && scene.queuePoints[service].some(validPoint) && validRoute(out, scene.stage) && validRoute(back, scene.stage);
  });
  const max = Math.min(CAPS[scene.archetype], Math.max(0, input.displayedCrowd - Math.max(4, Math.ceil(input.displayedCrowd * .55))));
  const slots = services.reduce((sum, service) => sum + scene.queuePoints[service].length, 0);
  const actorCount = Math.min(max, slots); const visits: VenueActivityVisit[] = [];
  const highlights = story.highlights.filter((h) => h.importance === "important" || h.importance === "critical").map((h) => h.offsetMs);
  const serviceVisits: ServiceKind[] = [];
  if (settledCounts && services.length) {
    const total = services.reduce((sum, service) => sum + settledCounts[service], 0);
    for (const service of services) {
      const proportional = Math.max(1, Math.round(actorCount * settledCounts[service] / Math.max(1, total)));
      for (let i = 0; i < Math.min(proportional, scene.queuePoints[service].length); i += 1) serviceVisits.push(service);
    }
    while (serviceVisits.length > actorCount) serviceVisits.pop();
  } else {
    for (let i = 0; i < actorCount; i += 1) serviceVisits.push(services[i % Math.max(1, services.length)]);
  }
  const queueUse = { bar: 0, merchandise: 0 };
  for (let index = 0; index < serviceVisits.length; index += 1) {
    const service = serviceVisits[index]; if (!service) break;
    const queueSlot = queueUse[service]++;
    const routeOut = service === "bar" ? scene.paths.crowdToBar : scene.paths.crowdToMerchandise;
    const routeBack = service === "bar" ? scene.paths.barToCrowd : scene.paths.merchandiseToCrowd;
    const actorId = `${seed}:fan:${index}`; const cycle = 12500 + (index % 3) * 1200;
    // Evenly span the authoritative playback clock, rather than exhausting all
    // visits during the opening song. Jitter is seeded and bounded to its slot.
    const slotStart = replay.durationMs * ((index + .35) / Math.max(1, actorCount));
    let departureMs = Math.floor(slotStart + (random() - .5) * Math.min(2400, replay.durationMs / Math.max(2, actorCount * 3)));
    // Important moments keep watching fans in the crowd; departures move just beyond the highlight window.
    for (const highlight of highlights) if (Math.abs(departureMs - highlight) < 3500) departureMs = highlight + 3600;
    if (departureMs + cycle >= replay.durationMs) departureMs = Math.max(0, replay.durationMs - cycle - 250);
    const origin = routeOut[0]; const destination = scene.queuePoints[service][queueSlot];
    const mix = replay.commerce?.merchandise.lines ?? [];
    const mixTotal = mix.reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
    let merchCarry: VenueActivityVisit["carriedItem"] = "bag";
    if (service === "merchandise" && mixTotal > 0) {
      let choice = random() * mixTotal;
      const chosen = mix.find((item) => (choice -= Math.max(0, item.quantity)) <= 0) ?? mix[mix.length - 1];
      merchCarry = /shirt|hood|tee/i.test(chosen.itemType) ? "shirt" : /poster|print/i.test(chosen.itemType) ? "poster" : "bag";
    } else if (service === "merchandise" && !replay.commerce) merchCarry = (["shirt", "poster", "bag"] as const)[Math.floor(random() * 3)];
    visits.push({ id: `${actorId}:visit:0`, actorId, service, departureMs, walkMs: 3200, browseMs: service === "merchandise" ? 1200 + Math.floor(random() * 800) : 0, queueMs: 1500 + queueSlot * 750, serviceMs: 1400 + Math.floor(random() * 900), returnMs: 3200, queueSlot, origin, destination, routeOut: [...routeOut.slice(0, -1), destination], routeBack: [destination, ...routeBack.slice(1)], appearance: Math.floor(random() * 4), carriedItem: service === "bar" ? "cup" : merchCarry });
  }
  const staff = services.flatMap((service): VenueStaffPlan[] => {
    const bounds = service === "bar" ? scene.bar : scene.merchandise;
    const count = scene.archetype === "stadium" || scene.archetype === "festival" ? 2 : 1;
    return Array.from({ length: count }, (_, index) => {
      const stationX = count === 1 ? .5 : .36 + index * .28;
      const stockX = index % 2 === 0 ? .18 : .82;
      const staffRandom = seededRandom(`${seed}:staff:${service}:${index}`);
      return {
        id: `${seed}:staff:${service}:${index}`,
        service,
        stationIndex: index,
        appearance: Math.floor(staffRandom() * 4),
        cycleOffsetMs: Math.floor(staffRandom() * STAFF_IDLE_CYCLE_MS),
        homePosition: pointIn(bounds, stationX, .62),
        servicePosition: pointIn(bounds, stationX, .68),
        stockPosition: pointIn(bounds, stockX, .42),
      };
    });
  });
  return { seed, visits, staff, minimumWatchingFans: Math.max(4, input.displayedCrowd - visits.length), maximumActiveFans: visits.length };
}

export function deriveVenueActivity(plan: VenueActivityPlan, positionMs: number, reducedMotion = false): VenueActivityActor[] {
  return plan.visits.map((visit): VenueActivityActor => {
    const elapsed = positionMs - visit.departureMs; const browseEnd = visit.walkMs + visit.browseMs; const queueEnd = browseEnd + visit.queueMs; const serviceEnd = queueEnd + visit.serviceMs; const end = serviceEnd + visit.returnMs;
    let state: FanActivityState = "watching_stage"; let position = visit.origin; let progress = 0; let carriedItem: VenueActivityActor["carriedItem"] = null;
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
    const serviceStaffCount = plan.staff.filter((candidate) => candidate.service === staff.service).length;
    const visit = plan.visits.find((candidate) => {
      if (candidate.service !== staff.service || candidate.queueSlot % Math.max(1, serviceStaffCount) !== staff.stationIndex) return false;
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
  return { id: staff.id, service: staff.service, stationIndex: staff.stationIndex, state, position, progress: clamp01(progress), appearance: staff.appearance, servingActorId };
}

function staffPosition(from: Point, to: Point, progress: number, reducedMotion: boolean): Point {
  if (!reducedMotion) return lerp(from, to, clamp01(progress));
  return progress < .5 ? from : to;
}

function pointIn(bounds: Rect, x: number, y: number): Point {
  return { x: bounds.x + bounds.width * x, y: bounds.y + bounds.height * y };
}
