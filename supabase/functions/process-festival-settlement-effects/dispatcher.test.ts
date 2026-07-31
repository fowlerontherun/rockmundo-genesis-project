import { describe, expect, it } from "vitest";
import { EFFECT_TYPES, INCOMPLETE_EFFECT_TYPES, SUPPORTED_EFFECT_TYPES, authorityFor, dispatchFestivalEffect, FestivalEffectError, type Effect } from "./dispatcher";

const effect = (overrides: Partial<Effect> = {}): Effect => ({ id:"e",settlement_id:"s",outcome_id:"o",effect_type:"band_fans",subject_type:"band",subject_id:"b",stable_reference:"festival-performance:p:band_fans:b",requested_payload:{delta:2},claim_token:"c",...overrides });
describe("Festival effect dispatcher", () => {
  it("maps all seven supported effects to their exact production authorities", () => expect(SUPPORTED_EFFECT_TYPES.map(type => authorityFor(type))).toEqual([
    "apply_festival_performance_result_effect", "apply_festival_band_fans_effect", "apply_festival_band_fame_effect",
    "apply_festival_member_xp_effect", "apply_festival_band_chemistry_effect",
    "apply_festival_song_familiarity_effect", "apply_festival_song_popularity_effect",
  ]));
  it.each(INCOMPLETE_EFFECT_TYPES)("fails closed for incomplete effect %s", async effect_type => {
    let invoked = false;
    await expect(dispatchFestivalEffect({rpc:async()=>{ invoked = true; return {data:null,error:null}; }},effect({effect_type}))).rejects.toMatchObject({code:"FESTIVAL_EFFECT_IMPLEMENTATION_PENDING",recoverable:false});
    expect(invoked).toBe(false);
  });
  it("keeps the seven supported and nine incomplete effects exhaustive", () => {
    expect(SUPPORTED_EFFECT_TYPES).toHaveLength(7); expect(INCOMPLETE_EFFECT_TYPES).toHaveLength(9);
    expect([...SUPPORTED_EFFECT_TYPES, ...INCOMPLETE_EFFECT_TYPES]).toEqual(EFFECT_TYPES);
  });
  it("fails closed for unknown required effects", async () => { await expect(dispatchFestivalEffect({rpc:async()=>({data:null,error:null})},effect({effect_type:"mystery"}))).rejects.toMatchObject({code:"FESTIVAL_EFFECT_CANONICAL_AUTHORITY_MISSING"}); });
  it("requires a canonical id for applied results", async () => { await expect(dispatchFestivalEffect({rpc:async()=>({data:{status:"applied",result:{}},error:null})},effect())).rejects.toMatchObject({code:"FESTIVAL_EFFECT_CANONICAL_ID_MISSING"}); });
  it("preserves canonical not-applicable exclusions", async () => expect(dispatchFestivalEffect({rpc:async()=>({data:{status:"not_applicable",reason:"npc_act"},error:null})},effect())).resolves.toEqual({status:"not_applicable",reason:"npc_act"}));
  it("passes the deterministic stable reference to canonical handlers", async () => { let args:Record<string,unknown>={}; const result={canonical_record_type:"fan_event",canonical_record_id:"tx-1",canonical_authority:"apply_festival_band_fans_effect",canonical_table_or_service:"band_fan_events",stable_reference:"festival-performance:p:band_fans:b",subject_type:"band",subject_id:"b",evidence_digest:"digest",rules_version:"v1",before_state:{fans:1},requested_change:{delta:2},validated_change:{delta:2},after_state:{fans:3},applied_at:"2026-07-31T00:00:00Z"}; const got=await dispatchFestivalEffect({rpc:async(_n,a)=>(args=a,{data:{status:"applied",canonicalId:"tx-1",result},error:null})},effect()); expect(args.p_stable_reference).toBe("festival-performance:p:band_fans:b"); expect(got).toMatchObject({canonicalId:"tx-1"}); });
  it("rejects a receipt UUID that is not backed by typed canonical evidence", async () => { await expect(dispatchFestivalEffect({rpc:async()=>({data:{status:"applied",canonicalId:"receipt-only",result:{appliedDelta:2}},error:null})},effect())).rejects.toMatchObject({code:"FESTIVAL_EFFECT_CANONICAL_RESULT_INVALID"}); });
  it("rejects evidence that identifies the receipt table as canonical", async () => { const result={canonical_record_type:"fan_event",canonical_record_id:"receipt-only",canonical_authority:"apply_festival_band_fans_effect",canonical_table_or_service:"festival_effect_authority_results",stable_reference:effect().stable_reference,subject_type:"band",subject_id:"b",evidence_digest:"digest",rules_version:"v1",before_state:{fans:1},requested_change:{delta:2},validated_change:{delta:2},after_state:{fans:3},applied_at:"2026-07-31T00:00:00Z"}; await expect(dispatchFestivalEffect({rpc:async()=>({data:{status:"applied",canonicalId:"receipt-only",result},error:null})},effect())).rejects.toMatchObject({code:"FESTIVAL_EFFECT_CANONICAL_RESULT_INVALID"}); });
  it("rejects invalid subject identities before authority invocation", async () => { const error=dispatchFestivalEffect({rpc:async()=>{throw Error("unreachable")}},effect({subject_id:""})); await expect(error).rejects.toBeInstanceOf(FestivalEffectError); });
});
