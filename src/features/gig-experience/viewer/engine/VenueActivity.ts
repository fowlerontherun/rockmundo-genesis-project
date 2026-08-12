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

export interface VenueActivityVisit {
  id: string; actorId: string; service: ServiceKind; departureMs: number; walkMs: number; browseMs: number;
  queueMs: number; serviceMs: number; returnMs: number; queueSlot: number; origin: Point; destination: Point;
  routeOut: Point[]; routeBack: Point[]; appearance: number; carriedItem: "cup" | "shirt" | "poster" | "bag";
}
export interface VenueActivityPlan {
  seed: string; visits: VenueActivityVisit[]; staff: Array<{ id: string; service: ServiceKind; position: Point; appearance: number }>;
  minimumWatchingFans: number; maximumActiveFans: number;
}
export interface VenueActivityActor {
  id: string; state: FanActivityState; position: Point; queueSlot: number | null; service: ServiceKind | null;
  progress: number; appearance: number; carriedItem: VenueActivityVisit["carriedItem"] | null;
}

const CAPS = { pub: 2, club: 4, theatre: 5, arena: 6, stadium: 8, festival: 8, beach: 4 } as const;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const inside = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
const validPoint = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
const validRoute = (route: Point[] | undefined, stage: Rect) => !!route && route.length >= 2 && route.every((p) => validPoint(p) && !inside(p, stage));
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function routePoint(route: Point[], progress: number, reducedMotion: boolean): Point {
  if (reducedMotion) return route[Math.min(route.length - 1, Math.floor(clamp01(progress) * route.length))];
  const scaled = clamp01(progress) * (route.length - 1); const index = Math.min(route.length - 2, Math.floor(scaled));
  return lerp(route[index], route[index + 1], scaled - index);
}

/** Creates immutable visual-only visits. It has no service, inventory or finance dependencies. */
export function buildVenueActivityPlan(input: { replay: GigViewerReplay; story: StoryModel; scene: VenueSceneLayout; displayedCrowd: number }): VenueActivityPlan {
  const { replay, story, scene } = input; const seed = `${replay.simulationSeed || replay.gigId}:venue-activity-v1`; const random = seededRandom(seed);
  const services = (["bar", "merchandise"] as const).filter((service) => {
    const out = service === "bar" ? scene.paths.crowdToBar : scene.paths.crowdToMerchandise;
    const back = service === "bar" ? scene.paths.barToCrowd : scene.paths.merchandiseToCrowd;
    return scene.queuePoints[service].some(validPoint) && validRoute(out, scene.stage) && validRoute(back, scene.stage);
  });
  const max = Math.min(CAPS[scene.archetype], Math.max(0, input.displayedCrowd - Math.max(4, Math.ceil(input.displayedCrowd * .55))));
  const slots = services.reduce((sum, service) => sum + scene.queuePoints[service].length, 0);
  const actorCount = Math.min(max, slots); const visits: VenueActivityVisit[] = [];
  const highlights = story.highlights.filter((h) => h.importance === "important" || h.importance === "critical").map((h) => h.offsetMs);
  for (let index = 0; index < actorCount; index += 1) {
    const service = services[index % Math.max(1, services.length)]; if (!service) break;
    const queueSlot = Math.floor(index / services.length) % scene.queuePoints[service].length;
    const routeOut = service === "bar" ? scene.paths.crowdToBar : scene.paths.crowdToMerchandise;
    const routeBack = service === "bar" ? scene.paths.barToCrowd : scene.paths.merchandiseToCrowd;
    const actorId = `${seed}:fan:${index}`; const cycle = 12500 + index * 2100;
    let departureMs = 2500 + index * 1250 + Math.floor(random() * 900);
    // Important moments keep watching fans in the crowd; departures move just beyond the highlight window.
    for (const highlight of highlights) if (Math.abs(departureMs - highlight) < 3500) departureMs = highlight + 3600;
    if (departureMs + cycle >= replay.durationMs) departureMs = Math.max(0, replay.durationMs - cycle - 250);
    const origin = routeOut[0]; const destination = scene.queuePoints[service][queueSlot];
    visits.push({ id: `${actorId}:visit:0`, actorId, service, departureMs, walkMs: 3200, browseMs: service === "merchandise" ? 1200 + Math.floor(random() * 800) : 0, queueMs: 1500 + queueSlot * 750, serviceMs: 1400 + Math.floor(random() * 900), returnMs: 3200, queueSlot, origin, destination, routeOut: [...routeOut.slice(0, -1), destination], routeBack: [destination, ...routeBack.slice(1)], appearance: Math.floor(random() * 4), carriedItem: service === "bar" ? "cup" : (["shirt", "poster", "bag"] as const)[Math.floor(random() * 3)] });
  }
  const staff = services.flatMap((service) => Array.from({ length: scene.archetype === "stadium" || scene.archetype === "festival" ? 2 : 1 }, (_, index) => ({ id: `${seed}:staff:${service}:${index}`, service, position: scene.staffPositions[service], appearance: index })));
  return { seed, visits, staff, minimumWatchingFans: Math.max(4, input.displayedCrowd - actorCount), maximumActiveFans: actorCount };
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
