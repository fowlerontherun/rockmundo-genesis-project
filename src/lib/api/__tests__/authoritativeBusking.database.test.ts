import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260822153000_authoritative_busking_city_law.sql",
  "utf8",
);
const edgeFunction = readFileSync("supabase/functions/busking-session/index.ts", "utf8");
const page = readFileSync("src/pages/Busking.tsx", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");

describe("authoritative busking database contract", () => {
  it("keeps city spots and completed outcomes server owned", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.city_busking_spots");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.authoritative_busking_sessions");
    expect(migration).toContain("UNIQUE (profile_id,idempotency_key)");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.perform_authoritative_busking");
    expect(migration).toContain("roll:=.85+random()*.45");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.perform_authoritative_busking");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.perform_authoritative_busking(uuid,text,integer,uuid) TO service_role");
  });

  it("charges the mayor law through canonical finance and credits City Hall", () => {
    expect(migration).toContain("busking_license_fee");
    expect(migration).toContain("public.finance_transfer(");
    expect(migration).toContain("'city',p.current_city_id");
    expect(migration).toContain("'licence_fee'");
    expect(migration).toContain("public.credit_city_treasury(");
    expect(migration).toContain("'busking_licence_fee'");
    expect(migration).toContain("public.finance_credit_owner(");
    expect(migration).toContain("'busking-tips:'||p_idempotency_key::text");
  });

  it("uses the real user id for scheduling and city development for demand", () => {
    expect(migration).toContain("public.check_scheduling_conflict(p_user_id,started,finishes,NULL)");
    expect(migration).toContain("public.city_gameplay_modifiers(p.current_city_id)");
    expect(migration).toContain("audience_demand_multiplier");
    expect(migration).toContain("demand:=greatest(.85,least(1.15");
    expect(migration).toContain("IF FOUND AND coalesce(activity.status");
  });
});

describe("authoritative busking edge boundary", () => {
  it("authenticates the caller and never accepts a profile id from the browser", () => {
    expect(edgeFunction).toContain("service.auth.getUser(token)");
    expect(edgeFunction).toContain("p_user_id: userId");
    expect(edgeFunction).not.toContain("profileId: body");
    expect(config).toContain("[functions.busking-session]\nverify_jwt = true");
  });

  it("awards XP through canonical progression with a session-scoped duplicate key", () => {
    expect(edgeFunction).toContain('service.rpc("progression_award_action_xp"');
    expect(edgeFunction).toContain("const uniqueEventId = `busking:${result.sessionId}`");
    expect(edgeFunction).toContain("unique_event_id: uniqueEventId");
    expect(edgeFunction).toContain("duplicate progression event");
  });
});

describe("busking player UI contract", () => {
  it("is a thin client over the authoritative edge function", () => {
    expect(page).toContain('supabase.functions.invoke("busking-session"');
    expect(page).toContain('action: "options"');
    expect(page).toContain('action: "start"');
    expect(page).toContain("crypto.randomUUID()");
    expect(page).not.toContain("Math.random()");
    expect(page).not.toContain("check_scheduling_conflict");
    expect(page).not.toContain("awardActionXp");
    expect(page).not.toContain("updateProfile({ cash");
    expect(page).not.toContain("startActivity({");
  });

  it("surfaces mayor licence cost and authoritative net outcome to the player", () => {
    expect(page).toContain("Licence $");
    expect(page).toContain("licenceFee");
    expect(page).toContain("netCashChange");
    expect(page).toContain("server validates your schedule and cash before charging anything");
  });
});
