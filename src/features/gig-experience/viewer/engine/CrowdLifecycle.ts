import type { GigViewerReplay } from "../../events/types";
import type { Point, Rect, Size } from "./Viewport";
import { pointInRect } from "./Viewport";
import type { ScaledVenuePreset } from "./VenueLayout";
import { selectVenuePreset, scaleVenuePreset } from "./VenueLayout";

export type CrowdEntityState = "queued" | "entering" | "moving_to_zone" | "settling" | "waiting";
export interface CrowdEntity { id: string; seedIndex: number; weight: number; entranceId: string; targetZoneId: string; x: number; y: number; start: Point; waypoint: Point; target: Point; spawnOffsetMs: number; travelMs: number; speed: number; state: CrowdEntityState; radius: number; idlePhase: number; visible: boolean }
export interface CrowdMilestone { key: string; label: string; progress: number; reached: boolean }
export interface CrowdState { entities: CrowdEntity[]; attendance: number; capacity: number; cap: number; fillProgress: number; phaseLabel: string; occupiedZones: string[]; milestones: CrowdMilestone[]; diagnostics: { entityCount: number; movingCount: number; settledCount: number } }
export interface CrowdLayoutPlan { baseEntities: CrowdEntity[]; attendance: number; capacity: number; cap: number; entryStartMs: number; entryEndMs: number; milestones: CrowdMilestone[] }

export const CROWD_ENTITY_CAPS = { reducedMotion: 40, mobileLow: 60, mobileDefault: 100, tablet: 140, desktopDefault: 200, desktopHigh: 300 } as const;

export function selectCrowdEntityCap({ reducedMotion, width, devicePixelRatio = 1, attendanceRatio = 0, highPerformance = false }: { reducedMotion: boolean; width: number; devicePixelRatio?: number; attendanceRatio?: number; highPerformance?: boolean }) {
  if (reducedMotion) return CROWD_ENTITY_CAPS.reducedMotion;
  if (width < 420 || devicePixelRatio > 2.75) return CROWD_ENTITY_CAPS.mobileLow;
  if (width < 760) return CROWD_ENTITY_CAPS.mobileDefault;
  if (width < 1024) return CROWD_ENTITY_CAPS.tablet;
  return highPerformance && attendanceRatio > .85 ? CROWD_ENTITY_CAPS.desktopHigh : CROWD_ENTITY_CAPS.desktopDefault;
}

export function representedWeights(attendance: number, cap: number): number[] {
  const total = Math.max(0, Math.floor(attendance)); const count = Math.min(Math.max(0, Math.floor(cap)), total);
  if (count === 0) return [];
  const base = Math.floor(total / count); const remainder = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i >= count - remainder ? 1 : 0));
}

