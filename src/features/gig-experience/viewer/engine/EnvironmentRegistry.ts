import { seededIndex } from "./SeededRandom";
import type { VenueArchetype } from "./VenueSceneRegistry";

export type EnvironmentKind = "urban" | "industrial" | "riverside" | "coastal" | "beach" | "countryside" | "historic" | "tropical" | "desert" | "alpine" | "generic";
export type TimeOfDay = "day" | "sunset" | "night";
export type Atmosphere = "clear" | "cloudy" | "rainy" | "hazy" | "foggy";

export interface EnvironmentProfile {
  kind: EnvironmentKind;
  horizon: string;
  ground: string;
  silhouette: string;
  accent: readonly string[];
  features: readonly ("buildings" | "brick" | "water" | "palms" | "trees" | "roofs" | "rocks" | "mountains")[];
  atmospheres: readonly Atmosphere[];
  validVenues: readonly VenueArchetype[];
}

export interface ResolvedEnvironment {
  profile: EnvironmentProfile;
  variation: number;
  accent: string;
  atmosphere: Atmosphere;
  timeOfDay: TimeOfDay;
  seed: string;
}

export interface GigEnvironmentVenueInput {
  type?: string | null;
  location?: string | null;
  environment?: string | null;
  city?: {
    name?: string | null;
    country?: string | null;
    region?: string | null;
    climateType?: string | null;
    isCoastal?: boolean | null;
    timezone?: string | null;
  } | null;
}

const ALL: VenueArchetype[] = ["pub", "club", "theatre", "arena", "stadium", "festival", "beach"];
const DEFAULT_ATMOSPHERES: readonly Atmosphere[] = ["clear", "cloudy", "rainy", "hazy", "foggy"];
const profile = (
  kind: EnvironmentKind,
  horizon: string,
  ground: string,
  silhouette: string,
  features: EnvironmentProfile["features"],
  validVenues: readonly VenueArchetype[] = ALL,
  atmospheres: readonly Atmosphere[] = DEFAULT_ATMOSPHERES,
): EnvironmentProfile => ({
  kind,
  horizon,
  ground,
  silhouette,
  features,
  validVenues,
  atmospheres,
  accent: ["#f59e0b", "#22d3ee", "#f472b6", "#a3e635"],
});

export const ENVIRONMENT_REGISTRY: Readonly<Record<EnvironmentKind, EnvironmentProfile>> = Object.freeze({
  urban: profile("urban", "#334155", "#1e293b", "#0f172a", ["buildings"]),
  industrial: profile("industrial", "#64748b", "#451a03", "#29140b", ["brick", "buildings"]),
  riverside: profile("riverside", "#475569", "#164e63", "#1e293b", ["water", "buildings"]),
  coastal: profile("coastal", "#38bdf8", "#155e75", "#334155", ["water", "buildings"], ALL, ["clear", "cloudy", "rainy", "hazy"]),
  beach: profile("beach", "#38bdf8", "#d6b36a", "#0f766e", ["water", "palms"], ["beach", "festival"], ["clear", "cloudy", "rainy", "hazy"]),
  countryside: profile("countryside", "#7dd3fc", "#365314", "#14532d", ["trees", "mountains"]),
  historic: profile("historic", "#64748b", "#3f2a22", "#292524", ["roofs", "buildings"]),
  tropical: profile("tropical", "#06b6d4", "#166534", "#14532d", ["palms", "water"], ALL, ["clear", "cloudy", "rainy", "hazy"]),
  desert: profile("desert", "#fb923c", "#9a3412", "#7c2d12", ["rocks"], ALL, ["clear", "cloudy", "hazy"]),
  alpine: profile("alpine", "#93c5fd", "#365314", "#e2e8f0", ["mountains", "trees"], ALL, ["clear", "cloudy", "foggy"]),
  generic: profile("generic", "#475569", "#1e293b", "#0f172a", ["buildings"]),
});

