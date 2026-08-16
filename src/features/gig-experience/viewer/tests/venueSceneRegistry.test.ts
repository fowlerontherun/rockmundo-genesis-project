import { describe, expect, it } from "vitest";
import { deterministicVenueVariationSeed, generateVenueScene, resolveVenueArchetype, SAFE_CLUB_DESCRIPTOR, validateVenueSceneDescriptor, VENUE_LAYOUT_REGISTRY, VENUE_SCENE_DESCRIPTOR_VERSION, STAGE_SIZE_RULES, type VenueSceneDescriptor } from "../engine/VenueSceneRegistry";

const mutable = (descriptor: VenueSceneDescriptor): any => JSON.parse(JSON.stringify(descriptor));

describe("versioned venue scene descriptors", () => {
  it.each([["Pub","pub"],["Night Club","club"],["concert theatre","theatre"],["sports arena","arena"],["Olympic Stadium","stadium"],["open-air festival","festival"],["seafront stage","beach"]] as const)("normalises %s",(venueType,expected)=>expect(resolveVenueArchetype({venueType})).toBe(expected));

  it("registers and validates three descriptors for all seven archetypes", () => {
    expect(Object.keys(VENUE_LAYOUT_REGISTRY)).toHaveLength(7);
    for (const descriptors of Object.values(VENUE_LAYOUT_REGISTRY)) {
      expect(descriptors).toHaveLength(3);
      for (const descriptor of descriptors) expect(validateVenueSceneDescriptor(descriptor)).toEqual({valid:true,errors:[]});
    }
  });

  it("keeps all nine small stages at 40–50% of useful scene width", () => {
    for (const archetype of ["pub","club","theatre"] as const) for (const descriptor of VENUE_LAYOUT_REGISTRY[archetype]) {
      expect(descriptor.stage.width).toBeGreaterThanOrEqual(.4); expect(descriptor.stage.width).toBeLessThanOrEqual(.5);
    }
  });

  it("authors materially distinct small layouts rather than mirrored copies", () => {
    for (const archetype of ["pub","club","theatre"] as const) {
      const signatures=VENUE_LAYOUT_REGISTRY[archetype].map(d=>JSON.stringify({stage:d.stage,crowds:d.crowdZones.map(z=>({x:z.x,y:z.y,width:z.width,height:z.height})),kinds:d.decorations.map(x=>x.kind),bar:d.bar}));
      expect(new Set(signatures)).toHaveLength(3);
      expect(new Set(VENUE_LAYOUT_REGISTRY[archetype].map(d=>d.structuralFingerprint))).toHaveLength(3);
    }
  });

  it("is JSON data, deeply frozen, identifier-free, and deterministic", () => {
    const descriptor=generateVenueScene({gigId:"private-gig-id",venueId:"private-venue-id",venueType:"pub"});
    expect(descriptor.descriptorVersion).toBe(VENUE_SCENE_DESCRIPTOR_VERSION);
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor);
    expect(Object.isFrozen(descriptor)).toBe(true); expect(Object.isFrozen(descriptor.stage)).toBe(true); expect(Object.isFrozen(descriptor.decorations[0].bounds)).toBe(true);
    expect(JSON.stringify(descriptor)).not.toContain("private-gig-id"); expect(descriptor).toBe(generateVenueScene({gigId:"private-gig-id",venueType:"pub"}));
  });

  it("allows explicit production-path fixture seeds to guarantee controlled variants", () => {
    for(const archetype of ["pub","club","theatre"] as const) for(const variation of [0,1,2] as const) expect(generateVenueScene({gigId:deterministicVenueVariationSeed(archetype,variation),venueType:archetype}).variation).toBe(variation);
  });

  it.each([
    ["POINT_OUT_OF_BOUNDS",(d:any)=>{d.entrances[0].x=2;}],
    ["STAGE_CROWD_OVERLAP",(d:any)=>{d.crowdZones[0].x=d.stage.x;d.crowdZones[0].y=d.stage.y;}],
    ["DUPLICATE_ID",(d:any)=>{d.decorations[1].id=d.decorations[0].id;}],
    ["PATH_TOO_SHORT",(d:any)=>{d.paths.crowdToBar=[d.paths.crowdToBar[0]];}],
    ["CROWD_RETURN_ANCHOR_INVALID",(d:any)=>{d.crowdZones[0].returnAnchor={x:0,y:0};}],
    ["PATH_ENDPOINT_MISMATCH",(d:any)=>{d.paths.staffToBar[d.paths.staffToBar.length-1]={x:.5,y:.9};}],
  ])("reports %s",(code,breakIt)=>{const descriptor=mutable(SAFE_CLUB_DESCRIPTOR);breakIt(descriptor);expect(validateVenueSceneDescriptor(descriptor).errors.map(e=>e.code)).toContain(code);});

  it("falls back at runtime for invalid external candidates",()=>{const descriptor=mutable(SAFE_CLUB_DESCRIPTOR);descriptor.stage.x=2;expect(generateVenueScene({candidate:descriptor})).toBe(SAFE_CLUB_DESCRIPTOR);});
  it("gives every crowd zone an in-zone return anchor",()=>{for(const descriptors of Object.values(VENUE_LAYOUT_REGISTRY))for(const d of descriptors)for(const z of d.crowdZones){expect(z.returnAnchor.x).toBeGreaterThanOrEqual(z.x);expect(z.returnAnchor.x).toBeLessThanOrEqual(z.x+z.width);}});
});

