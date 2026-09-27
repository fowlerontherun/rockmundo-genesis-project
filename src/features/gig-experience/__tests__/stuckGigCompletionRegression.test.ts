import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260927164500_repair_gig_completion_schema_drift.sql",
  "utf8",
);
const completion = readFileSync("supabase/functions/complete-gig/index.ts", "utf8");
const automatic = readFileSync("supabase/functions/auto-complete-gigs/index.ts", "utf8");

describe("stuck gig completion regression", () => {
  it("allows non-song stage actions and points the FK at the canonical catalogue", () => {
    expect(migration).toContain("ALTER COLUMN song_id DROP NOT NULL");
    expect(migration).toContain("REFERENCES public.performance_items_catalog(id)");
    expect(migration).toContain("gig_song_performances_item_identity_check");
    expect(migration).toContain("performance_item_id IS NOT NULL");
  });

  it("restores idempotent commerce references for both merch orders and venue transactions", () => {
    expect(migration).toContain("ALTER TABLE public.merch_orders");
    expect(migration).toContain("ALTER TABLE public.venue_financial_transactions");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS merch_orders_one_settled_line");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS venue_transactions_one_gig_bar");
  });

  it("reuses an existing post-processing record instead of inserting on each retry", () => {
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("v_processing_id");
    expect(migration).toContain("IF v_processing_id IS NULL THEN");
    expect(migration).toContain("WHERE id = v_processing_id");
  });

  it("will not settle an incomplete setlist even if some songs processed successfully", () => {
    expect(completion).toContain("Incomplete gig setlist: missing positions");
    expect(completion).toContain("if (setlistError) throw setlistError");
    expect(completion).toContain("if (finalPerformancesError) throw finalPerformancesError");
    expect(completion.indexOf("Incomplete gig setlist: missing positions")).toBeLessThan(
      completion.indexOf("rpc('settle_gig_commerce'"),
    );
    expect(completion).toContain("current_song_position: expectedSetlistSize");
  });

  it("does not claim a concurrent unfinished worker has completed a gig", () => {
    expect(automatic).toContain("completionResult?.processing");
    expect(automatic).toContain("retryResult?.processing");
    expect(automatic).toContain("Gig completion returned without a final result");
  });
});
