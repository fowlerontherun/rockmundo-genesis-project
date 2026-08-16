import type { Atmosphere, EnvironmentKind, TimeOfDay } from "./EnvironmentRegistry";
import type { CapacityBand, VenueArchetype } from "./VenueSceneRegistry";
import type { SongPhase } from "./StoryEngine";

/**
 * Phase 6 ambience buses. This module is a pure projection: it turns already
 * resolved scene facts (archetype, capacity band, environment, song phase,
 * crowd energy) into low-volume ambience bus levels. It never touches the Web
 * Audio API, the clock, network data or Math.random, so the same replay
 * position always produces the same plan.
 *
 * Every bus sits beneath music and crowd audio: the summed ceiling is capped so
 * ambience can never mask the setlist or the existing crowd bed.
 */

export type AmbienceBusId = "venue_bed" | "bar_chatter" | "service_tills" | "outdoor";

export interface AmbienceBus {
  readonly id: AmbienceBusId;
  readonly label: string;
  /** 0..1 relative bus level, already scaled to sit under music/crowd. */
  readonly level: number;
  /** Bandpass/lowpass centre used by the audio hook, in Hz. */
  readonly centreHz: number;
  /** Modulation depth applied over time. Reduced Motion flattens this. */
  readonly modulation: number;
}

export interface VenueAmbiencePlanInput {
  readonly archetype: VenueArchetype;
  readonly capacityBand: CapacityBand;
  readonly environmentKind?: EnvironmentKind | null;
  readonly atmosphere?: Atmosphere | null;
  readonly timeOfDay?: TimeOfDay | null;
  readonly indoor?: boolean;
  readonly servicePointCount?: number | null;
  readonly songPhase?: SongPhase | null;
  readonly crowdEnergy?: number | null;
  readonly reducedMotion?: boolean;
}

export interface VenueAmbiencePlan {
  readonly buses: readonly AmbienceBus[];
  /** Sum of all bus levels, always <= AMBIENCE_TOTAL_CEILING. */
  readonly totalLevel: number;
  readonly reducedMotion: boolean;
  /** Short human readable summary for diagnostics and the audio controls. */
  readonly summary: string;
}

/** Ambience must never approach music/crowd level. */
export const AMBIENCE_TOTAL_CEILING = 0.3;

const BED_BY_BAND: Readonly<Record<CapacityBand, number>> = Object.freeze({
  intimate: 0.11,
  club: 0.12,
  mid: 0.13,
  large: 0.15,
  mega: 0.17,
});

const BED_HZ_BY_BAND: Readonly<Record<CapacityBand, number>> = Object.freeze({
  intimate: 260,
  club: 240,
  mid: 210,
  large: 180,
  mega: 150,
});

const OUTDOOR_ARCHETYPES: ReadonlySet<VenueArchetype> = new Set<VenueArchetype>(["festival", "beach", "stadium"]);

const WATER_KINDS: ReadonlySet<EnvironmentKind> = new Set<EnvironmentKind>(["coastal", "beach", "riverside", "tropical"]);

const TRAFFIC_KINDS: ReadonlySet<EnvironmentKind> = new Set<EnvironmentKind>(["urban", "industrial", "historic"]);

function clamp01(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

function normalisedEnergy(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value > 1 ? value / 100 : value));
}

/**
 * Bar chatter and till activity follow the demand window used by the venue
 * activity projection: quiet during peaks, busy between songs and in intros.
 */
function serviceDemandForPhase(phase: SongPhase | null | undefined): number {
  switch (phase) {
    case "peak": return 0.25;
    case "performing": return 0.45;
    case "ending": return 0.7;
    case "intro": return 0.8;
    case "completed": return 0.95;
    case "waiting": return 1;
    default: return 0.85;
  }
}

export function isOutdoorVenue(input: Pick<VenueAmbiencePlanInput, "archetype" | "indoor">): boolean {
  if (typeof input.indoor === "boolean") return !input.indoor;
  return OUTDOOR_ARCHETYPES.has(input.archetype);
}

export function resolveVenueAmbiencePlan(input: VenueAmbiencePlanInput): VenueAmbiencePlan {
  const reducedMotion = input.reducedMotion === true;
  const band = BED_BY_BAND[input.capacityBand] !== undefined ? input.capacityBand : "mid";
  const energy = normalisedEnergy(input.crowdEnergy);
  const demand = serviceDemandForPhase(input.songPhase ?? null);
  const outdoor = isOutdoorVenue(input);
  const kind = input.environmentKind ?? "generic";
  const atmosphere = input.atmosphere ?? "clear";
  const servicePoints = Math.max(0, Math.min(24, Math.round(input.servicePointCount ?? 2)));

  const buses: AmbienceBus[] = [];

  // Venue bed: room tone. Bigger rooms are lower and slightly louder.
  buses.push({
    id: "venue_bed",
    label: "Venue room tone",
    level: BED_BY_BAND[band] * (outdoor ? 0.8 : 1),
    centreHz: BED_HZ_BY_BAND[band],
    modulation: reducedMotion ? 0 : 0.12,
  });

  // Bar chatter: loudest between songs, ducked hard during peaks.
  if (servicePoints > 0) {
    buses.push({
      id: "bar_chatter",
      label: "Bar chatter",
      level: (0.04 + Math.min(servicePoints, 8) * 0.008) * demand * (0.7 + energy * 0.4),
      centreHz: 620,
      modulation: reducedMotion ? 0 : 0.2,
    });

    // Tills and glassware: sparse transient bus, scaled by station count.
    buses.push({
      id: "service_tills",
      label: "Tills and glassware",
      level: (0.02 + Math.min(servicePoints, 12) * 0.004) * demand,
      centreHz: 2400,
      modulation: reducedMotion ? 0 : 0.3,
    });
  }

  // Outdoor bus: traffic, water and weather, only where the scene supports it.
  if (outdoor) {
    const water = WATER_KINDS.has(kind) ? 0.05 : 0;
    const traffic = TRAFFIC_KINDS.has(kind) ? 0.04 : 0.015;
    const weather = atmosphere === "rainy" ? 0.055 : atmosphere === "foggy" || atmosphere === "hazy" ? 0.02 : 0;
    const nightDuck = input.timeOfDay === "night" ? 0.75 : 1;
    const level = (water + traffic + weather) * nightDuck;
    if (level > 0) {
      buses.push({
        id: "outdoor",
        label: water > 0 ? "Outdoor water and weather" : "Outdoor traffic and weather",
        level,
        centreHz: water > 0 ? 900 : 420,
        modulation: reducedMotion ? 0 : 0.18,
      });
    }
  }

  const rawTotal = buses.reduce((sum, bus) => sum + bus.level, 0);
  const scale = rawTotal > AMBIENCE_TOTAL_CEILING && rawTotal > 0 ? AMBIENCE_TOTAL_CEILING / rawTotal : 1;
  const scaled = buses.map((bus) => ({ ...bus, level: Math.round(clamp01(bus.level * scale) * 1000) / 1000 }));
  const totalLevel = Math.round(scaled.reduce((sum, bus) => sum + bus.level, 0) * 1000) / 1000;

  return {
    buses: Object.freeze(scaled),
    totalLevel,
    reducedMotion,
    summary: `${scaled.length} ambience ${scaled.length === 1 ? "bus" : "buses"} · ${outdoor ? "outdoor" : "indoor"} · ${Math.round(totalLevel * 100)}% under music`,
  };
}
