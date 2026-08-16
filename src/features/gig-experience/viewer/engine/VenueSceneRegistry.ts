import type { Point, Rect } from "./Viewport";
import { seededIndex } from "./SeededRandom";

export const VENUE_SCENE_DESCRIPTOR_VERSION = 2 as const;
export const VENUE_LAYOUT_SEED_NAMESPACE = "layout-v2" as const;
export const VENUE_DECOR_SEED_NAMESPACE = "decor-v2" as const;
export type VenueVariation = 0 | 1 | 2;
export type VenueArchetype = "pub" | "club" | "theatre" | "arena" | "stadium" | "festival" | "beach";
export type VenueArchitecture = "brick-room" | "nightclub" | "proscenium" | "arena-bowl" | "stadium-stands" | "festival-field" | "beachfront";
export type DecorationKind = "table" | "poster" | "booth" | "seat" | "balcony" | "screen" | "tier" | "tunnel" | "tent" | "fence" | "generator" | "palm" | "promenade" | "water" | "speaker" | "light" | "window" | "toilet" | "security" | "curtain" | "aisle" | "concourse";
export type PathName = "crowdToBar" | "barToCrowd" | "crowdToMerchandise" | "merchandiseToCrowd" | "entranceToCrowd" | "staffToBar" | "staffToMerchandise";
export interface DecorationSlot { readonly id: string; readonly kind: DecorationKind; readonly bounds: Readonly<Rect>; readonly style: number }
export interface CrowdZone extends Readonly<Rect> { readonly id: string; readonly returnAnchor: Readonly<Point> }
export type ServiceKind = "bar" | "merchandise";
export type CapacityBand = "intimate" | "club" | "mid" | "large" | "mega";
/** Distributed service point: large venues gain several rather than one oversized queue. */
export interface ServicePoint {
  readonly id: string; readonly kind: ServiceKind; readonly bounds: Readonly<Rect>;
  readonly queuePoints: readonly Readonly<Point>[]; readonly staffPositions: readonly Readonly<Point>[];
  readonly approachRouteId: string; readonly returnRouteId: string;
}
/** Authored route graph edge. Counters interpolate along waypoints; there is no collision solver. */
export interface SceneRoute { readonly id: string; readonly from: string; readonly to: string; readonly waypoints: readonly Readonly<Point>[] }
export interface VenueSceneDescriptor {
  readonly descriptorVersion: typeof VENUE_SCENE_DESCRIPTOR_VERSION;
  readonly archetype: VenueArchetype; readonly variation: VenueVariation;
  readonly seedNamespace: typeof VENUE_LAYOUT_SEED_NAMESPACE; readonly decorationNamespace: typeof VENUE_DECOR_SEED_NAMESPACE;
  readonly structuralFingerprint: string; readonly capacityBand: CapacityBand;
  readonly bounds: Readonly<Rect>; readonly safeCameraBounds: Readonly<Rect>; readonly foregroundEffectBounds: Readonly<Rect>; readonly labelSafeBounds: Readonly<Rect>; readonly controlSafeBounds: Readonly<Rect>;
  readonly stage: Readonly<Rect>; readonly bandPositions: Readonly<Record<string, Readonly<Point>>>; readonly crowdZones: readonly CrowdZone[];
  readonly bar: Readonly<Rect>; readonly merchandise: Readonly<Rect>; readonly entrances: readonly Readonly<Point>[]; readonly exits: readonly Readonly<Point>[];
  readonly bars: readonly ServicePoint[]; readonly merchandiseStands: readonly ServicePoint[]; readonly routes: readonly SceneRoute[];
  readonly queuePoints: Readonly<{ bar: readonly Readonly<Point>[]; merchandise: readonly Readonly<Point>[]; entrance: readonly Readonly<Point>[] }>;
  readonly staffPositions: Readonly<{ bar: Readonly<Point>; merchandise: Readonly<Point> }>;
  readonly paths: Readonly<Record<PathName, readonly Readonly<Point>[]>>; readonly architecture: VenueArchitecture;
  readonly decorations: readonly DecorationSlot[]; readonly exteriorSlots: readonly DecorationSlot[];
}
/** Temporary source compatibility while downstream extensions migrate. */
export type VenueSceneLayout = VenueSceneDescriptor;

export interface VenueDescriptorValidationError { code: string; path?: string; message: string }
export interface VenueDescriptorValidationResult { valid: boolean; errors: VenueDescriptorValidationError[] }

const ARCHITECTURE: Record<VenueArchetype, VenueArchitecture> = { pub: "brick-room", club: "nightclub", theatre: "proscenium", arena: "arena-bowl", stadium: "stadium-stands", festival: "festival-field", beach: "beachfront" };
const ALIASES: Array<[VenueArchetype, RegExp]> = [["beach", /beach|seafront|seaside|shore|coastal|oceanfront/], ["festival", /festival|open\s*air|outdoor|field|park|airfield|big\s*top|marquee/], ["stadium", /stadium|olympic|mega\s*dome|amphitheat|bowl/], ["arena", /arena|colise|forum|ice\s*(rink|arena)|sports?\s*hall/], ["theatre", /theat(re|er)|opera|auditorium|playhouse|concert\s*hall|ballroom/], ["pub", /pub|tavern|inn|public\s*house|alehouse|cafe|coffeehouse/], ["club", /club|nightclub|bar|lounge|basement|cellar|warehouse|live\s*house|speakeasy/]];

