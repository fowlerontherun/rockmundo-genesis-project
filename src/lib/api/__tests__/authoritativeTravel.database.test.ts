import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const categoryMigration = readFileSync(
  "supabase/migrations/20260822154459_finance_travel_tax_category.sql",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260822154500_authoritative_travel_city_tax.sql",
  "utf8",
);
const edgeFunction = readFileSync("supabase/functions/travel-booking/index.ts", "utf8");
const travelSystem = readFileSync("src/utils/travelSystem.ts", "utf8");
const page = readFileSync("src/pages/Travel.tsx", "utf8");
const financeService = readFileSync("src/services/finance/financeService.ts", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const characterScopedMigration = readFileSync(
  "supabase/migrations/20260830175331_character_scoped_band_travel_duration.sql",
  "utf8",
);

describe("authoritative travel database contract", () => {
  it("keeps the booking outcome idempotent and service-role owned", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.authoritative_travel_bookings");
    expect(migration).toContain("UNIQUE(profile_id, idempotency_key)");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.book_authoritative_travel");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("RETURN v_existing || jsonb_build_object('idempotent', true)");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.book_authoritative_travel");
    expect(migration).toContain("TO service_role");
  });

  it("recalculates City Hall transport and departure-city tax before charging", () => {
    expect(migration).toContain("FROM public.city_development WHERE city_id = v_from_city.id");
    expect(migration).toContain("FROM public.city_development WHERE city_id = v_to_city.id");
    expect(migration).toContain("v_average_transport := greatest(0, least(100");
    expect(migration).toContain("v_cost_multiplier := 1.10 - v_average_transport * 0.002");
    expect(migration).toContain("v_duration_multiplier := 1.08 - v_average_transport * 0.0016");
    expect(migration).toContain("SELECT round(coalesce(travel_tax, 0))::integer INTO v_travel_tax");
    expect(migration).toContain("WHERE city_id = v_from_city.id");
  });

  it("routes fare and tax through canonical finance and City Hall treasury", () => {
    expect(categoryMigration).toContain("ADD VALUE IF NOT EXISTS 'travel_tax'");
    expect(financeService).toContain('| "travel_cost" | "travel_tax" |');
    expect(migration).toContain("public.finance_debit_owner(");
    expect(migration).toContain("'travel_cost'");
    expect(migration).toContain("public.finance_transfer(");
    expect(migration).toContain("'city', v_from_city.id");
    expect(migration).toContain("'travel_tax'");
    expect(migration).toContain("public.credit_city_treasury(");
  });

  it("owns schedule, history and XP in the same transaction", () => {
    expect(migration).toContain("FROM public.player_scheduled_activities a");
    expect(migration).toContain("RAISE EXCEPTION 'travel_schedule_conflict'");
    expect(migration).toContain("INSERT INTO public.player_travel_history(");
    expect(migration).toContain("INSERT INTO public.player_scheduled_activities(");
    expect(migration).toContain("public.progression_award_action_xp(");
    expect(migration).toContain("'unique_event_id', 'travel:' || v_booking_id::text");
  });
});

describe("authoritative travel edge boundary", () => {
  it("validates the exact character and route physics rather than trusting browser price fields", () => {
    expect(edgeFunction).toContain("service.auth.getUser(token)");
    expect(edgeFunction).toContain('.select("id,current_city_id")');
    expect(edgeFunction).toContain('.eq("id", profileId)');
    expect(edgeFunction).toContain('.eq("user_id", authData.user.id)');
    expect(edgeFunction).toContain("const distance = distanceKm(from, to)");
    expect(edgeFunction).toContain("const raw = quoteMode(mode, distance, from, to)");
    expect(edgeFunction).toContain('service.rpc("book_authoritative_travel_for_profile"');
    expect(edgeFunction).toContain("body.profileId");
    expect(edgeFunction).not.toContain("body.fromCityId");
    expect(edgeFunction).not.toContain("body.cost");
    expect(edgeFunction).not.toContain("body.durationHours");
    expect(config).toContain("[functions.travel-booking]\nverify_jwt = true");
  });

  it("keeps the new exact-profile RPC service-only", () => {
    expect(characterScopedMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.book_authoritative_travel_for_profile",
    );
    expect(characterScopedMigration).toContain("WHERE id = p_profile_id");
    expect(characterScopedMigration).toContain("AND user_id = p_user_id");
    expect(characterScopedMigration).toContain(
      "REVOKE ALL ON FUNCTION public.book_authoritative_travel_for_profile",
    );
    expect(characterScopedMigration).toContain("TO service_role");
  });
});

describe("travel player clients", () => {
  it("uses one shared thin booking wrapper for desktop and mobile", () => {
    expect(travelSystem).toContain('supabase.functions.invoke("travel-booking"');
    expect(travelSystem).toContain("pendingTravelIdempotency");
    expect(travelSystem).toContain("crypto.randomUUID()");
    expect(travelSystem).toContain("destinationCityId: bookingData.toCityId");
    expect(travelSystem).not.toContain('.from("player_travel_history")');
    expect(travelSystem).not.toContain('.from("experience_ledger")');
    expect(travelSystem).not.toContain("cash: (profile.cash || 0) - cost");
  });

  it("shows the mayor levy and confirms the server-calculated total", () => {
    expect(page).toContain("getTravelTaxForDeparture");
    expect(page).toContain("travel tax");
    expect(page).toContain("Estimated total");
    expect(page).toContain("server recalculates the route, Transport rating and mayor-set tax before charging");
    expect(page).toContain("result.travelTax.toLocaleString()");
    expect(page).toContain("result.totalCost.toLocaleString()");
  });
});
