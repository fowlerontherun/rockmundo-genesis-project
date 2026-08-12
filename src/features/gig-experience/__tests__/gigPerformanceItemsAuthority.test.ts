import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260812230000_authoritative_gig_performance_items.sql", "utf8");
const completion = readFileSync("supabase/functions/complete-gig/index.ts", "utf8");
const automatic = readFileSync("supabase/functions/auto-complete-gigs/index.ts", "utf8");
const browserWorker = readFileSync("src/hooks/useGlobalGigExecution.ts", "utf8");
const processor = readFileSync("supabase/functions/process-gig-song/index.ts", "utf8");
const replay = readFileSync("supabase/functions/generate-gig-viewer-replay/index.ts", "utf8");

describe("authoritative gig performance-item contract", () => {
  it("makes non-song outcome rows writable against the canonical catalogue", () => {
    expect(migration).toContain("ALTER COLUMN song_id DROP NOT NULL");
    expect(migration).toContain("REFERENCES public.performance_items_catalog(id)");
    expect(migration).toContain("ON DELETE RESTRICT");
    expect(migration).toContain("gig_song_performances_item_identity_check");
    expect(processor).toContain("performance_item_name: perfItem.name");
  });

  it.each([completion, automatic, browserWorker])("does not discard performance items through a song inner join", (source) => {
    expect(source).not.toContain("songs!inner");
    expect(source).toContain("performance_items_catalog");
    expect(source).toContain("performanceItemId:");
    expect(source).toContain("itemType:");
  });

  it("snapshots item identity and catalogue choreography facts into replay generation", () => {
    expect(replay).toContain("performance_item_id,item_type");
    expect(replay).toContain('.from("performance_items_catalog")');
    expect(replay).toContain("performanceItemCategory:");
    expect(replay).toContain("performanceItemRequiredSkill:");
  });
});
