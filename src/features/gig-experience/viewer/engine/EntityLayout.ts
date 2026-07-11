import type { GigViewerReplay } from "../../events/types";
import type { GigExperienceDTO } from "../../types";
import type { Point, Rect, Size } from "./Viewport";
import { pointInRect } from "./Viewport";
import { selectVenuePreset, scaleVenuePreset } from "./VenueLayout";
import { selectCrowdEntityCap } from "./CrowdLifecycle";

export { representedWeights, selectCrowdEntityCap as entityCap } from "./CrowdLifecycle";
export interface CrowdEntity { id: string; x: number; y: number; weight: number }
export interface PerformerEntity { id: string; name: string; role: string; initials: string; x: number; y: number; visible: boolean }
export interface EntityLayout { crowd: CrowdEntity[]; performers: PerformerEntity[]; attendance: number; capacity: number; presetName: string }

function hashSeed(seed: string) { let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(seed: number) { return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function deterministicRandom(seed: string) { return mulberry32(hashSeed(seed)); }


export function buildEntityLayout({ replay, experience, size, reducedMotion = false }: { replay: GigViewerReplay; experience?: GigExperienceDTO | null; size: Size; reducedMotion?: boolean }): EntityLayout {
  const capacity = Math.max(0, experience?.gig.venue.capacity ?? 0);
  const attendance = Math.max(0, metricNumber(experience?.headline.attendance) ?? crowdAttendanceFromReplay(replay));
  const preset = scaleVenuePreset(selectVenuePreset({ capacity }), size);
  const rand = deterministicRandom(`${replay.simulationSeed}:${preset.name}:${Math.round(size.width)}x${Math.round(size.height)}`);
  const fillRatio = capacity > 0 ? Math.min(1, attendance / capacity) : 0;
  const cap = selectCrowdEntityCap({ reducedMotion, width: size.width, attendanceRatio: fillRatio, highPerformance: fillRatio > .9 && capacity > 2000 });
  const visualCount = attendance <= 0 ? 0 : Math.max(1, Math.min(cap, Math.round(Math.sqrt(attendance) * fillRatio * 7 + cap * fillRatio * .45)));
  const crowd: CrowdEntity[] = [];
  for (let i = 0; i < visualCount; i++) {
    const zone = preset.crowdZones[i % preset.crowdZones.length];
    const point = randomPointIn(zone, rand);
    if (!pointInAny(point, [preset.stage])) crowd.push({ id: `crowd-${i}`, x: point.x, y: point.y, weight: Math.max(1, Math.round(attendance / Math.max(1, visualCount))) });
  }
  const performers = performerInputs(replay, experience).map((p, index, arr) => {
    const key = roleKey(p.role);
    const base = preset.performerSlots[key] ?? preset.performerSlots.unknown;
    const spread = Math.max(18, Math.min(42, preset.stage.width / Math.max(3, arr.length + 1)));
    const offset = (index - (arr.length - 1) / 2) * spread;
    const x = Math.min(preset.stage.x + preset.stage.width - 18, Math.max(preset.stage.x + 18, base.x + offset * (key === "unknown" ? 1 : .35)));
    const y = Math.min(preset.stage.y + preset.stage.height - 18, Math.max(preset.stage.y + 18, base.y + ((index % 2) - .5) * 12));
    return { id: p.id, name: p.name, role: p.role || "Performer", initials: initials(p.name, index), x, y, visible: true };
  });
  return { crowd, performers, attendance, capacity, presetName: preset.name };
}

function randomPointIn(rect: Rect, rand: () => number): Point { return { x: rect.x + rand() * rect.width, y: rect.y + rand() * rect.height }; }
function pointInAny(point: Point, rects: Rect[]) { return rects.some((r) => pointInRect(point, r)); }
function metricNumber(metric: any): number | null { return metric?.status === "available" && typeof metric.value === "number" ? metric.value : null; }
function crowdAttendanceFromReplay(replay: GigViewerReplay) { const reveal = replay.events.find((e) => e.visualPayload.type === "result_reveal"); return reveal?.visualPayload.type === "result_reveal" ? reveal.visualPayload.attendance ?? 0 : 0; }
function performerInputs(replay: GigViewerReplay, experience?: GigExperienceDTO | null) { const fromExperience = experience?.performers?.map((p, i) => ({ id: p.profileId || p.id || `member-${i}`, name: p.displayName || `Member ${i + 1}`, role: p.roleOrInstrument || "Performer" })) ?? []; if (fromExperience.length) return fromExperience; const seen = new Map<string, { id: string; name: string; role: string }>(); replay.events.forEach((e, i) => { if (e.visualPayload.type === "performer_enter") seen.set(e.visualPayload.performerId, { id: e.visualPayload.performerId, name: e.visualPayload.displayName || `Member ${i + 1}`, role: e.visualPayload.roleOrInstrument || "Performer" }); }); return seen.size ? [...seen.values()] : [{ id: "performer-1", name: "Performer", role: "Performer" }]; }
function roleKey(role?: string | null) { const r = role?.toLowerCase() ?? ""; if (r.includes("vocal") || r.includes("front")) return "vocalist"; if (r.includes("lead") || r.includes("guitar")) return "guitar"; if (r.includes("bass")) return "bass"; if (r.includes("drum")) return "drums"; if (r.includes("key")) return "keyboard"; if (r.includes("dj") || r.includes("electronic")) return "dj"; if (r.includes("back")) return "backing"; return "unknown"; }
function initials(name: string, index: number) { const text = name || `Member ${index + 1}`; return text.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "P"; }
