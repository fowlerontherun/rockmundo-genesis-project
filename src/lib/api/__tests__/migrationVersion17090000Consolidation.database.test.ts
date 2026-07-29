import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = path.resolve("supabase/migrations");
const ownerFilename = "20250917090000_create_label_system.sql";
const ownerMigration = fs.readFileSync(
  path.join(migrationsDirectory, ownerFilename),
  "utf8",
);
const reconciliationMigration = fs.readFileSync(
  path.join(
    migrationsDirectory,
    "20291218243400_reconcile_20250917090000_bundle.sql",
  ),
  "utf8",
);
const collisionRegistry = JSON.parse(
  fs.readFileSync(
    path.resolve("scripts/supabase/migration-timestamp-collisions.json"),
    "utf8",
  ),
) as Record<string, string[]>;

describe("20250917090000 migration authority", () => {
  it("has exactly one Supabase migration for the version", () => {
    const matchingFiles = fs
      .readdirSync(migrationsDirectory)
      .filter((filename) => filename.startsWith("20250917090000_"));

    expect(matchingFiles).toEqual([ownerFilename]);
    expect(collisionRegistry["20250917090000"]).toBeUndefined();
  });

  it("consolidates labels, promotions, and seasonal leaderboards", () => {
    expect(ownerMigration).toContain("create table if not exists public.labels");
    expect(ownerMigration).toContain(
      "create table if not exists public.artist_label_contracts",
    );
    expect(ownerMigration).toContain(
      "create table if not exists public.promotion_campaigns",
    );
    expect(ownerMigration).toContain(
      "create table if not exists public.leaderboard_seasons",
    );
    expect(ownerMigration).toContain(
      "create table if not exists public.leaderboard_badge_awards",
    );
  });

  it("removes insecure and invalid legacy seed assumptions", () => {
    expect(ownerMigration).not.toContain("admin@rockmundo.com");
    expect(ownerMigration).not.toContain("admin123");
    expect(ownerMigration).not.toContain("on conflict (name)");
    expect(ownerMigration).not.toContain("profiles.cash");
    expect(ownerMigration).toContain("where not exists(select 1 from public.label_deal_types");
  });

  it("uses canonical song ownership for player promotions", () => {
    expect(ownerMigration).toContain(
      "where id=promotion_campaigns.song_id and artist_id=auth.uid()",
    );
    expect(ownerMigration).not.toContain("songs.user_id");
  });

  it("keeps label membership checks out of recursive RLS policies", () => {
    expect(ownerMigration).toContain(
      "create or replace function public.is_label_team_member",
    );
    expect(ownerMigration).toContain("security definer");
    expect(ownerMigration).toContain("set search_path = public, pg_temp");
    expect(ownerMigration).toContain("drop policy if exists label_members_manage_team");
  });

  it("replays the complete bundle for previously collided deployments", () => {
    for (const marker of [
      "create table if not exists public.labels",
      "create table if not exists public.promotion_campaigns",
      "create table if not exists public.leaderboard_seasons",
      "create or replace function public.is_label_team_member",
      "where not exists(select 1 from public.label_deal_types",
    ]) {
      expect(reconciliationMigration).toContain(marker);
    }
    expect(reconciliationMigration).not.toContain("admin@rockmundo.com");
    expect(reconciliationMigration).not.toContain("on conflict (name)");
  });
});
