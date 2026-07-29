import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const prerequisiteMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251108074321_prepare_setlist_performance_items.sql",
  ),
  "utf8",
);
const catalogueMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251108074322_9771195b-45f9-4da8-af67-22dc72cc6b0a.sql",
  ),
  "utf8",
);
const finaliserMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251108074323_finalize_setlist_performance_items.sql",
  ),
  "utf8",
);
const reconciliationMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243620_reconcile_setlist_performance_items.sql",
  ),
  "utf8",
);

describe("setlist performance item migration ordering", () => {
  it("adds every compatibility field before the catalogue constraint uses it", () => {
    for (const column of [
      "item_type",
      "performance_item_id",
      "section",
      "is_encore",
    ]) {
      expect(prerequisiteMigration).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }

    expect(prerequisiteMigration).toContain("ALTER COLUMN song_id DROP NOT NULL");
    expect(catalogueMigration).toContain("item_type = 'performance_item'");
  });

  it("finalises a strict either-song-or-performance-item rule", () => {
    expect(finaliserMigration).toContain(
      "setlist_songs_performance_item_id_fkey",
    );
    expect(finaliserMigration).toContain(
      "item_type = 'song' AND song_id IS NOT NULL AND performance_item_id IS NULL",
    );
    expect(finaliserMigration).toContain(
      "item_type = 'performance_item' AND song_id IS NULL AND performance_item_id IS NOT NULL",
    );
  });

  it("supports the sectioned setlist fields used by the UI", () => {
    expect(prerequisiteMigration).toContain(
      "ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'main'",
    );
    expect(prerequisiteMigration).toContain(
      "ADD COLUMN IF NOT EXISTS is_encore boolean NOT NULL DEFAULT false",
    );
    expect(finaliserMigration).toContain(
      "idx_setlist_songs_section_position",
    );
  });

  it("reconciles deployed setlists without deleting setlist items", () => {
    expect(reconciliationMigration).toContain(
      "ADD COLUMN IF NOT EXISTS performance_item_id uuid",
    );
    expect(reconciliationMigration).toContain("NOT VALID");
    expect(reconciliationMigration).not.toMatch(/DELETE\s+FROM/i);
    expect(reconciliationMigration).not.toMatch(/DROP\s+TABLE/i);
  });
});
