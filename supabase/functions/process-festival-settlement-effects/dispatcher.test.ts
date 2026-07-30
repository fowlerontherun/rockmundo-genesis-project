import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dispatchFestivalEffect, FESTIVAL_EFFECT_TYPES } from "./dispatcher.ts";

const effect = (type: string) => ({ id: crypto.randomUUID(), effect_type: type, subject_type: "band", subject_id: crypto.randomUUID(), stable_reference: `festival:test:${type}`, requested_payload: {}, required: true, claim_token: crypto.randomUUID() });
Deno.test("every supported effect dispatches and requires a canonical id", async () => {
  for (const type of FESTIVAL_EFFECT_TYPES) {
    const result = await dispatchFestivalEffect(effect(type), async () => ({ data: { status: "applied", canonicalId: `canonical:${type}`, result: {} }, error: null }));
    assertEquals(result.status, "applied");
  }
});
Deno.test("unknown required effects fail closed", async () => {
  await assertRejects(() => dispatchFestivalEffect(effect("mystery"), async () => ({ data: null, error: null })), Error, "No authority");
});
Deno.test("applied responses without canonical IDs are rejected", async () => {
  await assertRejects(() => dispatchFestivalEffect(effect("band_fans"), async () => ({ data: { status: "applied" }, error: null })), Error, "canonical ID");
});