export function buildCrowdPlan({ replay, attendance, capacity, size, reducedMotion = false, devicePixelRatio = 1 }: { replay: GigViewerReplay; attendance: number; capacity: number; size: Size; reducedMotion?: boolean; devicePixelRatio?: number }): CrowdLayoutPlan {
  const safeAttendance = Math.max(0, Math.floor(Number.isFinite(attendance) ? attendance : 0));
  const safeCapacity = Math.max(0, Math.floor(Number.isFinite(capacity) ? capacity : 0));
  const ratio = safeCapacity > 0 ? Math.min(1, safeAttendance / safeCapacity) : 0;
  const cap = selectCrowdEntityCap({ reducedMotion, width: size.width, devicePixelRatio, attendanceRatio: ratio, highPerformance: false });
  const preset = scaleVenuePreset(selectVenuePreset({ capacity: safeCapacity }), size);
  const weights = representedWeights(safeAttendance, cap);
  const entryStartMs = findEventOffset(replay, "venue_open", 0);
  const crowdFill = replay.events.filter((e) => e.visualPayload.type === "crowd_fill");
  const firstSong = replay.events.find((e) => e.visualPayload.type === "song_start")?.scheduledOffsetMs;
  const lastFillEnd = crowdFill.reduce((m, e) => Math.max(m, e.scheduledOffsetMs + Math.max(1000, e.durationMs || 0)), entryStartMs + 9000);
  const entryEndMs = Math.max(entryStartMs + 4000, Math.min(firstSong ?? lastFillEnd, Math.max(lastFillEnd, entryStartMs + 9000)));
  const rand = deterministicRandom(`${replay.simulationSeed}:crowd-entry:${preset.name}:${Math.round(size.width)}x${Math.round(size.height)}`);
  const zones = splitZones(preset.crowdZones, ratio);
  const baseEntities = weights.map((weight, i) => {
    const entranceIndex = weightedIndex(i, preset.entrances.length || 1, replay.simulationSeed);
    const entrance = preset.entrances[entranceIndex] ?? fallbackEntrance(preset.audience);
    const start = boundedEntrancePoint(entrance, preset.audience, rand, i);
    const zone = zones[Math.min(zones.length - 1, Math.floor((i / Math.max(1, weights.length)) * zones.length))] ?? { id: "front-centre", rect: preset.audience };
    const target = deterministicPointIn(zone.rect, rand, i);
    const waypoint = { x: start.x + (target.x - start.x) * .45, y: Math.max(preset.audience.y + 8, start.y + (target.y - start.y) * .35) };
    const stagger = weights.length <= 1 ? 0 : i / (weights.length - 1);
    const spawnOffsetMs = entryStartMs + stagger * Math.max(1, entryEndMs - entryStartMs) * .72;
    const travelMs = reducedMotion ? 0 : 2400 + rand() * 2200;
    return { id: `crowd-${i}`, seedIndex: i, weight, entranceId: `entrance-${entranceIndex}`, targetZoneId: zone.id, x: start.x, y: start.y, start, waypoint, target, spawnOffsetMs, travelMs, speed: travelMs ? distance(start, target) / travelMs : 0, state: "queued" as CrowdEntityState, radius: Math.max(2.5, Math.min(5.5, 2.5 + Math.sqrt(weight) * .18)), idlePhase: rand() * Math.PI * 2, visible: false };
  });
  return { baseEntities, attendance: safeAttendance, capacity: safeCapacity, cap, entryStartMs, entryEndMs, milestones: milestoneTemplates() };
}

export function reconstructCrowdState(plan: CrowdLayoutPlan, positionMs: number, reducedMotion = false): CrowdState {
  const pos = Math.max(0, positionMs); const entrySpan = Math.max(1, plan.entryEndMs - plan.entryStartMs);
  const fillProgress = plan.baseEntities.length ? Math.min(1, Math.max(0, (pos - plan.entryStartMs) / entrySpan)) : 0;
  const entities = plan.baseEntities.map((e) => projectEntity(e, pos, reducedMotion));
  const visible = entities.filter((e) => e.visible); const settled = visible.filter((e) => e.state === "waiting").length;
  const moving = visible.filter((e) => e.state !== "waiting").length;
  const zoneSet = new Set(visible.filter((e) => e.state === "waiting" || e.state === "settling").map((e) => e.targetZoneId));
  const phaseLabel = plan.attendance <= 0 ? "No audience attendance recorded." : fillProgress <= 0 ? "Doors are open." : fillProgress < .25 ? "The first fans are entering." : fillProgress < .75 ? "The venue is filling." : settled < plan.baseEntities.length ? "The audience is settling." : "The audience has settled before the band enters.";
  return { entities, attendance: plan.attendance, capacity: plan.capacity, cap: plan.cap, fillProgress, phaseLabel, occupiedZones: [...zoneSet], milestones: plan.milestones.map((m) => ({ ...m, reached: fillProgress >= m.progress })), diagnostics: { entityCount: entities.length, movingCount: moving, settledCount: settled } };
}

