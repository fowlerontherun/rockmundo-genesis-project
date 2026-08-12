import { seededIndex } from "./SeededRandom";
import type { VenueArchetype } from "./VenueSceneRegistry";

export type EnvironmentKind = "urban" | "industrial" | "riverside" | "coastal" | "beach" | "countryside" | "historic" | "tropical" | "desert" | "alpine" | "generic";
export type TimeOfDay = "day" | "sunset" | "night";
export type Atmosphere = "clear" | "cloudy" | "rainy" | "hazy" | "foggy";
export interface EnvironmentProfile { kind: EnvironmentKind; horizon: string; ground: string; silhouette: string; accent: readonly string[]; features: readonly ("buildings" | "brick" | "water" | "palms" | "trees" | "roofs" | "rocks" | "mountains")[]; atmospheres: readonly Atmosphere[]; validVenues: readonly VenueArchetype[] }
export interface ResolvedEnvironment { profile: EnvironmentProfile; variation: number; accent: string; atmosphere: Atmosphere; timeOfDay: TimeOfDay; seed: string }

const ALL: VenueArchetype[] = ["pub", "club", "theatre", "arena", "stadium", "festival", "beach"];
const profile = (kind: EnvironmentKind, horizon: string, ground: string, silhouette: string, features: EnvironmentProfile["features"], validVenues: readonly VenueArchetype[] = ALL): EnvironmentProfile => ({ kind, horizon, ground, silhouette, features, validVenues, accent: ["#f59e0b", "#22d3ee", "#f472b6", "#a3e635"], atmospheres: ["clear", "cloudy", "rainy", "hazy", "foggy"] });
export const ENVIRONMENT_REGISTRY: Readonly<Record<EnvironmentKind, EnvironmentProfile>> = Object.freeze({
  urban: profile("urban", "#334155", "#1e293b", "#0f172a", ["buildings"]),
  industrial: profile("industrial", "#64748b", "#451a03", "#29140b", ["brick", "buildings"]),
  riverside: profile("riverside", "#475569", "#164e63", "#1e293b", ["water", "buildings"]),
  coastal: profile("coastal", "#38bdf8", "#155e75", "#334155", ["water", "buildings"]),
  beach: profile("beach", "#38bdf8", "#d6b36a", "#0f766e", ["water", "palms"], ["beach", "festival"]),
  countryside: profile("countryside", "#7dd3fc", "#365314", "#14532d", ["trees", "mountains"], ["pub", "theatre", "festival"]),
  historic: profile("historic", "#64748b", "#3f2a22", "#292524", ["roofs", "buildings"]),
  tropical: profile("tropical", "#06b6d4", "#166534", "#14532d", ["palms", "water"]),
  desert: profile("desert", "#fb923c", "#9a3412", "#7c2d12", ["rocks"]),
  alpine: profile("alpine", "#93c5fd", "#365314", "#e2e8f0", ["mountains", "trees"]),
  generic: profile("generic", "#475569", "#1e293b", "#0f172a", ["buildings"]),
});

const CITY_CATALOGUE: Readonly<Record<string, EnvironmentKind>> = Object.freeze({
  london: "urban", "new york": "urban", nyc: "urban", tokyo: "urban", paris: "historic", rome: "historic", prague: "historic",
  manchester: "industrial", birmingham: "industrial", detroit: "industrial", liverpool: "riverside", rotterdam: "riverside", hamburg: "riverside",
  brighton: "coastal", barcelona: "coastal", sydney: "coastal", miami: "tropical", rio: "tropical", "rio de janeiro": "tropical",
  cairo: "desert", dubai: "desert", denver: "alpine", innsbruck: "alpine", zurich: "alpine",
});
const normalise = (value?: string | null) => (value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_-]+/g, " ").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const ENV_ALIASES: Array<[EnvironmentKind, RegExp]> = [["beach", /beach|shore|seafront/], ["coastal", /coast|seaside|ocean/], ["riverside", /river|dock|harbour|harbor|canal/], ["industrial", /industrial|warehouse|red brick/], ["countryside", /country|park|field|rural/], ["historic", /historic|old town/], ["tropical", /tropical|island/], ["desert", /desert/], ["alpine", /alpine|mountain/], ["urban", /urban|city centre|city center|downtown/]];

export function resolveEnvironment(input: { gigId?: string | null; environment?: string | null; eventType?: string | null; venueArchetype: VenueArchetype; city?: string | null; country?: string | null; scheduledDate?: string | null }): ResolvedEnvironment {
  const explicit = normalise(input.environment); const event = normalise(input.eventType);
  let kind = ENV_ALIASES.find(([, regex]) => regex.test(explicit))?.[0];
  if (!kind && input.venueArchetype === "beach") kind = "beach";
  if (!kind) kind = ENV_ALIASES.find(([, regex]) => regex.test(event))?.[0];
  const city = normalise(input.city); if (!kind) kind = CITY_CATALOGUE[city] ?? Object.entries(CITY_CATALOGUE).find(([name]) => city.includes(name))?.[1];
  if (!kind) kind = ENV_ALIASES.find(([, regex]) => regex.test(normalise(input.country)))?.[0] ?? "generic";
  if (!ENVIRONMENT_REGISTRY[kind].validVenues.includes(input.venueArchetype)) kind = input.venueArchetype === "beach" ? "beach" : "generic";
  const seed = `${input.gigId || "unknown-gig"}:environment-v1`;
  const profileValue = ENVIRONMENT_REGISTRY[kind];
  const hour = input.scheduledDate && !Number.isNaN(Date.parse(input.scheduledDate)) ? new Date(input.scheduledDate).getHours() : null;
  const timeOfDay: TimeOfDay = hour == null ? (["day", "sunset", "night"] as const)[seededIndex(`${seed}:time`, 3)] : hour < 17 ? "day" : hour < 21 ? "sunset" : "night";
  return { profile: profileValue, variation: seededIndex(`${seed}:variation`, 4), accent: profileValue.accent[seededIndex(`${seed}:accent`, profileValue.accent.length)], atmosphere: profileValue.atmospheres[seededIndex(`${seed}:atmosphere`, profileValue.atmospheres.length)], timeOfDay, seed };
}

export { CITY_CATALOGUE };
