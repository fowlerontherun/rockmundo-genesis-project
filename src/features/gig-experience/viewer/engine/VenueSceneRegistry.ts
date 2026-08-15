import type { Point, Rect } from "./Viewport";
import { seededIndex } from "./SeededRandom";

export const VENUE_SCENE_DESCRIPTOR_VERSION = 2 as const;
export const VENUE_LAYOUT_SEED_NAMESPACE = "layout-v2" as const;
export const VENUE_DECOR_SEED_NAMESPACE = "decor-v2" as const;
export type VenueVariation = 0 | 1 | 2;
export type VenueArchetype = "pub" | "club" | "theatre" | "arena" | "stadium" | "festival" | "beach";
export type VenueArchitecture = "brick-room" | "nightclub" | "proscenium" | "arena-bowl" | "stadium-stands" | "festival-field" | "beachfront";
export type DecorationKind = "table" | "poster" | "booth" | "seat" | "balcony" | "screen" | "tier" | "tunnel" | "tent" | "fence" | "generator" | "palm" | "promenade" | "water" | "speaker" | "light" | "window" | "toilet" | "security" | "curtain" | "aisle";
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

function buildVariation(archetype: VenueArchetype, variation: VenueVariation): VenueSceneDescriptor {
  const authored = archetype === "pub" || archetype === "club" || archetype === "theatre" ? SMALL[archetype][variation] : undefined;
  const width = archetype === "stadium" ? [.64,.68,.61][variation] : [.58,.63,.55][variation];
  const stage = authored?.stage ?? r((1-width)/2+(variation===2?-.025:0),.13+variation*.012,width,.32);
  const crowdRects = authored?.crowd ?? (variation===0?[r(.24,.51,.52,.35)]:variation===1?[r(.2,.51,.6,.2),r(.27,.73,.46,.14)]:[r(.25,.5,.48,.37),r(.73,.57,.06,.22)]);
  const bar = authored?.bar ?? (variation===1?r(.82,.5,.145,.22):r(.035,.5,.145,.22));
  const merchandise = authored?.merch ?? (variation===1?r(.035,.58,.13,.17):r(.835,.58,.13,.17));
  const entrance = authored?.entrance ?? (variation===1?p(.1,.91):p(.9,.91));
  const crowdZones = crowdRects.map((bounds,index)=>({id:`crowd-${index}`,...bounds,returnAnchor:center(bounds)}));
  const hub=crowdZones[0].returnAnchor, barTarget=center(bar), merchTarget=center(merchandise);
  const route=(target:Point)=>[hub,p(hub.x,.89),p(target.x,.89),target];
  const genericKinds: Record<VenueArchetype, DecorationKind[]>={pub:["table","poster","window","toilet"],club:["booth","light","security","speaker"],theatre:["seat","balcony","curtain","aisle"],arena:["tier","screen","seat","tunnel"],stadium:["tier","screen","tunnel","seat"],festival:["tent","fence","generator","speaker"],beach:["palm","promenade","water","tent"]};
  const decorations=authored?.decor ?? genericKinds[archetype].map((kind,i)=>slot(`${kind}-${i}`,kind,r(i%2===0?.02:.91,.18+i*.075,.07,.06),i+variation));
  const base = { descriptorVersion:VENUE_SCENE_DESCRIPTOR_VERSION,archetype,variation,seedNamespace:VENUE_LAYOUT_SEED_NAMESPACE,decorationNamespace:VENUE_DECOR_SEED_NAMESPACE,bounds:r(0,0,1,1),safeCameraBounds:r(.01,.01,.98,.98),foregroundEffectBounds:r(.18,.08,.64,.82),labelSafeBounds:r(.03,.02,.94,.07),controlSafeBounds:r(.03,.91,.94,.07),stage,bandPositions:{vocalist:p(stage.x+stage.width*.5,stage.y+stage.height*.72),guitar:p(stage.x+stage.width*.28,stage.y+stage.height*.62),bass:p(stage.x+stage.width*.72,stage.y+stage.height*.62),drums:p(stage.x+stage.width*.5,stage.y+stage.height*.28),keyboard:p(stage.x+stage.width*.78,stage.y+stage.height*.35),unknown:center(stage)},crowdZones,bar,merchandise,entrances:[entrance],exits:[entrance],queuePoints:{bar:[p(barTarget.x,Math.min(.88,bar.y+bar.height+.03))],merchandise:[p(merchTarget.x,Math.min(.88,merchandise.y+merchandise.height+.03))],entrance:[entrance]},staffPositions:{bar:p(bar.x+bar.width*.5,bar.y+bar.height*.28),merchandise:p(merchandise.x+merchandise.width*.5,merchandise.y+merchandise.height*.28)},paths:{crowdToBar:route(barTarget),barToCrowd:reverse(route(barTarget)),crowdToMerchandise:route(merchTarget),merchandiseToCrowd:reverse(route(merchTarget)),entranceToCrowd:[entrance,p(entrance.x,.89),hub],staffToBar:[p(bar.x+bar.width*.2,bar.y+bar.height*.28),barTarget],staffToMerchandise:[p(merchandise.x+merchandise.width*.2,merchandise.y+merchandise.height*.28),merchTarget]},architecture:ARCHITECTURE[archetype],decorations,exteriorSlots:archetype==="beach"?[slot("sea","water",r(0,.02,1,.09),variation)]:archetype==="festival"?[slot("fence","fence",r(.04,.08,.92,.03),variation)]:[]};
  const structuralFingerprint=`venue-v2-${hash(canonical(base))}`;
  return deepFreeze({...base,structuralFingerprint});
}

