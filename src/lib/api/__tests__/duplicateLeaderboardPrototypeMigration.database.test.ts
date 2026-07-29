import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const canonicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20250917090000_create_label_system.sql",
  ),
  "utf8",
);
const duplicateMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251116074100_00b9b268-8bc7-4675-ad1e-03fe1ee58e0f.sql",
  ),
  "utf8",
);

describe("duplicate leaderboard prototype migration", () => {
  it("leaves leaderboard schema ownership with the consolidated migration", () => {
    expect(canonicalMigration).toContain(
      "create table if not exists public.leaderboard_seasons",
    );
    expect(canonicalMigration).toContain(
      "create table if not exists public.leaderboard_season_snapshots",
    );
    expect(canonicalMigration).toContain(
      "create table if not exists public.leaderboard_badges",
    );
    expect(canonicalMigration).toContain(
      "create table if not exists public.leaderboard_badge_awards",
    );
  });

  it("does not recreate tables, policies, indexes or triggers", () => {
    expect(duplicateMigration).not.toMatch(/CREATE\s+TABLE/i);
    expect(duplicateMigration).not.toMatch(/CREATE\s+POLICY/i);
    expect(duplicateMigration).not.toMatch(/CREATE\s+INDEX/i);
    expect(duplicateMigration).not.toMatch(/CREATE\s+TRIGGER/i);
  });

  it("does not introduce the incompatible is_active leaderboard contract", () => {
    expect(duplicateMigration).not.toMatch(/ADD\s+COLUMN[^;]*is_active/i);
    expect(duplicateMigration).not.toMatch(/INDEX[^;]*is_active/i);
    expect(duplicateMigration).toContain(
      "Skipping duplicate leaderboard prototype",
    );
  });
});
