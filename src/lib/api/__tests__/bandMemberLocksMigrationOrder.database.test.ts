import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(file), "utf8");

const earlyMigration = read("supabase/migrations/086_band_member_locks.sql");
const baseSchema = read(
  "supabase/migrations/20250916075501_1adc3330-58fe-4fde-85d0-b13e1e788c85.sql",
);
const completionMigration = read(
  "supabase/migrations/20291218242700_complete_band_member_lock_foreign_key.sql",
);

describe("band member lock migration order", () => {
  it("does not reference the timestamped bands table from numeric migration 086", () => {
    expect(earlyMigration).toContain("CREATE TABLE IF NOT EXISTS public.band_member_locks");
    expect(earlyMigration).toContain("band_id uuid NOT NULL");
    expect(earlyMigration).not.toContain("REFERENCES public.bands");
  });

  it("keeps the activity type and lock integrity constraints in the early table", () => {
    expect(earlyMigration).toContain("CREATE TYPE public.band_member_activity_type");
    expect(earlyMigration).toContain("CHECK (lock_end_at > lock_start_at)");
    expect(earlyMigration).toContain("UNIQUE (user_id, activity_type)");
    expect(earlyMigration).toContain("idx_band_member_locks_band");
  });

  it("confirms the base timestamped schema creates bands", () => {
    expect(baseSchema).toContain("CREATE TABLE public.bands");
    expect(baseSchema).toContain("id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY");
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
