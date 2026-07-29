import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(file), "utf8");

const lockMigration = read("supabase/migrations/086_band_member_locks.sql");
const progressionMigration = read(
  "supabase/migrations/087_bands_add_chemistry_cohesion.sql",
);
const baseSchema = read(
  "supabase/migrations/20250916075501_1adc3330-58fe-4fde-85d0-b13e1e788c85.sql",
);
const completionMigration = read(
  "supabase/migrations/20291218242700_complete_band_member_lock_foreign_key.sql",
);

describe("numeric band migration order", () => {
  it("does not reference the timestamped bands table from numeric migration 086", () => {
    expect(lockMigration).toContain("CREATE TABLE IF NOT EXISTS public.band_member_locks");
    expect(lockMigration).toContain("band_id uuid NOT NULL");
    expect(lockMigration).not.toContain("REFERENCES public.bands");
  });

  it("keeps the activity type and lock integrity constraints in the early table", () => {
    expect(lockMigration).toContain("CREATE TYPE public.band_member_activity_type");
    expect(lockMigration).toContain("CHECK (lock_end_at > lock_start_at)");
    expect(lockMigration).toContain("UNIQUE (user_id, activity_type)");
    expect(lockMigration).toContain("idx_band_member_locks_band");
  });

  it("makes numeric migration 087 safe when bands do not exist yet", () => {
    expect(progressionMigration).toContain("to_regclass('public.bands') IS NOT NULL");
    expect(progressionMigration).toContain("ADD COLUMN IF NOT EXISTS chemistry");
    expect(progressionMigration).toContain("ADD COLUMN IF NOT EXISTS cohesion");
    expect(progressionMigration).toContain("bands_chemistry_range");
    expect(progressionMigration).toContain("bands_cohesion_range");
  });

  it("confirms the base timestamped schema creates bands", () => {
    expect(baseSchema).toContain("CREATE TABLE public.bands");
    expect(baseSchema).toContain("id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY");
  });

  it("completes the deferred band columns and constraints idempotently", () => {
    expect(completionMigration).toContain("ADD COLUMN IF NOT EXISTS chemistry");
    expect(completionMigration).toContain("ADD COLUMN IF NOT EXISTS cohesion");
    expect(completionMigration).toContain("CHECK (chemistry BETWEEN 0 AND 100)");
    expect(completionMigration).toContain("CHECK (cohesion BETWEEN 0 AND 100)");
  });

  it("adds and validates the deferred cascade foreign key idempotently", () => {
    expect(completionMigration).toContain("to_regclass('public.bands')");
    expect(completionMigration).toContain("band_member_locks_band_id_fkey");
    expect(completionMigration).toContain("FOREIGN KEY (band_id)");
    expect(completionMigration).toContain("REFERENCES public.bands(id)");
    expect(completionMigration).toContain("ON DELETE CASCADE");
    expect(completionMigration).toContain("NOT VALID");
    expect(completionMigration).toContain("VALIDATE CONSTRAINT");
  });
});
