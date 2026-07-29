import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = path.resolve("supabase/migrations");
const ownerFilename = "20250916153000_add_contract_recoupment_fields.sql";
const ownerMigration = fs.readFileSync(
  path.join(migrationsDirectory, ownerFilename),
  "utf8",
);
const reconciliationMigration = fs.readFileSync(
  path.join(
    migrationsDirectory,
    "20291218243300_reconcile_20250916153000_bundle.sql",
  ),
  "utf8",
);
const collisionRegistry = JSON.parse(
  fs.readFileSync(
    path.resolve("scripts/supabase/migration-timestamp-collisions.json"),
    "utf8",
  ),
) as Record<string, string[]>;

describe("20250916153000 migration authority", () => {
  it("has exactly one Supabase migration for the version", () => {
    const matchingFiles = fs
      .readdirSync(migrationsDirectory)
      .filter((filename) => filename.startsWith("20250916153000_"));

    expect(matchingFiles).toEqual([ownerFilename]);
    expect(collisionRegistry["20250916153000"]).toBeUndefined();
  });

  it("consolidates every valid feature responsibility", () => {
    expect(ownerMigration).toContain("ADD COLUMN IF NOT EXISTS advance_balance");
    expect(ownerMigration).toContain("ADD COLUMN IF NOT EXISTS followers");
    expect(ownerMigration).toContain("CREATE TABLE IF NOT EXISTS public.competitions");
    expect(ownerMigration).toContain("CREATE TABLE IF NOT EXISTS public.jam_sessions");
    expect(ownerMigration).toContain("CREATE VIEW public.leaderboards");
    expect(ownerMigration).toContain("CREATE TABLE IF NOT EXISTS public.schedule_events");
    expect(ownerMigration).toContain("CREATE TABLE IF NOT EXISTS public.streaming_stats");
    expect(ownerMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.song_stream_growth_history",
    );
  });

  it("uses canonical song ownership throughout analytics and growth", () => {
    expect(ownerMigration).toContain("artist_id AS user_id");
    expect(ownerMigration).toContain(
      "player_skills.user_id = songs.artist_id",
    );
    expect(ownerMigration).not.toContain("songs.user_id");
    expect(ownerMigration).not.toContain("s.user_id");
  });

  it("uses distinct dollar-quote delimiters for the cron statement", () => {
    expect(ownerMigration).toContain("DO $schedule$");
    expect(ownerMigration).toContain(
      "$job$SELECT public.simulate_song_growth();$job$",
    );
    expect(ownerMigration).toContain("$schedule$;");
  });

  it("reconciles databases where the legacy collision skipped files", () => {
    expect(reconciliationMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.competitions",
    );
    expect(reconciliationMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.jam_sessions",
    );
    expect(reconciliationMigration).toContain("CREATE VIEW public.leaderboards");
    expect(reconciliationMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.schedule_events",
    );
    expect(reconciliationMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.streaming_stats",
    );
    expect(reconciliationMigration).toContain("songs.artist_id AS user_id");
  });
});
