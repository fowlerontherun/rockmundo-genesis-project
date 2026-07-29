import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251019072301_289cf6ac-da27-4fa3-82a8-7480853fa2ef.sql",
  ),
  "utf8",
);

const reconciliationMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243540_reconcile_completed_songwriting_projects.sql",
  ),
  "utf8",
);

describe("completed songwriting project conversion", () => {
  it("uses canonical song ownership and derived profile identity", () => {
    expect(historicalMigration).toContain("artist_id");
    expect(historicalMigration).toContain("profile_id");
    expect(historicalMigration).toContain("sp.user_id");
    expect(historicalMigration).toContain(
      "LEFT JOIN public.profiles p",
    );
    expect(historicalMigration).toContain("p.user_id = sp.user_id");
    expect(historicalMigration).not.toMatch(/INSERT INTO public\.songs \(\s*user_id/i);
  });

  it("owns every target field required by the insert", () => {
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS completed_at timestamptz",
    );
    expect(historicalMigration).toContain("songwriting_project_id");
    expect(historicalMigration).toContain("catalog_status");
  });

  it("does not create duplicate songs when replayed", () => {
    expect(historicalMigration).toContain("AND NOT EXISTS");
    expect(historicalMigration).toContain(
      "s.songwriting_project_id = sp.id",
    );
  });

  it("reconciles skipped projects without deleting songwriting data", () => {
    expect(reconciliationMigration).toContain("artist_id");
    expect(reconciliationMigration).toContain("profile_id");
    expect(reconciliationMigration).toContain("AND NOT EXISTS");
    expect(reconciliationMigration).not.toMatch(/DELETE\s+FROM/i);
    expect(reconciliationMigration).not.toMatch(/DROP\s+TABLE/i);
  });
});
