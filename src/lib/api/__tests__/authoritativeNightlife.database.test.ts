import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const migration = read("supabase/migrations/20260823103000_authoritative_nightlife_city_policy.sql");
const edge = read("supabase/functions/nightclub-session/index.ts");
const config = read("supabase/config.toml");
const hook = read("src/hooks/useNightlifeEvents.ts");
const drinkMenu = read("src/components/nightclub/NightClubDrinkMenu.tsx");
const stanceSelector = read("src/components/nightclub/NightlifeStanceSelector.tsx");

describe("authoritative nightlife city policy", () => {
  it("keeps raw policy/action RPCs service-role only", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.get_authoritative_nightclub_policy");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.perform_authoritative_nightclub_action");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.perform_authoritative_nightclub_action");
    expect(migration).toContain("TO service_role");
  });

  it("snapshots and enforces active City Hall alcohol/drug policy", () => {
    expect(migration).toContain("alcohol_legal_age");
    expect(migration).toContain("drug_policy");
    expect(migration).toContain("nightlife_under_legal_drinking_age");
    expect(migration).toContain("effective_from<=now()");
    expect(migration).toContain("v_drug_exposure_chance:=CASE v_drug_policy");
    expect(migration).toContain("v_enforcement_chance:=CASE v_drug_policy");
  });

  it("owns randomness, finance, profile effects and addiction mutation in the database", () => {
    expect(migration).toContain("random()");
    expect(migration).toContain("finance_debit_owner");
    expect(migration).toContain("UPDATE public.profiles");
    expect(migration).toContain("UPDATE public.player_addictions");
    expect(migration).toContain("INSERT INTO public.player_addictions");
    expect(migration).toContain("UNIQUE(profile_id,idempotency_key)");
    expect(hook).not.toContain("Math.random()");
    expect(hook).not.toContain('.from("profiles")\n        .update');
    expect(hook).not.toContain('.from("player_addictions")');
  });

  it("does not accept browser-supplied profile, city, price or outcome authority", () => {
    expect(edge).toContain("authClient.auth.getUser()");
    expect(edge).toContain('typeof body.clubId === "string"');
    expect(edge).toContain('typeof body.stance === "string"');
    expect(edge).toContain('typeof body.drinkId === "string"');
    expect(edge).not.toContain("body.profileId");
    expect(edge).not.toContain("body.cityId");
    expect(edge).not.toContain("body.price");
    expect(edge).not.toContain("body.outcome");
  });

  it("requires JWT and routes stance and drink gameplay through the Edge boundary", () => {
    expect(config).toContain("[functions.nightclub-session]\nverify_jwt = true");
    expect(hook).toContain('supabase.functions.invoke("nightclub-session"');
    expect(drinkMenu).toContain("buyAuthoritativeNightclubDrink");
    expect(drinkMenu).toContain("serviceBlocked");
  });

  it("shows players the mayor policy affecting nightlife", () => {
    expect(drinkMenu).toContain("City drinking age");
    expect(drinkMenu).toContain("City Hall law blocks alcohol service");
    expect(stanceSelector).toContain("city drug policy");
    expect(stanceSelector).toContain("City Hall alcohol and drug policy");
  });
});
