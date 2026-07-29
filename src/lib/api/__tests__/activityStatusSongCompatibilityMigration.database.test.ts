import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251006052802_4b82ad0e-e2a8-49b5-a82f-9cca1bc0d525.sql",
  ),
  "utf8",
);

const reconciliationMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243510_reconcile_activity_status_song_link.sql",
  ),
  "utf8",
);

describe("activity status song compatibility migration", () => {
  it("adds song_id before creating its index", () => {
    const addColumnPosition = historicalMigration.indexOf(
      "ADD COLUMN IF NOT EXISTS song_id uuid REFERENCES public.songs(id)",
    );
    const indexPosition = historicalMigration.indexOf(
      "CREATE INDEX IF NOT EXISTS profile_activity_statuses_song_id_idx",
    );

    expect(addColumnPosition).toBeGreaterThan(-1);
    expect(indexPosition).toBeGreaterThan(addColumnPosition);
  });

  it("restores timer fields when a smaller compatibility table already exists", () => {
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS duration_minutes integer",
    );
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS ends_at timestamptz",
    );
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS metadata jsonb",
    );
    expect(historicalMigration).toContain(
      "profile_activity_statuses_duration_check",
    );
  });

  it("reconciles deployed databases without rewriting activity rows", () => {
    expect(reconciliationMigration).toContain(
      "ADD COLUMN IF NOT EXISTS song_id uuid REFERENCES public.songs(id)",
    );
    expect(reconciliationMigration).toContain(
      "CREATE INDEX IF NOT EXISTS profile_activity_statuses_song_id_idx",
    );
    expect(reconciliationMigration).toContain("NOT VALID");
    expect(reconciliationMigration).not.toMatch(/DELETE\s+FROM/i);
    expect(reconciliationMigration).not.toMatch(/DROP\s+TABLE/i);
  });
});
