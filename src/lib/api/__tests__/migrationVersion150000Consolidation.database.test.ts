import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = path.resolve("supabase/migrations");
const ownerFilename = "20250916150000_create_notifications_table.sql";
const ownerMigration = fs.readFileSync(
  path.join(migrationsDirectory, ownerFilename),
  "utf8",
);
const reconciliationMigration = fs.readFileSync(
  path.join(
    migrationsDirectory,
    "20291218243200_reconcile_20250916150000_bundle.sql",
  ),
  "utf8",
);
const collisionRegistry = JSON.parse(
  fs.readFileSync(
    path.resolve("scripts/supabase/migration-timestamp-collisions.json"),
    "utf8",
  ),
) as Record<string, string[]>;

describe("20250916150000 migration authority", () => {
  it("has exactly one Supabase migration for the version", () => {
    const matchingFiles = fs
      .readdirSync(migrationsDirectory)
      .filter((filename) => filename.startsWith("20250916150000_"));

    expect(matchingFiles).toEqual([ownerFilename]);
    expect(collisionRegistry["20250916150000"]).toBeUndefined();
  });

  it("consolidates every valid schema responsibility", () => {
    expect(ownerMigration).toContain("CREATE TABLE IF NOT EXISTS public.notifications");
    expect(ownerMigration).toContain("CREATE TABLE IF NOT EXISTS public.record_labels");
    expect(ownerMigration).toContain("CREATE TABLE IF NOT EXISTS public.streaming_campaigns");
    expect(ownerMigration).toContain("ADD COLUMN IF NOT EXISTS mix_quality");
    expect(ownerMigration).toContain("ADD COLUMN IF NOT EXISTS master_quality");
    expect(ownerMigration).toContain("ADD COLUMN IF NOT EXISTS production_cost");
  });

  it("does not restore the invalid weekly statistics contract", () => {
    expect(ownerMigration).not.toContain("CREATE VIEW public.weekly_stats");
    expect(ownerMigration).not.toContain("FROM public.songs\n  GROUP BY user_id");
    expect(ownerMigration).toContain("DROP VIEW IF EXISTS public.weekly_stats");
  });

  it("reconciles databases where the legacy collision skipped files", () => {
    expect(reconciliationMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.notifications",
    );
    expect(reconciliationMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.record_labels",
    );
    expect(reconciliationMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.streaming_campaigns",
    );
    expect(reconciliationMigration).toContain(
      "ALTER TABLE public.songs",
    );
    expect(reconciliationMigration).toContain(
      "DROP VIEW IF EXISTS public.weekly_stats",
    );
  });
});
