import type { Point, Rect } from "./Viewport";
import { seededIndex, seededRandom } from "./SeededRandom";

export type VenueArchetype = "pub" | "club" | "theatre" | "arena" | "stadium" | "festival" | "beach";
export type VenueArchitecture = "brick-room" | "nightclub" | "proscenium" | "arena-bowl" | "stadium-stands" | "festival-field" | "beachfront";
export type DecorationKind = "table" | "poster" | "booth" | "seat" | "balcony" | "screen" | "tier" | "tunnel" | "tent" | "fence" | "generator" | "palm" | "promenade" | "water" | "speaker" | "light";
export type PathName = "crowdToBar" | "barToCrowd" | "crowdToMerchandise" | "merchandiseToCrowd" | "entranceToCrowd" | "staffToBar" | "staffToMerchandise";
export interface DecorationSlot { id: string; kind: DecorationKind; bounds: Rect; style: number }
export interface VenueSceneLayout {
  archetype: VenueArchetype; variation: number; seed: string;
  bounds: Rect; safeCameraBounds: Rect; foregroundEffectBounds: Rect;
  stage: Rect; bandPositions: Record<string, Point>; crowdZones: Rect[];
  bar: Rect; merchandise: Rect; entrances: Point[]; exits: Point[];
  queuePoints: { bar: Point[]; merchandise: Point[]; entrance: Point[] };
  staffPositions: { bar: Point; merchandise: Point };
  paths: Record<PathName, Point[]>; architecture: VenueArchitecture;
  decorations: DecorationSlot[]; exteriorSlots: DecorationSlot[];
}

const BOUNDS: Rect = { x: 0, y: 0, width: 1, height: 1 };
const ARCHITECTURE: Record<VenueArchetype, VenueArchitecture> = { pub: "brick-room", club: "nightclub", theatre: "proscenium", arena: "arena-bowl", stadium: "stadium-stands", festival: "festival-field", beach: "beachfront" };
const DECOR: Record<VenueArchetype, DecorationKind[]> = {
  pub: ["table", "poster", "table", "speaker"], club: ["booth", "light", "speaker", "booth"],
  theatre: ["seat", "balcony", "seat", "light"], arena: ["tier", "screen", "seat", "tunnel"],
  stadium: ["tier", "screen", "tunnel", "seat"], festival: ["tent", "fence", "generator", "speaker"],
  beach: ["palm", "promenade", "water", "tent"],
};

const DECORATION_SIZE: Readonly<Record<DecorationKind, { width: number; height: number }>> = Object.freeze({
  table: { width: .07, height: .055 }, poster: { width: .05, height: .075 }, booth: { width: .08, height: .06 },
  seat: { width: .085, height: .05 }, balcony: { width: .13, height: .06 }, screen: { width: .1, height: .075 },
  tier: { width: .13, height: .065 }, tunnel: { width: .085, height: .085 }, tent: { width: .11, height: .085 },
  fence: { width: .11, height: .055 }, generator: { width: .08, height: .065 }, palm: { width: .07, height: .1 },
  promenade: { width: .11, height: .055 }, water: { width: .11, height: .055 }, speaker: { width: .055, height: .075 },
  light: { width: .06, height: .065 },
});

const ALIASES: Array<[VenueArchetype, RegExp]> = [
  ["beach", /beach|seafront|seaside|shore|coastal|oceanfront/],
  ["festival", /festival|open\s*air|outdoor|field|park|airfield|big\s*top|marquee/],
  ["stadium", /stadium|olympic|mega\s*dome|amphitheat|bowl/],
  ["arena", /arena|colise|forum|ice\s*(rink|arena)|sports?\s*hall/],
  ["theatre", /theat(re|er)|opera|auditorium|playhouse|concert\s*hall|ballroom/],
  ["pub", /pub|tavern|inn|public\s*house|alehouse|cafe|coffeehouse/],
  ["club", /club|nightclub|bar|lounge|basement|cellar|warehouse|live\s*house|speakeasy/],
];

export function resolveVenueArchetype(input?: { venueType?: string | null; venueName?: string | null; capacity?: number | null }): VenueArchetype {
  const value = `${input?.venueType ?? ""} ${input?.venueName ?? ""}`.toLowerCase().replace(/[_-]+/g, " ").trim();
  for (const [type, pattern] of ALIASES) if (pattern.test(value)) return type;
  const capacity = input?.capacity;
  if (typeof capacity === "number" && capacity > 0) {
    if (capacity >= 25000) return "stadium";
    if (capacity >= 5000) return "arena";
    if (capacity >= 700) return "theatre";
    if (capacity <= 180) return "pub";
  }
  return "club";
}

const point = (rect: Rect, x: number, y: number): Point => ({ x: rect.x + rect.width * x, y: rect.y + rect.height * y });
const reverse = (path: Point[]) => [...path].reverse();

