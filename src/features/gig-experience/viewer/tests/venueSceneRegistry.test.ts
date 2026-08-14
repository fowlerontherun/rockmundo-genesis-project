import { describe, expect, it } from "vitest";
import { deterministicVenueVariationSeed, generateVenueScene, resolveVenueArchetype, SAFE_CLUB_DESCRIPTOR, validateVenueSceneDescriptor, VENUE_LAYOUT_REGISTRY, VENUE_SCENE_DESCRIPTOR_VERSION, type VenueSceneDescriptor } from "../engine/VenueSceneRegistry";

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
