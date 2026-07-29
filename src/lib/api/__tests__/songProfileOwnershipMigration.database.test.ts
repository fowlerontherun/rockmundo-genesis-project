import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251016124606_f8655f2e-9c9a-48f2-8593-827a076acc13.sql",
  ),
  "utf8",
);

const reconciliationMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243530_reconcile_song_profile_ownership.sql",
  ),
  "utf8",
);

describe("song profile ownership migration", () => {
  it("maps canonical song ownership through artist_id", () => {
    expect(historicalMigration).toContain(
      "WHERE s.artist_id = p.user_id",
    );
    expect(historicalMigration).not.toContain("s.user_id");
    expect(historicalMigration).not.toContain("songs.user_id");
  });

  it("adds the profile reference without replacing artist ownership", () => {
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id)",
    );
    expect(historicalMigration).toContain(
      "CREATE INDEX IF NOT EXISTS idx_songs_profile_id",
    );
    expect(historicalMigration).not.toMatch(/DROP\s+COLUMN\s+artist_id/i);
  });

  it("keeps band-song visibility tied to actual membership", () => {
    expect(historicalMigration).toContain(
      'DROP POLICY IF EXISTS "Band members can view band songs"',
    );
    expect(historicalMigration).toContain(
      "bm.band_id = songs.band_id",
    );
    expect(historicalMigration).toContain(
      "bm.user_id = auth.uid()",
    );
  });

  it("reconciles deployed rows without deleting songs", () => {
    expect(reconciliationMigration).toContain(
      "WHERE s.artist_id = p.user_id",
    );
    expect(reconciliationMigration).not.toMatch(/DELETE\s+FROM/i);
    expect(reconciliationMigration).not.toMatch(/DROP\s+TABLE/i);
  });
});