function buildVariation(archetype: VenueArchetype, variation: number, seed: string): VenueSceneLayout {
  const sideSwap = variation === 1;
  const stageWidths = archetype === "pub" ? [.48, .52, .45] : archetype === "stadium" ? [.64, .68, .61] : [.58, .63, .55];
  const stage: Rect = { x: (1 - stageWidths[variation]) / 2 + (variation === 2 ? -.025 : 0), y: .13 + variation * .012, width: stageWidths[variation], height: archetype === "pub" ? .29 : .32 };
  const crowdZones: Rect[] = variation === 0
    ? [{ x: .24, y: .51, width: .52, height: .35 }]
    : variation === 1
      ? [{ x: .2, y: .51, width: .6, height: .2 }, { x: .27, y: .73, width: .46, height: .14 }]
      : [{ x: .25, y: .5, width: .48, height: .37 }, { x: .73, y: .57, width: .06, height: .22 }];
  const bar: Rect = sideSwap ? { x: .82, y: .5, width: .145, height: .22 } : { x: .035, y: .5, width: .145, height: .22 };
  const merchandise: Rect = sideSwap ? { x: .035, y: .58, width: .13, height: .17 } : { x: .835, y: .58, width: .13, height: .17 };
  const entrances = variation === 2 ? [{ x: .5, y: .94 }, { x: .9, y: .9 }] : [{ x: sideSwap ? .1 : .9, y: .91 }];
  const crowdHub = point(crowdZones[0], .5, .75);
  const barPoint = point(bar, .5, .55); const merchPoint = point(merchandise, .5, .55);
  const route = (destination: Point): Point[] => [crowdHub, { x: crowdHub.x, y: .88 }, { x: destination.x, y: .88 }, destination];
  const random = seededRandom(`${seed}:decorations`);
  const decorations = DECOR[archetype].map((kind, index): DecorationSlot => {
    const left = index % 2 === 0;
    const size = DECORATION_SIZE[kind];
    return { id: `${kind}-${index}`, kind, bounds: { x: left ? .02 : .98 - size.width, y: .18 + index * .075, ...size }, style: Math.floor(random() * 4) };
  });
  const entrancePath = [entrances[0], { x: entrances[0].x, y: .88 }, crowdHub];
  return {
    archetype, variation, seed, bounds: BOUNDS, safeCameraBounds: { x: .01, y: .01, width: .98, height: .98 }, foregroundEffectBounds: { x: .18, y: .08, width: .64, height: .82 },
    stage, bandPositions: { vocalist: point(stage, .5, .72), guitar: point(stage, .28, .62), bass: point(stage, .72, .62), drums: point(stage, .5, .28), keyboard: point(stage, .78, .35), unknown: point(stage, .5, .55) },
    crowdZones, bar, merchandise, entrances, exits: [...entrances],
    queuePoints: { bar: [point(bar, .5, 1.08), point(bar, .5, 1.25)], merchandise: [point(merchandise, .5, 1.08), point(merchandise, .5, 1.25)], entrance: entrances.map((p) => ({ x: p.x, y: Math.min(.97, p.y + .035) })) },
    staffPositions: { bar: point(bar, .5, .28), merchandise: point(merchandise, .5, .28) },
    paths: { crowdToBar: route(barPoint), barToCrowd: reverse(route(barPoint)), crowdToMerchandise: route(merchPoint), merchandiseToCrowd: reverse(route(merchPoint)), entranceToCrowd: entrancePath, staffToBar: [point(bar, .2, .28), barPoint], staffToMerchandise: [point(merchandise, .2, .28), merchPoint] },
    architecture: ARCHITECTURE[archetype], decorations,
    exteriorSlots: archetype === "beach" ? [{ id: "sea", kind: "water", bounds: { x: 0, y: .02, width: 1, height: .09 }, style: seededIndex(`${seed}:sea`, 4) }] : archetype === "festival" ? [{ id: "fence", kind: "fence", bounds: { x: .04, y: .08, width: .92, height: .03 }, style: seededIndex(`${seed}:fence`, 4) }] : [],
  };
}

export const VENUE_LAYOUT_REGISTRY: Readonly<Record<VenueArchetype, readonly VenueSceneLayout[]>> = Object.freeze(Object.fromEntries(
  (["pub", "club", "theatre", "arena", "stadium", "festival", "beach"] as VenueArchetype[]).map((type) => [type, Object.freeze([0, 1, 2].map((variation) => buildVariation(type, variation, `registry:${type}:${variation}`)))])
) as Record<VenueArchetype, readonly VenueSceneLayout[]>);

export function generateVenueScene(input: { gigId?: string | null; venueId?: string | null; venueName?: string | null; venueType?: string | null; capacity?: number | null }): VenueSceneLayout {
  const archetype = resolveVenueArchetype(input);
  const seed = input.gigId || [input.venueId, input.venueName, input.venueType, input.capacity].filter((value) => value != null && value !== "").join("|") || "unknown-venue";
  return buildVariation(archetype, seededIndex(`${seed}:${archetype}:layout`, 3), seed);
}
