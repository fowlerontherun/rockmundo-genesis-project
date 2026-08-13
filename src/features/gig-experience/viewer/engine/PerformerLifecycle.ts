import type { GigViewerEvent, GigViewerReplay, StagePosition } from "../../events/types";
import type { GigExperienceDTO } from "../../types";
import type { Point, Rect, Size } from "./Viewport";
import { selectVenuePreset, scaleVenuePreset } from "./VenueLayout";
import { deterministicRandom } from "./EntityLayout";

export type PresentationRole = "vocalist" | "lead_guitar" | "rhythm_guitar" | "guitar" | "bass" | "drums" | "keyboard" | "piano" | "dj" | "electronic" | "backing_vocals" | "strings" | "brass" | "percussion" | "other" | "unknown";
export type PerformerLifecycleState = "waiting_backstage" | "entering" | "taking_position" | "performing" | "exiting" | "hidden";
export type PerformerMoveStyle = "walk" | "step_forward" | "return_to_position" | "rush" | "hold";
export interface PerformerInput { id: string; profileId: string | null; displayName: string; roleOrInstrument: string | null; performerType: string }
export interface MovementZone { x: number; y: number; width: number; height: number; radius: number }
export interface PerformerPresentationEntity { id: string; profileId: string | null; displayName: string; initials: string; role: PresentationRole; roleLabel: string; instrument: string | null; performerType: string; currentPosition: Point; targetPosition: Point; backstagePosition: Point; entrancePoint: Point; stageSlot: Point; stageZone: StagePosition["zone"]; stageDescription: string; counterRadius: number; movementZone: MovementZone; movementSpeed: number; idlePhase: number; visible: boolean; lifecycleState: PerformerLifecycleState; activeMoveEventId: string | null; label: string; }
export interface PerformerPlan { performers: PerformerInput[]; entities: Omit<PerformerPresentationEntity, "currentPosition" | "targetPosition" | "visible" | "lifecycleState" | "activeMoveEventId">[]; stage: Rect; audience: Rect; entranceStartMs: number; exitStartMs: number | null; entranceOrder: string[]; exitOrder: string[]; }

const labels: Record<PresentationRole, string> = { vocalist: "Vocals", lead_guitar: "Lead guitar", rhythm_guitar: "Rhythm guitar", guitar: "Guitar", bass: "Bass", drums: "Drums", keyboard: "Keyboard", piano: "Piano", dj: "DJ", electronic: "Electronic", backing_vocals: "Backing vocals", strings: "Strings", brass: "Brass", percussion: "Percussion", other: "Other", unknown: "Unknown role" };
const priority: Record<PresentationRole, number> = { drums: 0, percussion: 1, keyboard: 2, piano: 2, dj: 3, electronic: 3, bass: 4, rhythm_guitar: 5, guitar: 6, lead_guitar: 7, backing_vocals: 8, brass: 9, strings: 9, vocalist: 10, other: 6, unknown: 6 };

