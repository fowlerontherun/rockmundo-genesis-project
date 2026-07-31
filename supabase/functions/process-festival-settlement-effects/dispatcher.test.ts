import { describe, expect, it } from "vitest";
import { EFFECT_TYPES, authorityFor, dispatchFestivalEffect, FestivalEffectError, type Effect } from "./dispatcher";

const effect = (overrides: Partial<Effect> = {}): Effect => ({ id:"e",settlement_id:"s",outcome_id:"o",effect_type:"band_fans",subject_type:"band",subject_id:"b",stable_reference:"festival-performance:p:band_fans:b",requested_payload:{delta:2},claim_token:"c",...overrides });
describe("Festival effect dispatcher", () => {
  it("maps every supported effect to an explicit authority", () => expect(EFFECT_TYPES.every(type => authorityFor(type))).toBe(true));
  it("fails closed for unknown required effects", async () => { await expect(dispatchFestivalEffect({rpc:async()=>({data:null,error:null})},effect({effect_type:"mystery"}))).rejects.toMatchObject({code:"FESTIVAL_EFFECT_CANONICAL_AUTHORITY_MISSING"}); });
  it("requires a canonical id for applied results", async () => { await expect(dispatchFestivalEffect({rpc:async()=>({data:{status:"applied",result:{}},error:null})},effect())).rejects.toMatchObject({code:"FESTIVAL_EFFECT_CANONICAL_ID_MISSING"}); });
  it("preserves canonical not-applicable exclusions", async () => expect(dispatchFestivalEffect({rpc:async()=>({data:{status:"not_applicable",reason:"npc_act"},error:null})},effect())).resolves.toEqual({status:"not_applicable",reason:"npc_act"}));
  it("passes the deterministic stable reference to canonical handlers", async () => { let args:Record<string,unknown>={}; const got=await dispatchFestivalEffect({rpc:async(_n,a)=>(args=a,{data:{status:"applied",canonicalId:"tx-1",result:{existing:true}},error:null})},effect()); expect(args.p_stable_reference).toBe("festival-performance:p:band_fans:b"); expect(got).toMatchObject({canonicalId:"tx-1"}); });
  it("rejects invalid subject identities before authority invocation", async () => { const error=dispatchFestivalEffect({rpc:async()=>{throw Error("unreachable")}},effect({subject_id:""})); await expect(error).rejects.toBeInstanceOf(FestivalEffectError); });
});
