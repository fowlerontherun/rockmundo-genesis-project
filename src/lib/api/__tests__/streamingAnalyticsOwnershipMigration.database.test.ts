import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251023080953_283f5d89-1c39-4e46-91c9-05cfef82d42e.sql",
  ),
  "utf8",
);

const reconciliationMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243550_reconcile_streaming_analytics_ownership.sql",
  ),
  "utf8",
);

describe("streaming analytics ownership migration", () => {
  it("uses canonical song ownership for personal analytics", () => {
    expect(historicalMigration).toContain("s.artist_id = auth.uid()");
    expect(historicalMigration).not.toContain("s.user_id");
    expect(historicalMigration).not.toContain("songs.user_id");
  });

  it("retains access for active band members", () => {
    expect(historicalMigration).toContain(
      "bm.band_id = s.band_id",
    );
    expect(historicalMigration).toContain(
      "bm.user_id = auth.uid()",
    );
  });

  it("limits analytics inserts to trusted server processes", () => {
    expect(historicalMigration).toContain(
      'DROP POLICY IF EXISTS "System can insert streaming analytics"',
    );
    expect(historicalMigration).toContain("FOR INSERT");
    expect(historicalMigration).toContain("TO service_role");
    expect(historicalMigration).not.toMatch(
      /FOR INSERT\s+WITH CHECK \(true\)/,
    );
  });

  it("reconciles deployed policies without modifying analytics rows", () => {
    expect(reconciliationMigration).toContain("s.artist_id = auth.uid()");
    expect(reconciliationMigration).toContain("TO service_role");
    expect(reconciliationMigration).not.toMatch(/DELETE\s+FROM/i);
    expect(reconciliationMigration).not.toMatch(/DROP\s+TABLE/i);
  });
});
