import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(resolve(process.cwd(),
  "supabase/production-repairs/20261015_incremental_band_earnings_trigger.sql"), "utf8");
const trigger = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.update_band_balance_from_earnings()"),
  sql.indexOf("REVOKE ALL ON FUNCTION public.update_band_balance_from_earnings()"));
const botb = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public.resolve_botb_event("));

describe("incremental band earnings projection repair (#4119)", () => {
  it("replaces the full-sum earnings recalculation with incremental deltas", () => {
    expect(trigger).toContain("CREATE OR REPLACE FUNCTION public.update_band_balance_from_earnings()");
    expect(trigger).toContain("IF TG_OP = 'INSERT' THEN");
    expect(trigger).toContain("v_new_delta := NEW.amount::bigint");
    expect(trigger).toContain("v_old_delta := -OLD.amount::bigint");
    expect(trigger).toContain("SUM(c.delta)::bigint AS delta");
    expect(trigger).toContain("v_next := v_band_balance + v_change.delta");
    expect(trigger).toContain("SET band_balance = v_next::integer");
    expect(trigger).not.toMatch(/SUM\s*\(\s*amount\s*\)\s*FROM\s*(?:public\.)?band_earnings/i);
  });

  it("applies UPDATEs only to changed amounts or transferred band ownership", () => {
    expect(trigger).toContain("NEW.band_id = OLD.band_id AND NEW.amount = OLD.amount");
    expect(trigger).toContain("RETURN NEW; -- metadata/description changes");
    expect(trigger).toContain("VALUES (v_old_band_id,v_old_delta)");
    expect(trigger).toContain("(v_new_band_id,v_new_delta)");
    expect(trigger).toContain("GROUP BY c.band_id");
    expect(trigger).toContain("ORDER BY c.band_id");
    expect(trigger).toContain("IF TG_OP = 'DELETE' THEN RETURN OLD");
  });

  it("fails closed rather than overwriting legitimate booked treasury expenses", () => {
    expect(trigger).toContain("FROM public.bands b WHERE b.id = v_change.band_id FOR UPDATE");
    expect(trigger).toContain("FROM public.band_treasuries t");
    expect(trigger).toContain("t.is_primary IS TRUE");
    expect(trigger).toContain("v_treasury_balance_minor / 100 <> v_band_balance");
    expect(trigger).toContain("v_next * 100 < v_reserved_minor");
    expect(trigger).toContain("v_next < 0 OR v_next > 2147483647");
    expect(trigger).toContain("post-write treasury verification failed");
  });

  it("never exposes the internal trigger through direct public RPC grants", () => {
    expect(sql).toContain("SECURITY DEFINER SET search_path = ''");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.update_band_balance_from_earnings()");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated, service_role");
    expect(sql).toContain("Unexpected production earnings trigger: manual review required");
    expect(sql).toContain("Existing gameplay treasury drift: abort earnings trigger repair");
  });

  it("removes Battle of the Bands' second cash award while preserving fame and prize journal", () => {
    expect(botb).toContain("INSERT INTO public.band_earnings");
    expect(botb).toContain("5000, 'battle_of_the_bands'");
    expect(botb).toContain("SET fame = COALESCE(fame, 0) + v_fame");
    expect(botb).not.toMatch(/SET\s+band_balance\s*=/);
    expect(botb).toContain("total_fans = COALESCE(total_fans, 0) + v_fans");
  });

  it("preserves previously booked recording and rehearsal expenses", () => {
    // A band has earned 2,242,211 but paid 28,000 for gameplay bookings.
    const earningSubtotal = 2_242_211;
    const bookings = 27_400 + 400 + 200;
    const actualTreasury = earningSubtotal - bookings;
    const freshMerchRevenue = 3_646;
    expect(actualTreasury).toBe(2_214_211);
    expect(actualTreasury + freshMerchRevenue).toBe(2_217_857);
    // The deprecated trigger instead replaced actual cash with all earnings:
    expect(earningSubtotal + freshMerchRevenue).toBe(2_245_857);
    expect((earningSubtotal + freshMerchRevenue) - (actualTreasury + freshMerchRevenue))
      .toBe(bookings);
  });

  it("applies one net delta for corrected earnings and moves", () => {
    const changes = (oldBand: string | null, oldAmount: number,
      newBand: string | null, newAmount: number) => {
      const deltas = new Map<string, number>();
      if (oldBand) deltas.set(oldBand, (deltas.get(oldBand) ?? 0) - oldAmount);
      if (newBand) deltas.set(newBand, (deltas.get(newBand) ?? 0) + newAmount);
      return deltas;
    };
    expect(changes(null, 0, "a", 200).get("a")).toBe(200);
    expect(changes("a", 200, "a", 140).get("a")).toBe(-60);
    expect(changes("a", 200, null, 0).get("a")).toBe(-200);
    expect(changes("a", 200, "b", 300)).toEqual(new Map([["a",-200],["b",300]]));
  });
});