export const VENUE_LAYOUT_REGISTRY: Readonly<Record<VenueArchetype, readonly VenueSceneDescriptor[]>> = deepFreeze(Object.fromEntries((["pub","club","theatre","arena","stadium","festival","beach"] as VenueArchetype[]).map(type=>[type,([0,1,2] as VenueVariation[]).map(v=>buildVariation(type,v))])) as Record<VenueArchetype,readonly VenueSceneDescriptor[]>);
export const SAFE_CLUB_DESCRIPTOR = VENUE_LAYOUT_REGISTRY.club[0];

export function validateVenueSceneDescriptor(scene: VenueSceneDescriptor): VenueDescriptorValidationResult {
  const errors: VenueDescriptorValidationError[]=[]; const add=(code:string,path:string,message:string)=>errors.push({code,path,message});
  const checkPoint=(v:Readonly<Point>,path:string)=>{if(!Number.isFinite(v.x)||!Number.isFinite(v.y)) add("POINT_NOT_FINITE",path,"Point coordinates must be finite"); else if(!inside(v,scene.bounds)) add("POINT_OUT_OF_BOUNDS",path,"Point must be inside scene bounds");};
  const checkRect=(v:Readonly<Rect>,path:string)=>{if(![v.x,v.y,v.width,v.height].every(Number.isFinite)) add("RECT_NOT_FINITE",path,"Rectangle values must be finite"); else {if(v.width<=0||v.height<=0)add("RECT_NOT_POSITIVE",path,"Rectangle dimensions must be positive"); if(!inside(p(v.x,v.y),scene.bounds)||!inside(p(v.x+v.width,v.y+v.height),scene.bounds))add("RECT_OUT_OF_BOUNDS",path,"Rectangle must be inside scene bounds");}};
  [[scene.bounds,"bounds"],[scene.safeCameraBounds,"safeCameraBounds"],[scene.foregroundEffectBounds,"foregroundEffectBounds"],[scene.labelSafeBounds,"labelSafeBounds"],[scene.controlSafeBounds,"controlSafeBounds"],[scene.stage,"stage"],[scene.bar,"bar"],[scene.merchandise,"merchandise"]].forEach(([v,path])=>checkRect(v as Rect,path as string));
  if(intersects(scene.labelSafeBounds,scene.stage)||intersects(scene.controlSafeBounds,scene.stage)) add("SAFE_AREA_OBSCURES_STAGE","safeBounds","Safe UI areas must not obscure the stage");
  scene.crowdZones.forEach((z,i)=>{checkRect(z,`crowdZones[${i}]`);checkPoint(z.returnAnchor,`crowdZones[${i}].returnAnchor`);if(!inside(z.returnAnchor,z))add("CROWD_RETURN_ANCHOR_INVALID",`crowdZones[${i}].returnAnchor`,"Return anchor must be inside its crowd zone");if(intersects(z,scene.stage))add("STAGE_CROWD_OVERLAP",`crowdZones[${i}]`,"Crowd zone must not overlap stage");});
  Object.entries(scene.bandPositions).forEach(([id,v])=>{checkPoint(v,`bandPositions.${id}`);if(!inside(v,scene.stage))add("BAND_ANCHOR_OUTSIDE_STAGE",`bandPositions.${id}`,"Band anchor must be inside stage");});
  [[scene.bar,"bar"],[scene.merchandise,"merchandise"],...scene.decorations.map((d)=>[d.bounds,`decorations.${d.id}`] as const),...scene.exteriorSlots.map(d=>[d.bounds,`exteriorSlots.${d.id}`] as const)].forEach(([v,path])=>{checkRect(v,path);if(intersects(v,scene.stage))add("FIXTURE_STAGE_OVERLAP",path,"Fixture must not intersect stage");});
  Object.entries(scene.queuePoints).forEach(([kind,points])=>points.forEach((v,i)=>{checkPoint(v,`queuePoints.${kind}[${i}]`);if(inside(v,scene.stage))add("QUEUE_POINT_ON_STAGE",`queuePoints.${kind}[${i}]`,"Queue point must be outside stage");}));
  Object.entries(scene.paths).forEach(([name,points])=>{if(points.length<2)add("PATH_TOO_SHORT",`paths.${name}`,"Path needs at least two waypoints");points.forEach((v,i)=>{checkPoint(v,`paths.${name}[${i}]`);if((name.startsWith("crowd")||name.startsWith("barTo")||name.startsWith("merchandiseTo")||name==="entranceToCrowd")&&inside(v,scene.stage))add("AUDIENCE_PATH_CROSSES_STAGE",`paths.${name}[${i}]`,"Audience paths must avoid stage");});});
  const endpointInside=(name:PathName,index:number,target:Readonly<Rect>|Readonly<Point>)=>{const path=scene.paths[name], value=path[index<0?path.length+index:index];const ok="width" in target?inside(value,target):value.x===target.x&&value.y===target.y;if(!ok)add("PATH_ENDPOINT_MISMATCH",`paths.${name}`,"Path endpoint does not match its intended target");};
  endpointInside("crowdToBar",-1,scene.bar); endpointInside("barToCrowd",-1,scene.crowdZones[0]); endpointInside("crowdToMerchandise",-1,scene.merchandise); endpointInside("merchandiseToCrowd",-1,scene.crowdZones[0]); endpointInside("entranceToCrowd",0,scene.entrances[0]); endpointInside("entranceToCrowd",-1,scene.crowdZones[0]); endpointInside("staffToBar",-1,scene.bar); endpointInside("staffToMerchandise",-1,scene.merchandise);
  const unique=(items:readonly {id:string}[],path:string)=>{const seen=new Set<string>();items.forEach(x=>{if(seen.has(x.id))add("DUPLICATE_ID",path,`Duplicate id: ${x.id}`);seen.add(x.id);});}; unique(scene.crowdZones,"crowdZones");unique(scene.decorations,"decorations");unique(scene.exteriorSlots,"exteriorSlots");
  if(scene.stage.width<.4||scene.stage.height<.25)add("STAGE_NOT_READABLE","stage","Stage must remain readable in the wide scene");
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
