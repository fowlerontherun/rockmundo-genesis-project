import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(),
  "supabase/migrations/20261025171700_merch_production_treasury_single_charge.sql"), "utf8");
const initial = migration.slice(
  migration.indexOf("CREATE OR REPLACE FUNCTION public.queue_initial_merch_production()"),
  migration.indexOf("-- AFTER triggers used a second")
);
const restock = migration.slice(
  migration.indexOf("CREATE OR REPLACE FUNCTION public.queue_merch_restock_order()"),
  migration.indexOf("-- Runs after trg_prepare_merch_production_insert")
);

describe("merchandise treasury single-charge repair", () => {
  it("checks actual treasury available funds, including reservations", () => {
    expect(migration).toContain("FROM public.band_treasuries");
    expect(migration).toContain("v_treasury.balance_minor - v_treasury.reserved_balance_minor");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("Band treasury balance requires reconciliation");
    expect(migration).toContain("Insufficient band funds");
  });

  it("charges INITIAL production after preparation moved stock to pending", () => {
    expect(initial).toContain("coalesce(new.stock_quantity,0)");
    expect(initial).toContain("coalesce(new.pending_quantity,0)");
    expect(initial).toContain("new.production_total_cost");
    expect(initial).toContain("public.merch_assert_band_funds(new.band_id,charge_amount)");
    expect(initial).toContain("INSERT INTO public.band_earnings");
    expect(initial).not.toContain("new.is_rush_order := false");
  });

  it("charges a restock through band earnings just once", () => {
    expect(restock).toContain("PERFORM public.merch_assert_band_funds(new.band_id, charge_amount)");
    expect(restock).toContain("insert into public.band_earnings");
    expect(restock).toContain("new.pending_quantity := added_qty");
    expect(restock).toContain("new.stock_quantity := old.stock_quantity");
  });

  it("removes legacy financial-account AFTER triggers without touching orders", () => {
    expect(migration).toContain("DROP TRIGGER IF EXISTS trg_charge_merch_production_insert");
    expect(migration).toContain("DROP TRIGGER IF EXISTS trg_charge_merch_production_restock");
    expect(migration).not.toContain("finance_debit_owner(");
    expect(migration).not.toMatch(/UPDATE\s+public\.band_treasuries\s+SET/);
    expect(migration).not.toMatch(/UPDATE\s+public\.financial_accounts\s+SET/);
  });

  it("keeps internal validation inaccessible to browser RPC callers", () => {
    expect(migration).toContain("SECURITY DEFINER SET search_path = ''");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.merch_assert_band_funds(uuid,integer) FROM PUBLIC, anon, authenticated");
  });
});
