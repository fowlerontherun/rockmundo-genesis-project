import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251116140250_c141bd74-7214-4fc1-8044-dffaa7d7ebf7.sql",
  ),
  "utf8",
);
const reconciliationMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243630_reconcile_music_video_ownership.sql",
  ),
  "utf8",
);

describe("music video ownership migration", () => {
  it("uses canonical song ownership", () => {
    expect(historicalMigration).toContain("s.artist_id = auth.uid()");
    expect(historicalMigration).not.toContain("songs.user_id");
    expect(historicalMigration).not.toContain("s.user_id");
  });

  it("allows members to manage videos for band-owned songs", () => {
    expect(historicalMigration).toContain("FROM public.band_members bm");
    expect(historicalMigration).toContain("bm.band_id = s.band_id");
    expect(historicalMigration).toContain("bm.user_id = auth.uid()");
  });

  it("recreates policies and the updated-at trigger safely", () => {
    for (const policyName of [
      "Users can view all music videos",
      "Users can create music videos for their own songs",
      "Users can update their own music videos",
      "Users can delete their own music videos",
    ]) {
      expect(historicalMigration).toContain(
        `DROP POLICY IF EXISTS "${policyName}"`,
      );
      expect(historicalMigration).toContain(
        `CREATE POLICY "${policyName}"`,
      );
    }

    expect(historicalMigration).toContain(
      "DROP TRIGGER IF EXISTS update_music_videos_updated_at",
    );
    expect(historicalMigration).toContain(
      "CREATE TRIGGER update_music_videos_updated_at",
    );
  });

  it("reconciles deployed policies without deleting videos", () => {
    expect(reconciliationMigration).toContain("s.artist_id = auth.uid()");
    expect(reconciliationMigration).not.toMatch(/DELETE\s+FROM/i);
    expect(reconciliationMigration).not.toMatch(/DROP\s+TABLE/i);
  });
});
