import {describe,expect,it} from "vitest";
import {appliedHistory,calculateEvidenceOutcome,licenceProgress,mapAchievement,outcomeAppliedAt,performanceEffectReference,resolveArtistIdentity,transitionEffect} from "./outcomeLifecycle";
describe("Festival outcome lifecycle",()=>{
 it("weights only runtime evidence and exposes missing evidence",()=>{const r=calculateEvidenceOutcome({performance:{source:"performance_sessions.score",raw:90,weight:3},queues:{source:"runtime.queue_minutes",raw:null,weight:1}});expect(r.score).toBe(90);expect(r.components.queues).toMatchObject({available:false,effectiveWeight:0,missing:"redistribute"});expect(r.components.performance.weightedContribution).toBe(90)});
 it("never invents a neutral score without evidence",()=>expect(calculateEvidenceOutcome({sound:{source:"upgrade",raw:null,weight:1}}).score).toBeNull());
 it("resolves the canonical performer instead of a contract id",()=>expect(resolveArtistIdentity({performer_type:"band",performer_id:"band-1"},{band_id:"other"})).toEqual({subjectType:"band",subjectId:"band-1"}));
 it("rejects unresolved artists",()=>expect(resolveArtistIdentity({performer_id:"contract-1"})).toBeNull());
 it("enforces transitions and completion",()=>{expect(transitionEffect("pending","applying")).toBe("applying");expect(()=>transitionEffect("pending","applied")).toThrow();expect(outcomeAppliedAt(["applied","not_applicable"],"now")).toBe("now");expect(outcomeAppliedAt(["applied","pending"],"now")).toBeNull()});
 it("builds stable performance idempotency references",()=>expect(performanceEffectReference("session","band_fans","band")).toBe("festival-performance:session:band_fans:band"));
 it("maps existing achievement keys and licence requirements",()=>{expect(mapAchievement("festival.sell_out")).toBe("festival.sell_out");expect(mapAchievement("made.up")).toBeNull();expect(licenceProgress({attendance:true,safety:false})).toEqual({requirementsMet:["attendance"],requirementsMissing:["safety"],percentageProgress:50,applicationEligible:false})});
 it("history uses applied results only",()=>expect(appliedHistory([{stableReference:"a",status:"pending",appliedResult:{delta:5}},{stableReference:"b",status:"applied",appliedResult:{delta:3},canonicalId:"tx"}])).toEqual([{stableReference:"b",status:"applied",appliedResult:{delta:3},canonicalId:"tx"}]))
});