export function normalizePerformerRole(value?: string | null): PresentationRole {
  if (value == null) return "unknown";
  const raw = value.trim(); if (!raw) return "unknown";
  const s = raw.toLowerCase().replace(/[_/]+/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  if (!s) return "unknown";
  if (/(lead.*guitar|guitar.*lead|lead guitarist)/.test(s)) return "lead_guitar";
  if (/(rhythm.*guitar|guitar.*rhythm)/.test(s)) return "rhythm_guitar";
  if (/(backing|background|backup).*(vocal|singer)|harmony/.test(s)) return "backing_vocals";
  if (/vocal|singer|frontperson|front man|front woman/.test(s)) return "vocalist";
  if (/bass/.test(s)) return "bass";
  if (/drum|drummer/.test(s)) return "drums";
  if (/percussion|conga|bongo/.test(s)) return "percussion";
  if (/keyboard|synth/.test(s)) return "keyboard";
  if (/piano|pianist/.test(s)) return "piano";
  if (/\bdj\b|turntable/.test(s)) return "dj";
  if (/electronic|producer|sampler/.test(s)) return "electronic";
  if (/guitar|guitarist/.test(s)) return "guitar";
  if (/violin|cello|string/.test(s)) return "strings";
  if (/horn|brass|trumpet|sax|trombone/.test(s)) return "brass";
  if (/performer|member|musician|other/.test(s)) return "other";
  return "unknown";
}
export function roleLabel(role: PresentationRole) { return labels[role]; }

export function buildPerformerPlan({ replay, experience, size }: { replay: GigViewerReplay; experience?: GigExperienceDTO | null; size: Size }): PerformerPlan {
  const capacity = Math.max(0, experience?.gig.venue.capacity ?? 0); const preset = scaleVenuePreset(selectVenuePreset({ capacity }), size);
  const performers = performerInputs(replay, experience); const counts = new Map<PresentationRole, number>();
  const enterEvents = replay.events.filter((e) => e.visualPayload.type === "performer_enter"); const firstEnter = enterEvents[0]?.scheduledOffsetMs ?? replay.events.find((e) => e.phase === "band_entrance")?.scheduledOffsetMs ?? 0;
  const exit = replay.events.find((e) => e.visualPayload.type === "band_exit") ?? null;
  const order = [...performers].sort((a, b) => priority[normalizePerformerRole(a.roleOrInstrument)] - priority[normalizePerformerRole(b.roleOrInstrument)] || a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
  const entranceOrder = order.map((p) => p.id); const exitOrder = [...order].reverse().map((p) => p.id);
  const drafts = performers.map((p, index) => {
    const role = normalizePerformerRole(p.roleOrInstrument); const occurrence = counts.get(role) ?? 0; counts.set(role, occurrence + 1);
    return { performer: p, index, role, preferredSlot: stageSlotFor(role, occurrence, performers.length, preset.stage, index) };
  });
  const stageLayout = fitPerformerStageLayout(drafts.map((draft) => ({ ...draft.preferredSlot, role: draft.role })), preset.stage);
  const entities = drafts.map(({ performer: p, index, role }, layoutIndex) => {
    const stageSlot = stageLayout.slots[layoutIndex];
    const stageZone = zoneForStagePoint(stageSlot, preset.stage);
    const nearest = nearestSlotDistance(stageLayout.slots, layoutIndex);
    const counterClearance = Number.isFinite(nearest) ? Math.max(0, nearest - stageLayout.counterRadius * 2) : Infinity;
    const maxRoamRadius = Number.isFinite(counterClearance) ? counterClearance / .56 : Infinity;
    const backstagePosition = backstageFor(index, performers.length, preset.stage, preset.audience, preset.backstage);
    const entranceInset = stageLayout.counterRadius + 4;
    const entrancePoint = { x: clamp(preset.backstage.x, preset.stage.x + entranceInset, preset.stage.x + preset.stage.width - entranceInset), y: clamp(preset.backstage.y, preset.stage.y + entranceInset, preset.stage.y + preset.stage.height - entranceInset) };
    return { id: p.id, profileId: p.profileId, displayName: p.displayName, initials: initials(p.displayName, index), role, roleLabel: labels[role], instrument: p.roleOrInstrument, performerType: p.performerType, backstagePosition, entrancePoint, stageSlot, stageZone, stageDescription: describeZone(stageZone), counterRadius: stageLayout.counterRadius, movementZone: movementZoneFor(role, stageSlot, preset.stage, maxRoamRadius, stageLayout.counterRadius), movementSpeed: 1, idlePhase: deterministicRandom(`${replay.simulationSeed}:performer:${p.id}`)() * Math.PI * 2, label: shortRole(role) };
  });
  return { performers, entities, stage: preset.stage, audience: preset.audience, entranceStartMs: firstEnter, exitStartMs: exit?.scheduledOffsetMs ?? null, entranceOrder, exitOrder };
}

export function reconstructPerformerState(plan: PerformerPlan, replay: GigViewerReplay, positionMs: number, options: { reducedMotion?: boolean; lowPerformance?: boolean } = {}): PerformerPresentationEntity[] {
  const reduced = !!options.reducedMotion; const low = !!options.lowPerformance; const stagger = Math.min(900, Math.max(180, 5000 / Math.max(1, plan.entities.length))); const enterTravel = reduced ? 0 : 2400; const exitTravel = reduced ? 0 : 1800;
  return plan.entities.map((base) => {
    const enterIndex = Math.max(0, plan.entranceOrder.indexOf(base.id)); const enterStart = eventOffsetForPerformer(replay, base.id, "performer_enter") ?? plan.entranceStartMs + enterIndex * stagger; const performAt = enterStart + enterTravel; const exitIndex = Math.max(0, plan.exitOrder.indexOf(base.id)); const exitStart = plan.exitStartMs == null ? Infinity : plan.exitStartMs + exitIndex * Math.min(600, stagger);
    let lifecycleState: PerformerLifecycleState = "waiting_backstage"; let currentPosition = base.backstagePosition; let targetPosition = base.stageSlot; let visible = true; let activeMoveEventId: string | null = null;
    if (positionMs < enterStart) { lifecycleState = "waiting_backstage"; currentPosition = base.backstagePosition; targetPosition = base.entrancePoint; }
    else if (positionMs < performAt) { lifecycleState = positionMs < enterStart + enterTravel * .45 ? "entering" : "taking_position"; currentPosition = reduced ? base.stageSlot : pathPoint(base.backstagePosition, base.entrancePoint, base.stageSlot, (positionMs - enterStart) / Math.max(1, enterTravel)); }
    else if (positionMs >= exitStart) { if (positionMs >= exitStart + exitTravel) { lifecycleState = "hidden"; currentPosition = base.backstagePosition; targetPosition = base.backstagePosition; visible = false; } else { lifecycleState = "exiting"; targetPosition = base.backstagePosition; currentPosition = reduced ? base.backstagePosition : pathPoint(base.stageSlot, base.entrancePoint, base.backstagePosition, (positionMs - exitStart) / Math.max(1, exitTravel)); } }
    else { lifecycleState = "performing"; currentPosition = idlePosition(base, positionMs, reduced, low); const move = activeMoveEvent(replay, base.id, positionMs); if (move) { const target = moveTarget(move, base, plan.stage); if (target) { activeMoveEventId = move.id; targetPosition = target; currentPosition = reduced ? target : interpolate(base.stageSlot, target, Math.min(1, (positionMs - move.scheduledOffsetMs) / Math.max(1, move.durationMs || 1000))); } } }
    return { ...base, currentPosition, targetPosition, visible, lifecycleState, activeMoveEventId };
  });
}

function performerInputs(replay: GigViewerReplay, experience?: GigExperienceDTO | null): PerformerInput[] { const seen = new Map<string, PerformerInput>(); experience?.performers?.forEach((p, i) => { const id = p.profileId || p.id || `member-${i}`; if (!seen.has(id)) seen.set(id, { id, profileId: p.profileId ?? null, displayName: p.displayName || `Performer ${i + 1}`, roleOrInstrument: p.roleOrInstrument ?? null, performerType: p.lineupStatus ?? "performer" }); }); replay.events.forEach((e, i) => { if (e.visualPayload.type === "performer_enter" && !seen.has(e.visualPayload.performerId)) seen.set(e.visualPayload.performerId, { id: e.visualPayload.performerId, profileId: e.visualPayload.performerId, displayName: e.visualPayload.displayName || `Performer ${i + 1}`, roleOrInstrument: e.visualPayload.roleOrInstrument, performerType: "replay_performer" }); }); return [...seen.values()]; }
function stageSlotFor(role: PresentationRole, occurrence: number, total: number, stage: Rect, index: number): Point & { zone: StagePosition["zone"] } { if (total === 1) return { x: stage.x + stage.width * .5, y: stage.y + stage.height * .68, zone: "front_center" }; const x = (n: number) => stage.x + stage.width * n, y = (n: number) => stage.y + stage.height * n; const table: Partial<Record<PresentationRole, [number, number, StagePosition["zone"]][]>> = { vocalist: [[.5,.76,"front_center"],[.42,.72,"front_left"],[.58,.72,"front_right"]], lead_guitar: [[.32,.66,"front_left"],[.68,.66,"front_right"]], rhythm_guitar: [[.68,.66,"front_right"],[.32,.66,"front_left"]], guitar: [[.32,.66,"front_left"],[.68,.66,"front_right"],[.5,.62,"mid_center"]], bass: [[.72,.58,"mid_right"],[.28,.58,"mid_left"]], drums: [[.5,.28,"back_center"]], keyboard: [[.78,.34,"back_right"],[.22,.34,"back_left"]], piano: [[.78,.34,"back_right"]], dj: [[.58,.30,"back_center"],[.42,.30,"back_center"]], electronic: [[.58,.32,"back_center"],[.42,.32,"back_center"]], backing_vocals: [[.22,.54,"mid_left"],[.78,.54,"mid_right"]], brass: [[.18,.38,"back_left"],[.82,.38,"back_right"]], strings: [[.18,.44,"mid_left"],[.82,.44,"mid_right"]], percussion: [[.34,.30,"back_left"],[.66,.30,"back_right"]] }; const choices = table[role]; if (choices) { const c = choices[occurrence % choices.length]; const row = Math.floor(occurrence / choices.length); return { x: clamp(x(c[0] + (row % 2 ? .04 : -.04) * row), stage.x + 16, stage.x + stage.width - 16), y: clamp(y(c[1] + row * .08), stage.y + 16, stage.y + stage.height - 16), zone: c[2] }; } const cols = Math.ceil(Math.sqrt(total)); const row = Math.floor(index / cols); const col = index % cols; return { x: x((col + 1) / (cols + 1)), y: y(.35 + row * .16), zone: "mid_center" }; }

const MAX_COUNTER_RADIUS = 19;
const COUNTER_GAP = 5;
const STAGE_EDGE_GAP = 4;
const placementPriority: Record<PresentationRole, number> = { drums: 0, percussion: 1, keyboard: 2, piano: 2, dj: 3, electronic: 3, vocalist: 4, backing_vocals: 5, lead_guitar: 6, rhythm_guitar: 7, guitar: 8, bass: 9, brass: 10, strings: 10, other: 11, unknown: 12 };

function fitPerformerStageLayout(preferred: Array<Point & { role: PresentationRole }>, stage: Rect): { counterRadius: number; slots: Point[] } {
  if (!preferred.length) return { counterRadius: MAX_COUNTER_RADIUS, slots: [] };
  const fullInset = MAX_COUNTER_RADIUS + STAGE_EDGE_GAP;
  const bounded = preferred.map((slot) => ({
    x: clamp(slot.x, stage.x + fullInset, stage.x + stage.width - fullInset),
    y: clamp(slot.y, stage.y + fullInset, stage.y + stage.height - fullInset),
  }));
  if (slotsHaveClearance(bounded, MAX_COUNTER_RADIUS)) return { counterRadius: MAX_COUNTER_RADIUS, slots: bounded };

  const targetRows = preferred.length >= 9 ? 3 : preferred.length >= 3 ? 2 : 1;
  const minimumRows = preferred.length >= 3 ? 2 : 1;
  let best: { columns: number; rows: number; radius: number; score: number } | null = null;
  for (let columns = 1; columns <= preferred.length; columns += 1) {
    const rows = Math.ceil(preferred.length / columns);
    if (rows < minimumRows || rows > 4) continue;
    const radiusX = (stage.width - (columns - 1) * COUNTER_GAP - STAGE_EDGE_GAP * 2) / (columns * 2);
    const radiusY = (stage.height - (rows - 1) * COUNTER_GAP - STAGE_EDGE_GAP * 2) / (rows * 2);
    const radius = Math.min(MAX_COUNTER_RADIUS, radiusX, radiusY);
    if (radius <= 0) continue;
    const unusedCells = columns * rows - preferred.length;
    const score = radius * 100 - Math.abs(rows - targetRows) * 2 - unusedCells * .1;
    if (!best || score > best.score) best = { columns, rows, radius, score };
  }

  if (!best) return { counterRadius: MAX_COUNTER_RADIUS, slots: bounded };
  const grid = buildStageGrid(stage, preferred.length, best.columns, best.rows, best.radius);
  const slots: Point[] = Array.from({ length: preferred.length });
  const available = grid.map((point, index) => ({ point, index }));
  const order = preferred.map((slot, index) => ({ ...slot, index })).sort((a, b) => placementPriority[a.role] - placementPriority[b.role] || a.index - b.index);
  order.forEach((slot) => {
    available.sort((a, b) => normalizedDistance(slot, a.point, stage) - normalizedDistance(slot, b.point, stage) || a.index - b.index);
    slots[slot.index] = available.shift()!.point;
  });
  return { counterRadius: best.radius, slots };
}

function buildStageGrid(stage: Rect, count: number, columns: number, rows: number, radius: number): Point[] {
  const horizontalStep = radius * 2 + COUNTER_GAP;
  const verticalStep = radius * 2 + COUNTER_GAP;
  const totalHeight = rows * radius * 2 + (rows - 1) * COUNTER_GAP;
  const firstY = stage.y + (stage.height - totalHeight) / 2 + radius;
  const points: Point[] = [];
  for (let row = 0; row < rows; row += 1) {
    const rowCount = Math.min(columns, count - row * columns);
    if (rowCount <= 0) break;
    const rowWidth = rowCount * radius * 2 + (rowCount - 1) * COUNTER_GAP;
    const firstX = stage.x + (stage.width - rowWidth) / 2 + radius;
    for (let column = 0; column < rowCount; column += 1) {
      points.push({
        x: firstX + column * horizontalStep,
        y: firstY + row * verticalStep,
      });
    }
  }
  return points;
}

function slotsHaveClearance(slots: Point[], radius: number): boolean {
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      if (pointDistance(slots[i], slots[j]) < radius * 2 + COUNTER_GAP) return false;
    }
  }
  return true;
}

