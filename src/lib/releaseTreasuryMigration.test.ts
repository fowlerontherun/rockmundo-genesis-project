import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20291218245800_release_finance_consistency.sql", import.meta.url),
  "utf8",
);

describe("release treasury transaction contract", () => {
  it("converts minor units once and journals the initial charge", () => {
    expect(migration).toContain("v_amount_major := p_amount_minor / 100.0");
    expect(migration).toContain("INSERT INTO band_earnings");
  });

  it("makes add-format and reorder payment plus inventory mutations atomic", () => {
    expect(migration).toContain("FUNCTION public.purchase_release_format");
    expect(migration).toContain("FUNCTION public.reorder_release_stock");
    expect(migration.match(/Insufficient band balance/g)?.length).toBeGreaterThan(0);
    expect(migration).toContain("UPDATE release_formats SET quantity=coalesce(quantity,0)+p_quantity");
    expect(migration).toContain("UPDATE releases SET total_cost=coalesce(total_cost,0)+p_manufacturing_cost_minor");
  });
});
