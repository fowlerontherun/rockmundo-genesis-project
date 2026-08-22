import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lawMigration = readFileSync(
  "supabase/migrations/20260822161000_enforce_gig_city_permits_and_capacity.sql",
  "utf8",
);
const financeMigration = readFileSync(
  "supabase/migrations/20260822161100_canonical_gig_city_law_finance.sql",
  "utf8",
);

describe("authoritative gig City Hall law contract", () => {
  it("snapshots permit and capacity law on each newly booked gig", () => {
    expect(lawMigration).toContain("ADD COLUMN IF NOT EXISTS city_venue_permit_fee");
    expect(lawMigration).toContain("ADD COLUMN IF NOT EXISTS city_capacity_limit");
    expect(lawMigration).toContain("ADD COLUMN IF NOT EXISTS effective_capacity");
    expect(lawMigration).toContain("ADD COLUMN IF NOT EXISTS booking_city_law_id");
    expect(financeMigration).toContain("cl.venue_permit_cost");
    expect(financeMigration).toContain("cl.max_concert_capacity");
    expect(financeMigration).toContain("cl.effective_from <= v_start");
    expect(financeMigration).toContain("cl.effective_until IS NULL OR cl.effective_until > v_start");
    expect(financeMigration).toContain("v_permit_fee,v_city_capacity_limit");
    expect(financeMigration).toContain("v_capacity, v_city_law_id");
  });

  it("treats the lower of physical and mayor capacity as the sellable house", () => {
    expect(financeMigration).toContain("LEAST(v_physical_capacity, v_city_capacity_limit)");
    expect(financeMigration).toContain("v_estimated_attendance := LEAST(");
    expect(lawMigration).toContain("NULLIF(NEW.effective_capacity,0)");
    expect(lawMigration).toContain("COALESCE(NULLIF(g.effective_capacity,0), v.capacity, 1)");
    expect(lawMigration).toContain("SELECT NULLIF(COALESCE(NULLIF(g.effective_capacity,0), v.capacity), 0)");
    expect(lawMigration).toContain("NEW.attendance_percentage := LEAST(");
  });

  it("uses the current canonical band treasury rather than legacy band_treasuries", () => {
    expect(financeMigration).toContain("public.financial_accounts");
    expect(financeMigration).toContain("metadata->>'account_role' = 'band_treasury'");
    expect(financeMigration).toContain("public.get_or_create_band_treasury_account");
    expect(financeMigration).toContain("public.post_financial_journal(");
    expect(financeMigration).toContain("'trusted_finance_workflow', true");
    expect(financeMigration).not.toContain("public.band_treasuries");
    expect(financeMigration).not.toContain("public.band_treasury_transactions");
    expect(financeMigration).not.toContain("UPDATE public.bands SET band_balance = band_balance -");
  });

  it("posts booking and permit components as separate audited canonical transactions", () => {
    expect(financeMigration).toContain("'system_fee'::public.financial_transaction_category");
    expect(financeMigration).toContain("'gig-booking-fee:' || p_request_id::text");
    expect(financeMigration).toContain("'city_venue_permit_fee'::public.financial_transaction_category");
    expect(financeMigration).toContain("'gig-city-permit:' || p_request_id::text");
    expect(financeMigration).toContain("'account_id', v_city_treasury.id");
    expect(financeMigration).toContain("public.credit_city_treasury(");
    expect(financeMigration).toContain("v_total_charge := v_booking_fee + v_permit_fee");
    expect(financeMigration).toContain("v_band_treasury.available_balance_minor < v_total_charge::bigint * 100");
  });

  it("keeps legacy band balance as a projection only", () => {
    expect(financeMigration).toContain("Compatibility projection only. financial_accounts remains authoritative.");
    expect(financeMigration).toContain("SELECT current_balance_minor INTO v_band_balance_after");
    expect(financeMigration).toContain("SET band_balance = floor(COALESCE(v_band_balance_after, 0)::numeric / 100)::integer");
  });

  it("keeps idempotency and the booking transaction boundary server-owned", () => {
    expect(financeMigration).toContain("WHERE booking_request_id = p_request_id");
    expect(financeMigration).toContain("'already_booked', true");
    expect(financeMigration).toContain("'venue_permit_fee', COALESCE(v_gig.city_venue_permit_fee, 0)");
    expect(financeMigration).toContain("'total_booking_charge'");
    expect(financeMigration).toContain("'effective_capacity'");
    expect(financeMigration).toContain("SECURITY DEFINER");
    expect(financeMigration).toContain("TO authenticated, service_role");
  });
});