const CITY_CATALOGUE: Readonly<Record<string, EnvironmentKind>> = Object.freeze({
  london: "urban",
  "new york": "urban",
  nyc: "urban",
  tokyo: "urban",
  seoul: "urban",
  beijing: "urban",
  chicago: "urban",
  "mexico city": "urban",
  paris: "historic",
  rome: "historic",
  prague: "historic",
  vienna: "historic",
  edinburgh: "historic",
  athens: "historic",
  florence: "historic",
  istanbul: "historic",
  manchester: "industrial",
  birmingham: "industrial",
  detroit: "industrial",
  glasgow: "industrial",
  liverpool: "riverside",
  rotterdam: "riverside",
  hamburg: "riverside",
  amsterdam: "riverside",
  bristol: "riverside",
  antwerp: "riverside",
  "new orleans": "riverside",
  brighton: "coastal",
  barcelona: "coastal",
  sydney: "coastal",
  "los angeles": "coastal",
  "san francisco": "coastal",
  "cape town": "coastal",
  marseille: "coastal",
  lisbon: "coastal",
  miami: "tropical",
  rio: "tropical",
  "rio de janeiro": "tropical",
  singapore: "tropical",
  bangkok: "tropical",
  jakarta: "tropical",
  manila: "tropical",
  havana: "tropical",
  cairo: "desert",
  dubai: "desert",
  "las vegas": "desert",
  doha: "desert",
  riyadh: "desert",
  phoenix: "desert",
  marrakech: "desert",
  denver: "alpine",
  innsbruck: "alpine",
  zurich: "alpine",
});

const COUNTRY_CATALOGUE: Readonly<Record<string, EnvironmentKind>> = Object.freeze({
  egypt: "desert",
  qatar: "desert",
  "saudi arabia": "desert",
  "united arab emirates": "desert",
  uae: "desert",
  indonesia: "tropical",
  jamaica: "tropical",
  philippines: "tropical",
  singapore: "tropical",
  switzerland: "alpine",
});

