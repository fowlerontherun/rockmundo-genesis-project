import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260812120000_authoritative_gig_commerce.sql", "utf8");
const completion = readFileSync("supabase/functions/complete-gig/index.ts", "utf8");
const replay = readFileSync("supabase/functions/generate-gig-viewer-replay/index.ts", "utf8");

describe("authoritative gig commerce contract", () => {
  it("serializes one transactional settlement and makes retry return immutable facts", () => {
    expect(migration).toContain("gig_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("WHERE id=p_gig_id FOR UPDATE");
    expect(migration).toContain("IF s.id IS NOT NULL THEN RETURN s.commerce_snapshot");
    expect(migration).toContain("gig_settlement_id");
  });

  it("locks and conditionally decrements variant and base stock without negatives", () => {
    expect(migration).toContain("UPDATE public.player_merchandise SET stock_quantity=stock_quantity-qty");
    expect(migration).toContain("UPDATE public.merch_variants SET stock_quantity=stock_quantity-qty");
    expect(migration.match(/stock_quantity>=qty/g)?.length).toBe(2);
    expect(migration).toContain("merch_items_sold=merch_count,merch_revenue=merch_gross");
  });

  it("has idempotent venue credit and licensed, staffed bar guards", () => {
    expect(migration).toContain("coalesce(v.alcohol_license,false)");
    expect(migration).toContain("bartender_count>0 OR coalesce(v.staff_count,0)>0");
    expect(migration).toContain("status='confirmed'");
    expect(migration).toContain("CREATE UNIQUE INDEX venue_transactions_one_gig_bar");
    expect(migration).toContain("UPDATE public.companies SET balance=coalesce(balance,0)+venue_take");
  });

  it("uses one server writer and snapshots settlement rather than recalculating playback", () => {
    expect(completion).toContain("rpc('settle_gig_commerce'");
    expect(completion).not.toContain("decrement_stock");
    expect(replay).toContain('.from("gig_commerce_settlements")');
    expect(replay).toContain("commerce: replay.commerce");
  });
});
