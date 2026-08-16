import type { GigViewerReplay } from "../../events/types";
import { seededRandom } from "./SeededRandom";
import type { StoryModel } from "./StoryEngine";
import { buildDemandWeights } from "./VenueActivity";
import type { VenueSceneDescriptor } from "./VenueSceneRegistry";
import type { Point, Size } from "./Viewport";

/**
 * Deterministic toilet trips. Fans slip out of the crowd before the show,
 * between songs and during the weaker songs, queue at the washrooms and walk
 * back to a different spot in the room. Presentation only — no facts are
 * derived from or written back to the replay.
 */
export type ToiletState = "watching" | "walking" | "queueing" | "inside" | "returning";

export interface ToiletTrip {
  id: string;
  departureMs: number;
  walkMs: number;
  queueMs: number;
  insideMs: number;
  returnMs: number;
  origin: Point;
  queueSpot: Point;
  door: Point;
  returnSpot: Point;
  appearance: number;
}

export interface ToiletActivityPlan {
  trips: ToiletTrip[];
  door: Point;
  queueAnchor: Point;
}

export interface ToiletActor {
  id: string;
  state: ToiletState;
  position: Point;
  appearance: number;
}

const CAPS: Record<VenueSceneDescriptor["archetype"], number> = {
  pub: 2,
  club: 4,
  theatre: 5,
  arena: 7,
  stadium: 9,
  festival: 8,
  beach: 3,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function buildToiletActivityPlan({
  replay,
  story,
  scene,
  size,
  displayedCrowd,
}: {
  replay: GigViewerReplay;
  story: StoryModel;
  scene: VenueSceneDescriptor;
  size: Size;
  displayedCrowd: number;
}): ToiletActivityPlan {
  const seed = `${replay.simulationSeed || replay.gigId || replay.id}:toilets-v1`;
  const random = seededRandom(seed);
  const slot = scene.decorations.find((decoration) => decoration.kind === "toilet")
    ?? scene.exteriorSlots.find((decoration) => decoration.kind === "toilet")
    ?? null;
  const normalisedDoor: Point = slot
    ? { x: slot.bounds.x + slot.bounds.width / 2, y: slot.bounds.y + slot.bounds.height }
    : scene.exits[0]
      ? { x: scene.exits[0].x, y: scene.exits[0].y }
      : { x: 0.94, y: 0.55 };
  const door: Point = { x: normalisedDoor.x * size.width, y: normalisedDoor.y * size.height };
  const towardsRoom: Point = { x: size.width * 0.5, y: size.height * 0.72 };
  const queueAnchor = lerp(door, towardsRoom, 0.12);

  const zones = scene.crowdZones.length ? scene.crowdZones : [{ x: 0.25, y: 0.55, width: 0.5, height: 0.3 } as const];
  const crowdPoint = (rand: () => number): Point => {
    const zone = zones[Math.floor(rand() * zones.length) % zones.length];
    return {
      x: (zone.x + zone.width * (0.12 + rand() * 0.76)) * size.width,
      y: (zone.y + zone.height * (0.15 + rand() * 0.7)) * size.height,
    };
  };

  const count = Math.max(0, Math.min(CAPS[scene.archetype], Math.floor(displayedCrowd / 14)));
  const weights = buildDemandWeights(replay, story);
  const bucketSize = Math.max(1, replay.durationMs / weights.length);
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const cycleMs = 16_500;

  const trips: ToiletTrip[] = Array.from({ length: count }, (_, index) => {
    const tripRandom = seededRandom(`${seed}:${index}`);
    let target = total * ((index + 0.5) / Math.max(1, count));
    let bucket = 0;
    for (let i = 0; i < weights.length; i += 1) {
      target -= weights[i];
      bucket = i;
      if (target <= 0) break;
    }
    const departureMs = Math.max(
      0,
      Math.min(bucket * bucketSize + tripRandom() * bucketSize, Math.max(0, replay.durationMs - cycleMs - 250)),
    );
    const queueSlotIndex = index % 4;
    return {
      id: `${seed}:trip:${index}`,
      departureMs,
      walkMs: 3_600,
      queueMs: 2_400 + queueSlotIndex * 900,
      insideMs: 3_200 + Math.floor(tripRandom() * 1_600),
      returnMs: 3_800,
      origin: crowdPoint(tripRandom),
      queueSpot: {
        x: queueAnchor.x + (towardsRoom.x - door.x) * 0.04 * queueSlotIndex,
        y: queueAnchor.y + (towardsRoom.y - door.y) * 0.04 * queueSlotIndex + (tripRandom() - 0.5) * 4,
      },
      door,
      returnSpot: crowdPoint(seededRandom(`${seed}:return:${index}`)),
      appearance: Math.floor(random() * 4),
    };
  });

  return { trips, door, queueAnchor };
}

export function deriveToiletActivity(plan: ToiletActivityPlan, positionMs: number): ToiletActor[] {
  return plan.trips.map((trip): ToiletActor => {
    const elapsed = positionMs - trip.departureMs;
    const queueEnd = trip.walkMs + trip.queueMs;
    const insideEnd = queueEnd + trip.insideMs;
    const end = insideEnd + trip.returnMs;
    if (elapsed < 0) return { id: trip.id, state: "watching", position: trip.origin, appearance: trip.appearance };
    if (elapsed >= end) return { id: trip.id, state: "watching", position: trip.returnSpot, appearance: trip.appearance };
    if (elapsed < trip.walkMs) {
      return {
        id: trip.id,
        state: "walking",
        position: lerp(trip.origin, trip.queueSpot, clamp01(elapsed / trip.walkMs)),
        appearance: trip.appearance,
      };
    }
    if (elapsed < queueEnd) {
      return { id: trip.id, state: "queueing", position: trip.queueSpot, appearance: trip.appearance };
    }
    if (elapsed < insideEnd) {
      return { id: trip.id, state: "inside", position: trip.door, appearance: trip.appearance };
    }
    return {
      id: trip.id,
      state: "returning",
      position: lerp(trip.door, trip.returnSpot, clamp01((elapsed - insideEnd) / trip.returnMs)),
      appearance: trip.appearance,
    };
  });
}

/** Small walking counters plus a queue marker at the washroom door. */
export function drawToiletActivity(
  ctx: CanvasRenderingContext2D,
  plan: ToiletActivityPlan,
  actors: ToiletActor[],
  positionMs: number,
  reducedMotion: boolean,
) {
  const active = actors.filter((actor) => actor.state !== "watching" && actor.state !== "inside");
  if (!active.length) return;
  ctx.save();
  active.forEach((actor, index) => {
    const bob = reducedMotion || actor.state === "queueing" ? 0 : Math.abs(Math.sin(positionMs / 150 + index)) * 1.4;
    const palette = ["#94a3b8", "#cbd5e1", "#a3a3a3", "#e2e8f0"][actor.appearance % 4];
    ctx.fillStyle = palette;
    ctx.beginPath();
    ctx.arc(actor.position.x, actor.position.y - bob, 3.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(15,23,42,.6)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  });
  if (active.some((actor) => actor.state === "queueing")) {
    ctx.fillStyle = "rgba(148, 163, 184, .5)";
    ctx.font = "bold 7px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("WC", plan.door.x, plan.door.y + 9);
    ctx.textAlign = "left";
  }
  ctx.restore();
}
