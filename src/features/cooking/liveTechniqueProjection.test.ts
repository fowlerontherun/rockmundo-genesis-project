import { describe, expect, it } from "vitest";
import { projectLiveTechnique, visualTechniqueStage, type TechniqueServerAction } from "./liveTechniqueProjection";
const start="2026-10-22T10:00:00Z";
const expire="2026-10-22T10:02:00Z";
const anchor=Date.parse(start);
const act=(sequence:number,type:string,second:number,ingredient:string|null=null,heat:string|null=null):TechniqueServerAction=>
  ({action_sequence:sequence,action_type:type,ingredient_slug:ingredient,heat,recorded_at:new Date(anchor+second*1000).toISOString()});
describe("server-anchored non-pan cooking visuals",()=>{
  it("reflects oven heating and cooling while never granting client scores",()=>{
    const events=[
      act(1,"add",1,"apples"),act(2,"add",2,"flour"),
      act(3,"heat",3,null,"medium")];
    const warming=projectLiveTechnique("oven",["apples","flour"],events,start,expire,anchor+13000,true);
    expect(warming.stage).toBe("Warming");
    expect(warming.exposure).toBe(10);
    expect(warming.heat).toBe("medium");
    const ideal=projectLiveTechnique("oven",["apples","flour"],events,start,expire,anchor+18000,true);
    expect(ideal.stage).toBe("Ready");
    expect(ideal.exposure).toBe(15);
    const burned=projectLiveTechnique("oven",["apples","flour"],events,start,expire,anchor+40000,true);
    expect(burned.stage).toBe("Burnt");
    expect(burned).not.toHaveProperty("score");
    expect(burned).not.toHaveProperty("foodBatchId");
  });
  it("respects turning off the stove then plating the stew",()=>{
    const events=[
      act(1,"add",1,"rice"),act(2,"heat",2,null,"medium"),
      act(3,"heat",14,null,"off"),act(4,"remove",25,"rice")];
    const view=projectLiveTechnique("simmer",["rice"],events,start,expire,anchor+28000,true);
    expect(view.exposure).toBe(12);
    expect(view.stage).toBe("Ready");
    expect(view.served).toEqual(["rice"]);
    expect(view.heat).toBe("off");
  });
  it("shows drinks being mixed but not heat-exposed",()=>{
    const base=[act(1,"add",1,"tea"),act(2,"add",2,"milk")];
    const before=projectLiveTechnique("mix",["tea","milk"],base,start,expire,anchor+5000,true);
    expect(before.stage).toBe("Unmixed");
    expect(before.heat).toBe("off");
    const stirred=projectLiveTechnique("mix",["tea","milk"],
      [...base,act(3,"stir",3),act(4,"stir",4),act(5,"stir",5)],
      start,expire,anchor+12000,true);
    expect(stirred.stage).toBe("Ready");
    expect(stirred.stirs).toBe(3);
    expect(stirred.exposure).toBe(0);
  });
  it("ignores malformed future actions and respects server deadline",()=>{
    const events=[act(1,"add",1,"flour"),act(2,"heat",2,null,"medium"),
      act(3,"heat",999,null,"high")];
    const result=projectLiveTechnique("oven",["flour"],events,start,expire,anchor+300000,true);
    expect(result.exposure).toBe(118);
    expect(result.stage).toBe("Burnt");
    expect(result.deadlineSeconds).toBe(0);
    expect(result.heat).toBe("medium");
  });
  it("supports the oven, pot and jug ready windows",()=>{
    expect(visualTechniqueStage("oven",15,0)).toBe("Ready");
    expect(visualTechniqueStage("oven",23,0)).toBe("Overdone");
    expect(visualTechniqueStage("oven",31,0)).toBe("Burnt");
    expect(visualTechniqueStage("simmer",12,0)).toBe("Ready");
    expect(visualTechniqueStage("simmer",20,0)).toBe("Overdone");
    expect(visualTechniqueStage("simmer",30,0)).toBe("Burnt");
    expect(visualTechniqueStage("mix",0,2)).toBe("Mixing");
    expect(visualTechniqueStage("mix",0,3)).toBe("Ready");
  });
});