const normalise = (value?: string | null) => (value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[_-]+/g, " ")
  .replace(/[^a-z0-9 ]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const ENV_ALIASES: Array<[EnvironmentKind, RegExp]> = [
  ["beach", /beach|shore|seafront/],
  ["coastal", /coast|seaside|ocean/],
  ["riverside", /river|dock|harbour|harbor|canal/],
  ["industrial", /industrial|warehouse|red brick/],
  ["countryside", /country|park|field|rural/],
  ["historic", /historic|old town/],
  ["tropical", /tropical|equatorial|island/],
  ["desert", /desert|arid/],
  ["alpine", /alpine|mountain|subarctic/],
  ["urban", /urban|city centre|city center|downtown/],
];

const CLIMATE_ALIASES: Array<[EnvironmentKind, RegExp]> = [
  ["tropical", /tropical|equatorial/],
  ["desert", /arid|desert/],
  ["alpine", /alpine|subarctic|mountain/],
];

export function resolveEnvironment(input: {
  gigId?: string | null;
  environment?: string | null;
  eventType?: string | null;
  venueArchetype: VenueArchetype;
  city?: string | null;
  country?: string | null;
  region?: string | null;
  climateType?: string | null;
  isCoastal?: boolean | null;
  timeZone?: string | null;
  scheduledDate?: string | null;
}): ResolvedEnvironment {
  const explicit = normalise(input.environment);
  const event = normalise(input.eventType);
  let kind = ENV_ALIASES.find(([, regex]) => regex.test(explicit))?.[0];

  if (!kind && input.venueArchetype === "beach") kind = "beach";
  if (!kind) kind = ENV_ALIASES.find(([, regex]) => regex.test(event))?.[0];

  const city = normalise(input.city);
  if (!kind) kind = CITY_CATALOGUE[city] ?? Object.entries(CITY_CATALOGUE).find(([name]) => city.includes(name))?.[1];

  const climate = normalise(input.climateType);
  if (!kind) kind = CLIMATE_ALIASES.find(([, regex]) => regex.test(climate))?.[0];
  if (!kind && input.isCoastal === true) kind = "coastal";
  if (!kind) kind = ENV_ALIASES.find(([, regex]) => regex.test(normalise(input.region)))?.[0];

  const country = normalise(input.country);
  if (!kind) kind = COUNTRY_CATALOGUE[country] ?? ENV_ALIASES.find(([, regex]) => regex.test(country))?.[0] ?? "generic";
  if (!ENVIRONMENT_REGISTRY[kind].validVenues.includes(input.venueArchetype)) {
    kind = input.venueArchetype === "beach" ? "beach" : "generic";
  }

  const seed = `${input.gigId || "unknown-gig"}:environment-v2`;
  const profileValue = ENVIRONMENT_REGISTRY[kind];
  const hour = localHour(input.scheduledDate, input.timeZone);
  const timeOfDay: TimeOfDay = hour == null
    ? (["day", "sunset", "night"] as const)[seededIndex(`${seed}:time`, 3)]
    : hour >= 6 && hour < 17
      ? "day"
      : hour >= 17 && hour < 21
        ? "sunset"
        : "night";
  const atmospherePool = atmospheresForClimate(profileValue, climate);

  return {
    profile: profileValue,
    variation: seededIndex(`${seed}:variation`, 4),
    accent: profileValue.accent[seededIndex(`${seed}:accent`, profileValue.accent.length)],
    atmosphere: atmospherePool[seededIndex(`${seed}:atmosphere`, atmospherePool.length)],
    timeOfDay,
    seed,
  };
}

/** Keeps real-gig DTO assumptions outside the renderer and falls back safely for legacy rows. */
export function resolveGigEnvironment(input: {
  gigId?: string | null;
  scheduledDate?: string | null;
  venueArchetype: VenueArchetype;
  venue?: GigEnvironmentVenueInput | null;
}) {
  const city = input.venue?.city;
  return resolveEnvironment({
    gigId: input.gigId,
    environment: input.venue?.environment,
    eventType: input.venue?.type,
    venueArchetype: input.venueArchetype,
    city: city?.name ?? input.venue?.location,
    country: city?.country,
    region: city?.region,
    climateType: city?.climateType,
    isCoastal: city?.isCoastal,
    timeZone: city?.timezone,
    scheduledDate: input.scheduledDate,
  });
}

function atmospheresForClimate(profileValue: EnvironmentProfile, climate: string): readonly Atmosphere[] {
  const preferred = /arid|desert/.test(climate)
    ? (["clear", "cloudy", "hazy"] as const)
    : /tropical|equatorial/.test(climate)
      ? (["clear", "cloudy", "rainy", "hazy"] as const)
      : /oceanic/.test(climate)
        ? (["clear", "cloudy", "rainy", "foggy"] as const)
        : /mediterranean|subtropical/.test(climate)
          ? (["clear", "cloudy", "rainy", "hazy"] as const)
          : /continental|subarctic/.test(climate)
            ? (["clear", "cloudy", "foggy"] as const)
            : profileValue.atmospheres;
  const compatible = preferred.filter((value) => profileValue.atmospheres.includes(value));
  return compatible.length > 0 ? compatible : profileValue.atmospheres;
}

function localHour(value?: string | null, timeZone?: string | null): number | null {
  if (!value || !/T\d{2}:\d{2}/.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (timeZone?.trim()) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hourCycle: "h23",
        timeZone: timeZone.trim(),
      }).formatToParts(date);
      const hour = Number(parts.find((part) => part.type === "hour")?.value);
      if (Number.isInteger(hour) && hour >= 0 && hour <= 23) return hour;
    } catch {
      // Unknown legacy time zones use the deterministic UTC fallback below.
    }
  }

  return date.getUTCHours();
}

export { CITY_CATALOGUE, COUNTRY_CATALOGUE };
