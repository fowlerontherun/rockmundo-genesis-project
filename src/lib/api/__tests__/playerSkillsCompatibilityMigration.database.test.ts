import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20250926075937_ead404e2-8dc0-425d-a244-06f4099f9a4c.sql",
  ),
  "utf8",
);
const forwardMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243440_reconcile_player_skills_compatibility.sql",
  ),
  "utf8",
);

describe("player skills compatibility migration", () => {
  it("does not recreate the authoritative player skills table", () => {
    expect(historicalMigration).not.toContain(
      "CREATE TABLE public.player_skills",
    );
    expect(historicalMigration).not.toContain(
      "CREATE TABLE IF NOT EXISTS public.player_skills",
    );
    expect(historicalMigration).toContain("ALTER TABLE public.player_skills");
  });

  it("retains all intended skill extensions", () => {
    for (const column of [
      "creativity",
      "technical",
      "business",
      "marketing",
      "composition",
    ]) {
      expect(historicalMigration).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
      expect(forwardMigration).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
  });

  it("preserves the daily XP and education resource systems", () => {
    expect(historicalMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.profile_daily_xp_grants",
    );
    expect(historicalMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.education_youtube_resources",
    );
    expect(historicalMigration).toContain(
      "profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE",
    );
    expect(forwardMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.profile_daily_xp_grants",
    );
    expect(forwardMigration).toContain(
      "CREATE TABLE IF NOT EXISTS public.education_youtube_resources",
    );
  });

  it("recreates policies and triggers safely", () => {
    expect(historicalMigration).toContain(
      'DROP POLICY IF EXISTS "Users can view their own XP grants"',
    );
    expect(historicalMigration).toContain(
      'DROP POLICY IF EXISTS "YouTube resources are viewable by everyone"',
    );
    expect(historicalMigration).toContain(
      "DROP TRIGGER IF EXISTS update_player_skills_updated_at",
    );
    expect(historicalMigration).toContain(
      "DROP TRIGGER IF EXISTS update_education_youtube_resources_updated_at",
    );
  });

  it("adds current city without failing when it already exists", () => {
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS current_city_id uuid",
    );
    expect(forwardMigration).toContain(
      "ADD COLUMN IF NOT EXISTS current_city_id uuid",
    );
  });
});
