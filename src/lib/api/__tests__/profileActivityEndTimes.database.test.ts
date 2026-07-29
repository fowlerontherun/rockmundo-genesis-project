import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(file), "utf8");

const activityTableMigrations = [
  "supabase/migrations/20241010120000_enable_busking_core.sql",
  "supabase/migrations/20270606100000_add_profile_activity_statuses.sql",
  "supabase/migrations/20270630153000_expand_songwriting_and_activity_schema.sql",
].map(read);

const compatibilityMigration = read(
  "supabase/migrations/20291218242800_standardise_profile_activity_end_times.sql",
);

const gameDataSource = read("src/hooks/useGameData.tsx");

describe("profile activity end-time authority", () => {
  it("does not use a non-immutable generated timestamptz expression", () => {
    for (const migration of activityTableMigrations) {
      expect(migration).toContain("ends_at timestamptz");
      expect(migration).not.toContain("GENERATED ALWAYS AS");
      expect(migration.toLowerCase()).not.toContain("generated always as");
    }
  });

  it("calculates end times through an insert and update trigger", () => {
    for (const migration of activityTableMigrations) {
      expect(migration).toContain("sync_profile_activity_status_ends_at");
      expect(migration.toLowerCase()).toContain("before insert or update");
      expect(migration).toContain("make_interval(mins => NEW.duration_minutes)");
    }
  });

  it("uses PostgreSQL-compatible idempotent policy and constraint creation", () => {
    for (const migration of activityTableMigrations) {
      const lowerMigration = migration.toLowerCase();
      expect(lowerMigration).not.toContain("create policy if not exists");
      expect(lowerMigration).not.toContain("add constraint if not exists");
      expect(migration).toContain("activity_feed_duration_check");
      expect(migration).toContain("pg_constraint");
    }
  });

  it("converts and backfills existing generated columns safely", () => {
    expect(compatibilityMigration).toContain("is_generated = 'ALWAYS'");
    expect(compatibilityMigration).toContain("ALTER COLUMN ends_at DROP EXPRESSION");
    expect(compatibilityMigration).toContain("ADD COLUMN IF NOT EXISTS ends_at timestamptz");
    expect(compatibilityMigration).toContain("profile_activity_statuses_sync_ends_at");
    expect(compatibilityMigration).toContain("UPDATE public.profile_activity_statuses");
    expect(compatibilityMigration).toContain("ends_at IS DISTINCT FROM CASE");
  });

  it("supports the existing activity writer without browser-calculated end times", () => {
    expect(gameDataSource).toContain("duration_minutes: normalizedDuration");
    expect(gameDataSource).toContain("started_at: new Date().toISOString()");
    expect(gameDataSource).not.toContain("ends_at: new Date");
  });
});