function nearestSlotDistance(slots: Point[], index: number): number {
  let nearest = Infinity;
  for (let i = 0; i < slots.length; i += 1) if (i !== index) nearest = Math.min(nearest, pointDistance(slots[index], slots[i]));
  return nearest;
}

function normalizedDistance(a: Point, b: Point, stage: Rect): number {
  const dx = (a.x - b.x) / Math.max(1, stage.width);
  const dy = (a.y - b.y) / Math.max(1, stage.height);
  return dx * dx + dy * dy;
}

function pointDistance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
function zoneForStagePoint(point: Point, stage: Rect): StagePosition["zone"] {
  const horizontal = (point.x - stage.x) / Math.max(1, stage.width);
  const vertical = (point.y - stage.y) / Math.max(1, stage.height);
  const depth = vertical >= .64 ? "front" : vertical >= .4 ? "mid" : "back";
  const side = horizontal <= .34 ? "left" : horizontal >= .66 ? "right" : "center";
  return `${depth}_${side}` as StagePosition["zone"];
}

function backstageFor(i: number, total: number, stage: Rect, audience: Rect, backstage: Point): Point { const spacing = 14; const x = clamp(backstage.x + (i % 2 ? spacing : -spacing) * Math.ceil(i / 2), 8, stage.x + stage.width + 48); const y = Math.min(stage.y - 18, backstage.y - Math.floor(i / 6) * spacing); return { x, y: Math.max(8, Math.min(y, audience.y - 24)) }; }
function movementZoneFor(role: PresentationRole, p: Point, stage: Rect, maxRadius = Infinity, counterRadius = 19): MovementZone { const desired = role === "vocalist" ? 46 : role.includes("guitar") ? 30 : role === "bass" ? 24 : role === "drums" || role === "keyboard" || role === "piano" || role === "dj" ? 8 : role === "backing_vocals" ? 14 : 16; const r = Math.max(0, Math.min(desired, maxRadius)); const inset = counterRadius + 4; const minX = stage.x + inset; const maxX = stage.x + stage.width - inset; const minY = stage.y + inset; const maxY = stage.y + stage.height - inset; const x = clamp(p.x - r, minX, maxX); const y = clamp(p.y - r * .55, minY, maxY); return { x, y, width: Math.max(0, Math.min(p.x + r, maxX) - x), height: Math.max(0, Math.min(p.y + r * .55, maxY) - y), radius: r }; }
function idlePosition(base: PerformerPlan["entities"][number], t: number, reduced: boolean, low: boolean): Point { if (reduced) return base.stageSlot; const factor = low ? .35 : 1; const z = base.movementZone; const sx = Math.sin(t / 1300 + base.idlePhase) * z.radius * .28 * factor; const sy = Math.cos(t / 1700 + base.idlePhase) * z.radius * .16 * factor; return { x: clamp(base.stageSlot.x + sx, z.x, z.x + z.width), y: clamp(base.stageSlot.y + sy, z.y, z.y + z.height) }; }
function activeMoveEvent(replay: GigViewerReplay, id: string, t: number): GigViewerEvent | null { return replay.events.find((e) => e.visualPayload.type === "performer_move" && e.visualPayload.performerId === id && t >= e.scheduledOffsetMs && t <= e.scheduledOffsetMs + Math.max(1, e.durationMs)) ?? null; }
function moveTarget(e: GigViewerEvent, base: Pick<PerformerPresentationEntity, "stageSlot" | "counterRadius">, stage: Rect): Point | null { if (e.visualPayload.type !== "performer_move") return null; if (!["walk", "rush", "step_forward", "return_to_position", "hold"].includes(e.visualPayload.movementStyle as string)) return null; const p = e.visualPayload.movementStyle === "return_to_position" ? base.stageSlot : { x: stage.x + stage.width * e.visualPayload.targetPosition.x, y: stage.y + stage.height * e.visualPayload.targetPosition.y }; const inset = base.counterRadius + STAGE_EDGE_GAP; return { x: clamp(p.x, stage.x + inset, stage.x + stage.width - inset), y: clamp(p.y, stage.y + inset, stage.y + stage.height - inset) }; }
function eventOffsetForPerformer(replay: GigViewerReplay, id: string, type: "performer_enter") { return replay.events.find((e) => e.visualPayload.type === type && e.visualPayload.performerId === id)?.scheduledOffsetMs ?? null; }
function pathPoint(a: Point, b: Point, c: Point, t: number) { return t < .45 ? interpolate(a, b, t / .45) : interpolate(b, c, (t - .45) / .55); }
function interpolate(a: Point, b: Point, t: number): Point { const v = clamp(t, 0, 1); return { x: a.x + (b.x - a.x) * v, y: a.y + (b.y - a.y) * v }; }
function initials(name: string, index: number) { const parts = (name || `Performer ${index + 1}`).split(/\s+/).filter(Boolean); const init = parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join(""); return init || `P${index + 1}`; }
function shortRole(role: PresentationRole) { return ({ vocalist: "VO", lead_guitar: "LG", rhythm_guitar: "RG", guitar: "GT", bass: "BA", drums: "DR", keyboard: "KY", piano: "PN", dj: "DJ", electronic: "EL", backing_vocals: "BV", strings: "ST", brass: "BR", percussion: "PC", other: "OT", unknown: "?" } as Record<PresentationRole,string>)[role]; }
function describeZone(zone: StagePosition["zone"]) { return zone.replace("front_", "front ").replace("mid_", "mid ").replace("back_", "rear ").replace("center", "centre"); }
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