describe("phase 2B large venue descriptors", () => {
  const LARGE_TYPES = ["arena", "stadium", "festival", "beach"] as const;

  it("scales the stage share to the room so large venues read as big rooms", () => {
    for (const descriptors of Object.values(VENUE_LAYOUT_REGISTRY)) for (const d of descriptors) {
      const rule = STAGE_SIZE_RULES[d.archetype];
      expect(d.stage.width).toBeGreaterThanOrEqual(rule.minWidth);
      expect(d.stage.width).toBeLessThanOrEqual(rule.maxWidth);
      expect(d.stage.height).toBeGreaterThanOrEqual(rule.minHeight);
    }
    for (const d of VENUE_LAYOUT_REGISTRY.stadium) expect(d.stage.width).toBeLessThan(VENUE_LAYOUT_REGISTRY.club[0].stage.width);
  });

  it("gives arenas and stadiums stands, concourses and floor depth", () => {
    for (const archetype of ["arena", "stadium"] as const) for (const d of VENUE_LAYOUT_REGISTRY[archetype]) {
      expect(d.crowdZones.length).toBeGreaterThanOrEqual(5);
      const kinds = d.decorations.map((slot) => slot.kind);
      expect(kinds.filter((kind) => kind === "tier").length).toBeGreaterThanOrEqual(4);
      expect(kinds).toContain("concourse");
      const deepest = Math.max(...d.crowdZones.map((zone) => zone.y + zone.height));
      expect(deepest).toBeGreaterThan(.75);
    }
  });

  it("authors three materially distinct large layouts per archetype", () => {
    for (const archetype of LARGE_TYPES) {
      const descriptors = VENUE_LAYOUT_REGISTRY[archetype];
      expect(descriptors).toHaveLength(3);
      for (const d of descriptors) expect(validateVenueSceneDescriptor(d)).toEqual({ valid: true, errors: [] });
      expect(new Set(descriptors.map(d => d.structuralFingerprint))).toHaveLength(3);
      expect(new Set(descriptors.map(d => JSON.stringify({ stage: d.stage, crowd: d.crowdZones.map(z => [z.x, z.y, z.width, z.height]), bars: d.bars.map(b => b.bounds), decor: d.decorations.map(x => x.kind) })))).toHaveLength(3);
    }
  });

  it("scales distributed services and staffing by capacity band", () => {
    for (const archetype of ["arena", "stadium", "festival"] as const) for (const d of VENUE_LAYOUT_REGISTRY[archetype]) {
      expect(d.bars.length).toBeGreaterThanOrEqual(2);
      expect(d.merchandiseStands.length).toBeGreaterThanOrEqual(2);
      for (const point of [...d.bars, ...d.merchandiseStands]) expect(point.staffPositions.length).toBeGreaterThanOrEqual(2);
    }
    for (const d of VENUE_LAYOUT_REGISTRY.pub) { expect(d.bars).toHaveLength(1); expect(d.bars[0].staffPositions).toHaveLength(1); }
    expect(VENUE_LAYOUT_REGISTRY.stadium[0].capacityBand).toBe("mega");
    expect(VENUE_LAYOUT_REGISTRY.pub[0].capacityBand).toBe("intimate");
  });

  it("gives every service point resolvable approach and return routes", () => {
    for (const descriptors of Object.values(VENUE_LAYOUT_REGISTRY)) for (const d of descriptors) {
      const ids = new Set(d.routes.map(r => r.id));
      for (const point of [...d.bars, ...d.merchandiseStands]) {
        expect(ids.has(point.approachRouteId)).toBe(true);
        expect(ids.has(point.returnRouteId)).toBe(true);
      }
      for (const route of d.routes) expect(route.waypoints.length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each([
    ["SERVICE_POINT_ON_STAGE", (d: any) => { d.bars[0].bounds = { ...d.stage }; }],
    ["SERVICE_POINT_NO_QUEUE", (d: any) => { d.bars[0].queuePoints = []; }],
    ["SERVICE_ROUTE_MISSING", (d: any) => { d.bars[0].approachRouteId = "nope"; }],
    ["ROUTE_TOO_SHORT", (d: any) => { d.routes[0].waypoints = [d.routes[0].waypoints[0]]; }],
  ])("reports %s", (code, breakIt) => {
    const descriptor = mutable(SAFE_CLUB_DESCRIPTOR); breakIt(descriptor);
    expect(validateVenueSceneDescriptor(descriptor).errors.map(e => e.code)).toContain(code);
  });
});