export function resolveVenueArchetype(input?: { venueType?: string | null; venueName?: string | null; capacity?: number | null }): VenueArchetype {
  const value = `${input?.venueType ?? ""} ${input?.venueName ?? ""}`.toLowerCase().replace(/[_-]+/g, " ").trim();
  for (const [type, pattern] of ALIASES) if (pattern.test(value)) return type;
  const capacity = input?.capacity;
  if (typeof capacity === "number" && capacity > 0) { if (capacity >= 25000) return "stadium"; if (capacity >= 5000) return "arena"; if (capacity >= 700) return "theatre"; if (capacity <= 180) return "pub"; }
  return "club";
}

const p = (x: number, y: number): Point => ({ x, y });
const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
const center = (rect: Readonly<Rect>): Point => p(rect.x + rect.width / 2, rect.y + rect.height / 2);
const inside = (point: Readonly<Point>, rect: Readonly<Rect>) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
const intersects = (a: Readonly<Rect>, b: Readonly<Rect>) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const reverse = (path: readonly Readonly<Point>[]) => [...path].reverse();
const slot = (id: string, kind: DecorationKind, bounds: Rect, style = 0): DecorationSlot => ({ id, kind, bounds, style });

const SMALL: Record<"pub" | "club" | "theatre", readonly { stage: Rect; crowd: Rect[]; bar: Rect; merch: Rect; entrance: Point; decor: DecorationSlot[] }[]> = {
  pub: [
    { stage:r(.27,.12,.46,.30), crowd:[r(.25,.49,.5,.35)], bar:r(.035,.49,.15,.24), merch:r(.82,.65,.13,.14), entrance:p(.9,.94), decor:[slot("window-pair","window",r(.04,.18,.13,.11)),slot("poster-wall","poster",r(.82,.2,.06,.09)),slot("toilet-door","toilet",r(.9,.31,.065,.11)),slot("tables","table",r(.08,.78,.1,.08))] },
    { stage:r(.16,.13,.49,.29), crowd:[r(.19,.5,.48,.34),r(.69,.53,.12,.25)], bar:r(.79,.44,.17,.29), merch:r(.035,.66,.12,.13), entrance:p(.08,.94), decor:[slot("bay-window","window",r(.04,.2,.09,.16),1),slot("poster-column","poster",r(.7,.21,.055,.1),1),slot("toilet-corner","toilet",r(.88,.8,.07,.1)),slot("round-table","table",r(.69,.78,.1,.08),1)] },
    { stage:r(.38,.11,.45,.31), crowd:[r(.28,.5,.47,.34)], bar:r(.035,.43,.17,.3), merch:r(.82,.68,.13,.12), entrance:p(.5,.95), decor:[slot("front-windows","window",r(.06,.18,.22,.09),2),slot("poster-set","poster",r(.86,.2,.055,.09),2),slot("toilet-hall","toilet",r(.89,.34,.07,.1)),slot("snug-tables","table",r(.08,.79,.13,.08),2)] },
  ],
  club: [
    { stage:r(.24,.11,.48,.31), crowd:[r(.25,.5,.5,.35)], bar:r(.03,.46,.17,.31), merch:r(.82,.65,.14,.14), entrance:p(.9,.94), decor:[slot("dancefloor","light",r(.35,.69,.3,.13)),slot("booth-bank","booth",r(.78,.23,.18,.1)),slot("lighting-rig","light",r(.28,.055,.4,.04),1),slot("security-post","security",r(.82,.84,.06,.08))] },
    { stage:r(.12,.12,.47,.3), crowd:[r(.17,.49,.48,.34),r(.67,.5,.12,.25)], bar:r(.72,.41,.24,.27), merch:r(.03,.68,.13,.13), entrance:p(.08,.94), decor:[slot("sunken-floor","light",r(.29,.69,.31,.14),2),slot("curved-booths","booth",r(.72,.24,.23,.1),2),slot("cross-rig","light",r(.19,.06,.35,.04),2),slot("door-security","security",r(.1,.82,.06,.08),1)] },
    { stage:r(.39,.12,.46,.3), crowd:[r(.27,.49,.49,.35)], bar:r(.03,.42,.2,.32), merch:r(.83,.67,.13,.13), entrance:p(.51,.95), decor:[slot("central-dancefloor","light",r(.34,.68,.32,.15),3),slot("split-booths","booth",r(.05,.22,.22,.1),3),slot("grid-rig","light",r(.43,.055,.38,.04),3),slot("lobby-security","security",r(.46,.86,.08,.07),2)] },
  ],
  theatre: [
    { stage:r(.26,.1,.48,.32), crowd:[r(.25,.51,.5,.31)], bar:r(.03,.65,.16,.2), merch:r(.82,.68,.14,.14), entrance:p(.5,.95), decor:[slot("grand-curtain","curtain",r(.22,.05,.56,.035)),slot("stalls","seat",r(.3,.72,.4,.09)),slot("balcony","balcony",r(.05,.2,.14,.1)),slot("centre-aisle","aisle",r(.485,.48,.03,.4))] },
    { stage:r(.14,.11,.49,.31), crowd:[r(.18,.5,.48,.32),r(.69,.53,.11,.25)], bar:r(.79,.42,.17,.24), merch:r(.03,.68,.13,.13), entrance:p(.1,.95), decor:[slot("arched-curtain","curtain",r(.1,.055,.57,.035),1),slot("fan-stalls","seat",r(.23,.72,.37,.09),1),slot("side-balcony","balcony",r(.78,.2,.17,.1),1),slot("paired-aisles","aisle",r(.2,.48,.025,.4),1)] },
    { stage:r(.37,.1,.46,.32), crowd:[r(.27,.5,.48,.32)], bar:r(.03,.62,.17,.23), merch:r(.83,.68,.13,.13), entrance:p(.51,.95), decor:[slot("box-curtain","curtain",r(.34,.05,.52,.035),2),slot("raked-stalls","seat",r(.31,.72,.4,.09),2),slot("double-balcony","balcony",r(.05,.2,.22,.1),2),slot("separated-aisle","aisle",r(.73,.48,.03,.4),2)] },
  ],
};