function hashSeed(seed: string) { let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function deterministicRandom(seed: string) { let s = hashSeed(seed); return () => { let t = s += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function projectEntity(e: CrowdEntity, pos: number, reducedMotion: boolean): CrowdEntity { if (reducedMotion) { const visible = pos >= e.spawnOffsetMs; return { ...e, x: e.target.x, y: e.target.y, state: visible ? "waiting" : "queued", visible }; } if (pos < e.spawnOffsetMs) return { ...e, x: e.start.x, y: e.start.y, state: "queued", visible: false }; const t = Math.min(1, (pos - e.spawnOffsetMs) / Math.max(1, e.travelMs)); const p = t < .35 ? lerp(e.start, e.waypoint, ease(t / .35)) : lerp(e.waypoint, e.target, ease((t - .35) / .65)); const state = t < .18 ? "entering" : t < .92 ? "moving_to_zone" : t < 1 ? "settling" : "waiting"; const idle = state === "waiting" ? Math.sin(pos / 950 + e.idlePhase) * 1.2 : 0; return { ...e, x: p.x + idle, y: p.y, state, visible: true }; }
function splitZones(zones: Rect[], ratio: number) { const source = zones.length ? zones : [{ x: 0, y: 0, width: 1, height: 1 }]; const parts = source.flatMap((z, zi) => ["centre", "left", "right"].map((part, pi) => ({ id: `${zi === 0 ? "front" : zi === 1 ? "middle" : "rear"}-${part}`, rect: thirdRect(z, pi) }))); const count = ratio < .25 ? Math.min(3, parts.length) : ratio < .65 ? Math.min(5, parts.length) : parts.length; return parts.slice(0, Math.max(1, count)); }
function thirdRect(r: Rect, part: number): Rect { if (part === 0) return { x: r.x + r.width * .25, y: r.y, width: r.width * .5, height: r.height }; if (part === 1) return { x: r.x, y: r.y, width: r.width * .28, height: r.height }; return { x: r.x + r.width * .72, y: r.y, width: r.width * .28, height: r.height }; }
function deterministicPointIn(rect: Rect, rand: () => number, i: number): Point { const cols = Math.max(3, Math.ceil(Math.sqrt(i + 7))); const rows = cols; const col = i % cols; const row = Math.floor(i / cols) % rows; return { x: rect.x + ((col + .35 + rand() * .3) / cols) * rect.width, y: rect.y + ((row + .35 + rand() * .3) / rows) * rect.height }; }
function boundedEntrancePoint(entrance: Point, audience: Rect, rand: () => number, i: number): Point { const spread = 18; const p = { x: entrance.x + (rand() - .5) * spread + ((i % 5) - 2) * 2, y: entrance.y + (rand() - .5) * 10 }; return pointInRect(p, audience) ? p : { x: Math.min(audience.x + audience.width - 8, Math.max(audience.x + 8, p.x)), y: Math.min(audience.y + audience.height - 8, Math.max(audience.y + 8, p.y)) }; }
function fallbackEntrance(audience: Rect): Point { return { x: audience.x + audience.width / 2, y: audience.y + audience.height - 8 }; }
function weightedIndex(i: number, count: number, seed: string) { return Math.abs((i * 1103515245 + seed.length * 97) % Math.max(1, count)); }
function findEventOffset(replay: GigViewerReplay, type: string, fallback: number) { return replay.events.find((e) => e.visualPayload.type === type)?.scheduledOffsetMs ?? fallback; }
function milestoneTemplates(): CrowdMilestone[] { return [{ key: "doors", label: "Doors are open.", progress: 0, reached: false }, { key: "first", label: "The first fans are entering.", progress: .05, reached: false }, { key: "quarter", label: "The venue is one quarter full.", progress: .25, reached: false }, { key: "half", label: "The venue is half full.", progress: .5, reached: false }, { key: "three-quarter", label: "The venue is three quarters full.", progress: .75, reached: false }, { key: "full", label: "Target attendance has arrived.", progress: 1, reached: false }]; }
function lerp(a: Point, b: Point, t: number): Point { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
function ease(t: number) { return t * t * (3 - 2 * t); }
function distance(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y); }