function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`; return JSON.stringify(value); }
function hash(value: string) { let h=2166136261; for(let i=0;i<value.length;i++) h=Math.imul(h^value.charCodeAt(i),16777619); return (h>>>0).toString(16).padStart(8,"0"); }
function deepFreeze<T>(value:T):T { if(value && typeof value === "object" && !Object.isFrozen(value)){ Object.freeze(value); Object.values(value as object).forEach(deepFreeze); } return value; }

interface AuthoredLargeLayout { readonly stage: Rect; readonly crowd: Rect[]; readonly bars: Rect[]; readonly merch: Rect[]; readonly entrance: Point; readonly decor: DecorationSlot[]; readonly exterior?: DecorationSlot[] }

/** Phase 2B: authored arena, stadium, festival and beach rooms with distributed services. */
const LARGE: Record<"arena" | "stadium" | "festival" | "beach", readonly AuthoredLargeLayout[]> = {
  arena: [
    { stage:r(.33,.15,.34,.21), crowd:[r(.3,.38,.4,.1),r(.22,.49,.56,.13),r(.16,.63,.68,.1),r(.05,.4,.1,.29),r(.85,.4,.1,.29),r(.16,.75,.68,.08)], bars:[r(.05,.855,.11,.032),r(.84,.855,.11,.032)], merch:[r(.22,.855,.1,.032),r(.68,.855,.1,.032)], entrance:p(.5,.955), decor:[slot("screen-left","screen",r(.19,.14,.12,.08)),slot("screen-right","screen",r(.69,.14,.12,.08)),slot("stand-west","tier",r(.03,.36,.12,.36)),slot("stand-east","tier",r(.85,.36,.12,.36)),slot("stand-rear","tier",r(.14,.73,.72,.11)),slot("upper-north-west","tier",r(.02,.08,.29,.055)),slot("upper-north-east","tier",r(.69,.08,.29,.055)),slot("concourse-ring","concourse",r(.02,.85,.96,.042)),slot("tunnel-west","tunnel",r(.02,.78,.09,.045)),slot("stalls-seats","seat",r(.3,.9,.4,.035))] },
    { stage:r(.26,.16,.35,.2), crowd:[r(.24,.38,.39,.1),r(.17,.49,.55,.13),r(.66,.4,.11,.3),r(.12,.63,.66,.11),r(.03,.42,.09,.26),r(.14,.76,.66,.07)], bars:[r(.82,.83,.13,.035),r(.03,.855,.1,.032)], merch:[r(.24,.855,.1,.03),r(.66,.855,.11,.03)], entrance:p(.07,.945), decor:[slot("screen-side","screen",r(.79,.15,.12,.09),1),slot("screen-back","screen",r(.13,.14,.11,.08),1),slot("stand-north","tier",r(.63,.36,.15,.38),1),slot("stand-south","tier",r(.02,.38,.11,.34),1),slot("stand-rear","tier",r(.12,.74,.68,.1),1),slot("upper-tier","tier",r(.02,.08,.22,.06),1),slot("upper-tier-east","tier",r(.63,.08,.35,.06),1),slot("concourse-ring","concourse",r(.02,.85,.96,.04),1),slot("tunnel-east","tunnel",r(.89,.78,.09,.045),1),slot("stalls-seats","seat",r(.28,.9,.42,.035),1)] },
    { stage:r(.35,.14,.31,.22), crowd:[r(.32,.38,.36,.1),r(.24,.49,.52,.12),r(.15,.62,.7,.11),r(.05,.4,.09,.3),r(.86,.4,.09,.3),r(.13,.75,.74,.08)], bars:[r(.04,.855,.1,.03),r(.86,.855,.1,.03)], merch:[r(.2,.855,.09,.03),r(.71,.855,.09,.03)], entrance:p(.5,.965), decor:[slot("screen-pair-left","screen",r(.2,.13,.12,.09),2),slot("screen-pair-right","screen",r(.68,.13,.12,.09),2),slot("stand-west","tier",r(.03,.37,.11,.36),2),slot("stand-east","tier",r(.86,.37,.11,.36),2),slot("stand-rear","tier",r(.12,.73,.76,.12),2),slot("upper-ring-west","tier",r(.02,.075,.31,.05),2),slot("upper-ring-east","tier",r(.67,.075,.31,.05),2),slot("concourse-ring","concourse",r(.02,.85,.96,.042),2),slot("tunnel-north","tunnel",r(.02,.79,.08,.045),2),slot("stalls-seats","seat",r(.31,.9,.38,.035),2)] },
  ],
  stadium: [
    { stage:r(.37,.17,.26,.17), crowd:[r(.34,.36,.32,.09),r(.26,.46,.48,.12),r(.18,.59,.64,.11),r(.04,.37,.09,.34),r(.87,.37,.09,.34),r(.12,.72,.76,.09)], bars:[r(.06,.865,.1,.03),r(.84,.865,.1,.03),r(.45,.865,.1,.03)], merch:[r(.2,.865,.09,.03),r(.71,.865,.09,.03)], entrance:p(.5,.965), decor:[slot("giant-screen-west","screen",r(.2,.15,.13,.09)),slot("giant-screen-east","screen",r(.67,.15,.13,.09)),slot("stand-west","tier",r(.02,.33,.11,.42)),slot("stand-east","tier",r(.87,.33,.11,.42)),slot("stand-rear-lower","tier",r(.1,.7,.8,.13)),slot("stand-north-west","tier",r(.02,.075,.33,.07)),slot("stand-north-east","tier",r(.65,.075,.33,.07)),slot("concourse-ring","concourse",r(.02,.86,.96,.045)),slot("concourse-west","concourse",r(.02,.28,.11,.035)),slot("concourse-east","concourse",r(.87,.28,.11,.035)),slot("tunnel-players","tunnel",r(.66,.345,.08,.035)),slot("rear-seats","seat",r(.28,.915,.44,.035))], exterior:[slot("city-edge","promenade",r(0,.012,1,.05))] },
    { stage:r(.3,.18,.27,.16), crowd:[r(.28,.36,.31,.09),r(.2,.46,.47,.12),r(.62,.38,.12,.32),r(.14,.59,.62,.11),r(.03,.4,.09,.28),r(.12,.73,.68,.08)], bars:[r(.83,.835,.13,.035),r(.03,.865,.1,.03),r(.42,.865,.13,.03)], merch:[r(.2,.865,.09,.03),r(.66,.865,.11,.03)], entrance:p(.06,.945), decor:[slot("screen-north","screen",r(.76,.16,.13,.09),1),slot("screen-west","screen",r(.14,.15,.12,.09),1),slot("stand-south","tier",r(.02,.36,.1,.4),1),slot("stand-north","tier",r(.6,.35,.16,.4),1),slot("stand-rear-lower","tier",r(.1,.71,.72,.12),1),slot("stand-upper-west","tier",r(.02,.075,.26,.075),1),slot("stand-upper-east","tier",r(.6,.075,.38,.075),1),slot("concourse-ring","concourse",r(.02,.86,.96,.042),1),slot("concourse-north","concourse",r(.78,.32,.2,.035),1),slot("tunnel-service","tunnel",r(.02,.79,.09,.045),1),slot("rear-seats","seat",r(.26,.915,.42,.035),1)] , exterior:[slot("city-edge","promenade",r(0,.015,1,.05),1)] },
    { stage:r(.38,.16,.24,.18), crowd:[r(.36,.36,.28,.09),r(.27,.46,.46,.12),r(.16,.59,.68,.12),r(.04,.36,.08,.36),r(.88,.36,.08,.36),r(.1,.73,.8,.08)], bars:[r(.04,.865,.1,.03),r(.88,.865,.1,.03),r(.46,.865,.09,.03)], merch:[r(.19,.865,.08,.03),r(.73,.865,.08,.03)], entrance:p(.5,.97), decor:[slot("screen-tower-west","screen",r(.19,.14,.13,.1),2),slot("screen-tower-east","screen",r(.68,.14,.13,.1),2),slot("stand-west-upper","tier",r(.02,.32,.1,.44),2),slot("stand-east-upper","tier",r(.88,.32,.1,.44),2),slot("stand-rear","tier",r(.08,.71,.84,.13),2),slot("stand-behind-west","tier",r(.02,.07,.34,.07),2),slot("stand-behind-east","tier",r(.64,.07,.34,.07),2),slot("concourse-ring","concourse",r(.02,.86,.96,.045),2),slot("concourse-west","concourse",r(.02,.27,.1,.035),2),slot("concourse-east","concourse",r(.88,.27,.1,.035),2),slot("tunnel-north","tunnel",r(.66,.34,.09,.035),2),slot("rear-seats","seat",r(.3,.915,.4,.035),2)], exterior:[slot("city-edge","promenade",r(0,.012,1,.05),2)] },
  ],
  festival: [
    { stage:r(.32,.15,.36,.26), crowd:[r(.3,.44,.4,.1),r(.2,.55,.6,.13),r(.12,.69,.76,.12),r(.14,.83,.72,.07)], bars:[r(.02,.5,.11,.15),r(.86,.5,.12,.15)], merch:[r(.02,.68,.1,.1),r(.88,.68,.1,.1)], entrance:p(.5,.95), decor:[slot("crew-tent","tent",r(.04,.2,.1,.1)),slot("food-tent","tent",r(.86,.2,.1,.1)),slot("generator-bank","generator",r(.02,.88,.07,.05)),slot("delay-stack","speaker",r(.22,.16,.05,.16)),slot("delay-stack-east","speaker",r(.73,.16,.05,.16))] },
    { stage:r(.24,.15,.36,.26), crowd:[r(.24,.44,.38,.1),r(.16,.55,.56,.13),r(.66,.46,.12,.3),r(.12,.7,.7,.12),r(.16,.84,.62,.06)], bars:[r(.84,.36,.13,.11),r(.02,.52,.11,.16)], merch:[r(.02,.74,.1,.09),r(.86,.8,.11,.08)], entrance:p(.08,.94), decor:[slot("food-trucks","tent",r(.8,.14,.12,.1),1),slot("bar-tent","tent",r(.02,.18,.12,.1),1),slot("generator-row","generator",r(.9,.88,.07,.05),1),slot("delay-stack-east","speaker",r(.63,.16,.045,.16),1),slot("delay-stack-west","speaker",r(.16,.16,.045,.16),1)] },
    { stage:r(.33,.14,.34,.27), crowd:[r(.32,.44,.36,.1),r(.22,.55,.56,.13),r(.12,.69,.76,.12),r(.16,.83,.68,.07)], bars:[r(.02,.5,.1,.15),r(.88,.5,.1,.15)], merch:[r(.02,.67,.09,.09),r(.89,.67,.09,.09)], entrance:p(.5,.96), decor:[slot("village-tents","tent",r(.05,.2,.12,.1),2),slot("traders","tent",r(.83,.2,.12,.1),2),slot("generators","generator",r(.46,.9,.08,.04),2),slot("delay-towers","speaker",r(.24,.16,.05,.16),2),slot("delay-towers-east","speaker",r(.71,.16,.05,.16),2)] },
  ],

  beach: [
    { stage:r(.28,.14,.44,.30), crowd:[r(.24,.5,.5,.26),r(.16,.78,.66,.1)], bars:[r(.02,.52,.12,.16)], merch:[r(.86,.7,.12,.1)], entrance:p(.9,.94), decor:[slot("palms-west","palm",r(.04,.22,.08,.1)),slot("promenade","promenade",r(0,.86,1,.04)),slot("pier","promenade",r(.74,.14,.1,.08))] },
    { stage:r(.2,.13,.46,.31), crowd:[r(.18,.48,.52,.26),r(.72,.52,.1,.24)], bars:[r(.84,.4,.13,.14)], merch:[r(.02,.7,.11,.1)], entrance:p(.08,.94), decor:[slot("palms-east","palm",r(.88,.2,.08,.1),1),slot("promenade","promenade",r(0,.88,1,.04),1),slot("boats","water",r(.68,.14,.12,.07),1)] },
    { stage:r(.3,.12,.42,.32), crowd:[r(.28,.5,.44,.26),r(.1,.78,.8,.1)], bars:[r(.02,.5,.11,.16),r(.87,.5,.11,.16)], merch:[r(.02,.68,.1,.09)], entrance:p(.5,.96), decor:[slot("palms-pair","palm",r(.16,.16,.08,.1),2),slot("promenade","promenade",r(0,.9,1,.035),2),slot("beach-huts","tent",r(.8,.14,.12,.08),2)] },
  ],
};

/** Stage share of the scene, scaled by room size: a stadium stage should read as a small platform in a huge bowl. */
export const STAGE_SIZE_RULES: Readonly<Record<VenueArchetype, { minWidth: number; maxWidth: number; minHeight: number }>> = Object.freeze({
  pub: { minWidth: .4, maxWidth: .5, minHeight: .25 },
  club: { minWidth: .4, maxWidth: .5, minHeight: .25 },
  theatre: { minWidth: .4, maxWidth: .5, minHeight: .25 },
  arena: { minWidth: .28, maxWidth: .38, minHeight: .18 },
  stadium: { minWidth: .22, maxWidth: .32, minHeight: .14 },
  festival: { minWidth: .3, maxWidth: .4, minHeight: .2 },
  beach: { minWidth: .34, maxWidth: .48, minHeight: .2 },
});

const CAPACITY_BAND: Record<VenueArchetype, CapacityBand> = { pub:"intimate", club:"club", theatre:"mid", beach:"mid", arena:"large", stadium:"mega", festival:"mega" };
const STAFF_PER_POINT: Record<CapacityBand, number> = { intimate:1, club:1, mid:2, large:2, mega:3 };

function buildVariation(archetype: VenueArchetype, variation: VenueVariation): VenueSceneDescriptor {
  const authored = archetype === "pub" || archetype === "club" || archetype === "theatre" ? SMALL[archetype][variation] : undefined;
  const large = archetype === "arena" || archetype === "stadium" || archetype === "festival" || archetype === "beach" ? LARGE[archetype][variation] : undefined;
  const stage = authored?.stage ?? large?.stage ?? r(.28,.13,.44,.32);
  const crowdRects = authored?.crowd ?? large?.crowd ?? [r(.24,.51,.52,.35)];
  const barRects = large?.bars ?? [authored?.bar ?? r(.035,.5,.145,.22)];
  const merchRects = large?.merch ?? [authored?.merch ?? r(.835,.58,.13,.17)];
  const bar = barRects[0], merchandise = merchRects[0];
  const entrance = authored?.entrance ?? large?.entrance ?? p(.9,.91);
  const crowdZones = crowdRects.map((bounds,index)=>({id:`crowd-${index}`,...bounds,returnAnchor:center(bounds)}));
  const hub=crowdZones[0].returnAnchor, barTarget=center(bar), merchTarget=center(merchandise);
  const route=(target:Point)=>[hub,p(hub.x,.89),p(target.x,.89),target];
  const band = CAPACITY_BAND[archetype];
  const staffFor = (rect: Rect) => Array.from({ length: STAFF_PER_POINT[band] }, (_, index) => p(rect.x + rect.width * ((index + 1) / (STAFF_PER_POINT[band] + 1)), rect.y + rect.height * .28));
  const servicePoint = (kind: ServiceKind, rect: Rect, index: number): { point: ServicePoint; routes: SceneRoute[] } => {
    const id = `${kind}-${index}`;
    const target = center(rect);
    const approach = route(target);
    const queueDepth = band === "mega" ? 4 : band === "large" ? 3 : 2;
    return {
      point: {
        id, kind, bounds: rect,
        queuePoints: Array.from({ length: queueDepth }, (_, q) => p(target.x, Math.min(.9, rect.y + rect.height + .025 + q * .022))),
        staffPositions: staffFor(rect),
        approachRouteId: `crowd-to-${id}`, returnRouteId: `${id}-to-crowd`,
      },
      routes: [
        { id: `crowd-to-${id}`, from: crowdZones[0].id, to: id, waypoints: approach },
        { id: `${id}-to-crowd`, from: id, to: crowdZones[index % crowdZones.length].id, waypoints: reverse(approach) },
      ],
    };
  };
  const barPoints = barRects.map((rect,index)=>servicePoint("bar",rect,index));
  const merchPoints = merchRects.map((rect,index)=>servicePoint("merchandise",rect,index));
  const routes: SceneRoute[] = [
    ...barPoints.flatMap((x)=>x.routes), ...merchPoints.flatMap((x)=>x.routes),
    { id: "entrance-to-crowd", from: "entrance-0", to: crowdZones[0].id, waypoints: [entrance,p(entrance.x,.89),hub] },
  ];
  const genericKinds: Record<VenueArchetype, DecorationKind[]>={pub:["table","poster","window","toilet"],club:["booth","light","security","speaker"],theatre:["seat","balcony","curtain","aisle"],arena:["tier","screen","concourse","tunnel"],stadium:["tier","screen","tunnel","concourse"],festival:["tent","fence","generator","speaker"],beach:["palm","promenade","water","tent"]};
  const decorations=authored?.decor ?? large?.decor ?? genericKinds[archetype].map((kind,i)=>slot(`${kind}-${i}`,kind,r(i%2===0?.02:.91,.18+i*.075,.07,.06),i+variation));
  const exteriorSlots = large?.exterior ?? (archetype==="beach"?[slot("sea","water",r(0,.02,1,.09),variation)]:archetype==="festival"?[slot("fence","fence",r(.04,.08,.92,.03),variation)]:[]);
  const base = { descriptorVersion:VENUE_SCENE_DESCRIPTOR_VERSION,archetype,variation,capacityBand:band,seedNamespace:VENUE_LAYOUT_SEED_NAMESPACE,decorationNamespace:VENUE_DECOR_SEED_NAMESPACE,bounds:r(0,0,1,1),safeCameraBounds:r(.01,.01,.98,.98),foregroundEffectBounds:r(.18,.08,.64,.82),labelSafeBounds:r(.03,.02,.94,.07),controlSafeBounds:r(.03,.91,.94,.07),stage,bandPositions:{vocalist:p(stage.x+stage.width*.5,stage.y+stage.height*.72),guitar:p(stage.x+stage.width*.28,stage.y+stage.height*.62),bass:p(stage.x+stage.width*.72,stage.y+stage.height*.62),drums:p(stage.x+stage.width*.5,stage.y+stage.height*.28),keyboard:p(stage.x+stage.width*.78,stage.y+stage.height*.35),unknown:center(stage)},crowdZones,bar,merchandise,bars:barPoints.map(x=>x.point),merchandiseStands:merchPoints.map(x=>x.point),routes,entrances:[entrance],exits:[entrance],queuePoints:{bar:barPoints.flatMap(x=>x.point.queuePoints),merchandise:merchPoints.flatMap(x=>x.point.queuePoints),entrance:[entrance]},staffPositions:{bar:p(bar.x+bar.width*.5,bar.y+bar.height*.28),merchandise:p(merchandise.x+merchandise.width*.5,merchandise.y+merchandise.height*.28)},paths:{crowdToBar:route(barTarget),barToCrowd:reverse(route(barTarget)),crowdToMerchandise:route(merchTarget),merchandiseToCrowd:reverse(route(merchTarget)),entranceToCrowd:[entrance,p(entrance.x,.89),hub],staffToBar:[p(bar.x+bar.width*.2,bar.y+bar.height*.28),barTarget],staffToMerchandise:[p(merchandise.x+merchandise.width*.2,merchandise.y+merchandise.height*.28),merchTarget]},architecture:ARCHITECTURE[archetype],decorations,exteriorSlots };
  const structuralFingerprint=`venue-v2-${hash(canonical(base))}`;
  return deepFreeze({...base,structuralFingerprint});
}

export const VENUE_LAYOUT_REGISTRY: Readonly<Record<VenueArchetype, readonly VenueSceneDescriptor[]>> = deepFreeze(Object.fromEntries((["pub","club","theatre","arena","stadium","festival","beach"] as VenueArchetype[]).map(type=>[type,([0,1,2] as VenueVariation[]).map(v=>buildVariation(type,v))])) as unknown as Record<VenueArchetype,readonly VenueSceneDescriptor[]>);
export const SAFE_CLUB_DESCRIPTOR = VENUE_LAYOUT_REGISTRY.club[0];

export function validateVenueSceneDescriptor(scene: VenueSceneDescriptor): VenueDescriptorValidationResult {
  const errors: VenueDescriptorValidationError[]=[]; const add=(code:string,path:string,message:string)=>errors.push({code,path,message});
  const checkPoint=(v:Readonly<Point>,path:string)=>{if(!Number.isFinite(v.x)||!Number.isFinite(v.y)) add("POINT_NOT_FINITE",path,"Point coordinates must be finite"); else if(!inside(v,scene.bounds)) add("POINT_OUT_OF_BOUNDS",path,"Point must be inside scene bounds");};
  const checkRect=(v:Readonly<Rect>,path:string)=>{if(![v.x,v.y,v.width,v.height].every(Number.isFinite)) add("RECT_NOT_FINITE",path,"Rectangle values must be finite"); else {if(v.width<=0||v.height<=0)add("RECT_NOT_POSITIVE",path,"Rectangle dimensions must be positive"); if(!inside(p(v.x,v.y),scene.bounds)||!inside(p(v.x+v.width,v.y+v.height),scene.bounds))add("RECT_OUT_OF_BOUNDS",path,"Rectangle must be inside scene bounds");}};
  [[scene.bounds,"bounds"],[scene.safeCameraBounds,"safeCameraBounds"],[scene.foregroundEffectBounds,"foregroundEffectBounds"],[scene.labelSafeBounds,"labelSafeBounds"],[scene.controlSafeBounds,"controlSafeBounds"],[scene.stage,"stage"],[scene.bar,"bar"],[scene.merchandise,"merchandise"]].forEach(([v,path])=>checkRect(v as Rect,path as string));
  if(intersects(scene.labelSafeBounds,scene.stage)||intersects(scene.controlSafeBounds,scene.stage)) add("SAFE_AREA_OBSCURES_STAGE","safeBounds","Safe UI areas must not obscure the stage");
  scene.crowdZones.forEach((z,i)=>{checkRect(z,`crowdZones[${i}]`);checkPoint(z.returnAnchor,`crowdZones[${i}].returnAnchor`);if(!inside(z.returnAnchor,z))add("CROWD_RETURN_ANCHOR_INVALID",`crowdZones[${i}].returnAnchor`,"Return anchor must be inside its crowd zone");if(intersects(z,scene.stage))add("STAGE_CROWD_OVERLAP",`crowdZones[${i}]`,"Crowd zone must not overlap stage");});
  Object.entries(scene.bandPositions).forEach(([id,v])=>{checkPoint(v,`bandPositions.${id}`);if(!inside(v,scene.stage))add("BAND_ANCHOR_OUTSIDE_STAGE",`bandPositions.${id}`,"Band anchor must be inside stage");});
  const fixtureChecks: Array<readonly [Readonly<Rect>, string]> = [[scene.bar,"bar"],[scene.merchandise,"merchandise"],...scene.decorations.map((d)=>[d.bounds,`decorations.${d.id}`] as const),...scene.exteriorSlots.map(d=>[d.bounds,`exteriorSlots.${d.id}`] as const)];
  fixtureChecks.forEach(([v,path])=>{checkRect(v,path);if(intersects(v,scene.stage))add("FIXTURE_STAGE_OVERLAP",path,"Fixture must not intersect stage");});
  scene.entrances.forEach((v,i)=>checkPoint(v,`entrances[${i}]`)); scene.exits.forEach((v,i)=>checkPoint(v,`exits[${i}]`));
  Object.entries(scene.queuePoints).forEach(([kind,points])=>points.forEach((v,i)=>{checkPoint(v,`queuePoints.${kind}[${i}]`);if(inside(v,scene.stage))add("QUEUE_POINT_ON_STAGE",`queuePoints.${kind}[${i}]`,"Queue point must be outside stage");}));
  Object.entries(scene.paths).forEach(([name,points])=>{if(points.length<2)add("PATH_TOO_SHORT",`paths.${name}`,"Path needs at least two waypoints");points.forEach((v,i)=>{checkPoint(v,`paths.${name}[${i}]`);if((name.startsWith("crowd")||name.startsWith("barTo")||name.startsWith("merchandiseTo")||name==="entranceToCrowd")&&inside(v,scene.stage))add("AUDIENCE_PATH_CROSSES_STAGE",`paths.${name}[${i}]`,"Audience paths must avoid stage");});});
  const endpointInside=(name:PathName,index:number,target:Readonly<Rect>|Readonly<Point>)=>{const path=scene.paths[name], value=path[index<0?path.length+index:index];const ok="width" in target?inside(value,target):value.x===target.x&&value.y===target.y;if(!ok)add("PATH_ENDPOINT_MISMATCH",`paths.${name}`,"Path endpoint does not match its intended target");};
  endpointInside("crowdToBar",-1,scene.bar); endpointInside("barToCrowd",-1,scene.crowdZones[0]); endpointInside("crowdToMerchandise",-1,scene.merchandise); endpointInside("merchandiseToCrowd",-1,scene.crowdZones[0]); endpointInside("entranceToCrowd",0,scene.entrances[0]); endpointInside("entranceToCrowd",-1,scene.crowdZones[0]); endpointInside("staffToBar",-1,scene.bar); endpointInside("staffToMerchandise",-1,scene.merchandise);
  const services = [...scene.bars, ...scene.merchandiseStands];
  const routeById = new Map(scene.routes.map((route)=>[route.id,route] as const));
  services.forEach((point,index)=>{
    const path=`${point.kind === "bar" ? "bars" : "merchandiseStands"}[${index}]`;
    checkRect(point.bounds,`${path}.bounds`);
    if(intersects(point.bounds,scene.stage)) add("SERVICE_POINT_ON_STAGE",path,"Service point must not intersect stage");
    if(point.queuePoints.length===0) add("SERVICE_POINT_NO_QUEUE",path,"Service point needs at least one queue slot");
    point.queuePoints.forEach((v,q)=>{checkPoint(v,`${path}.queuePoints[${q}]`);if(inside(v,scene.stage))add("QUEUE_POINT_ON_STAGE",`${path}.queuePoints[${q}]`,"Queue point must be outside stage");});
    if(point.staffPositions.length===0) add("SERVICE_POINT_NO_STAFF",path,"Service point needs at least one staff anchor");
    point.staffPositions.forEach((v,s)=>checkPoint(v,`${path}.staffPositions[${s}]`));
    [point.approachRouteId,point.returnRouteId].forEach((id)=>{ if(!routeById.has(id)) add("SERVICE_ROUTE_MISSING",`${path}.${id}`,"Service point references an unknown route"); });
    const approach=routeById.get(point.approachRouteId);
    if(approach && !inside(approach.waypoints[approach.waypoints.length-1],point.bounds)) add("ROUTE_ENDPOINT_MISMATCH",`routes.${point.approachRouteId}`,"Approach route must end inside its service point");
  });
  scene.routes.forEach((route)=>{
    if(route.waypoints.length<2) add("ROUTE_TOO_SHORT",`routes.${route.id}`,"Route needs at least two waypoints");
    route.waypoints.forEach((v,i)=>{checkPoint(v,`routes.${route.id}[${i}]`);if(inside(v,scene.stage))add("ROUTE_CROSSES_STAGE",`routes.${route.id}[${i}]`,"Audience routes must avoid stage");});
  });
  const unique=(items:readonly {id:string}[],path:string)=>{const seen=new Set<string>();items.forEach(x=>{if(seen.has(x.id))add("DUPLICATE_ID",path,`Duplicate id: ${x.id}`);seen.add(x.id);});}; unique(scene.crowdZones,"crowdZones");unique(scene.decorations,"decorations");unique(scene.exteriorSlots,"exteriorSlots");unique(services,"servicePoints");unique(scene.routes,"routes");
  const stageRule = STAGE_SIZE_RULES[scene.archetype];
  if(scene.stage.width<stageRule.minWidth||scene.stage.width>stageRule.maxWidth||scene.stage.height<stageRule.minHeight)add("STAGE_NOT_READABLE","stage",`Stage must occupy ${Math.round(stageRule.minWidth*100)}-${Math.round(stageRule.maxWidth*100)}% of scene width and remain readable`);
  return {valid:errors.length===0,errors};
}

export interface GenerateVenueSceneInput { gigId?:string|null;venueId?:string|null;venueName?:string|null;venueType?:string|null;capacity?:number|null;variation?:VenueVariation;candidate?:VenueSceneDescriptor|null }
/** Produces a named deterministic fixture input without bypassing resolution. */
export function deterministicVenueVariationSeed(archetype: VenueArchetype, variation: VenueVariation): string {
  for (let index=0; index<1000; index++) {
    const seed=`demo-${archetype}-variation-${variation}-${index}`;
    if (seededIndex(`${VENUE_LAYOUT_SEED_NAMESPACE}:${seed}:${archetype}`,3)===variation) return seed;
  }
  throw new Error("Unable to resolve deterministic venue variation seed");
}
export function generateVenueScene(input:GenerateVenueSceneInput):VenueSceneDescriptor {
  if(input.candidate) return validateVenueSceneDescriptor(input.candidate).valid?input.candidate:SAFE_CLUB_DESCRIPTOR;
  const archetype=resolveVenueArchetype(input); const seed=input.gigId||[input.venueId,input.venueName,input.venueType,input.capacity].filter(v=>v!=null&&v!=="").join("|")||"unknown-venue";
  const variation=input.variation??seededIndex(`${VENUE_LAYOUT_SEED_NAMESPACE}:${seed}:${archetype}`,3) as VenueVariation;
  const selected=VENUE_LAYOUT_REGISTRY[archetype]?.[variation]; return selected&&validateVenueSceneDescriptor(selected).valid?selected:SAFE_CLUB_DESCRIPTOR;
}
