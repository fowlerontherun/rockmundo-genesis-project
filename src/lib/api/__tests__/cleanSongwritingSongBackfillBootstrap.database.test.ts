import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20251224044818_9d8be14a-a673-410b-b535-08f0bb5b0992.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");

describe("legacy songwriting song bridge clean-bootstrap guard", () => {
  it("checks the complete legacy schema before resolving songs.user_id", () => {
    expect(sql).toContain("to_regclass('public.songs')");
    expect(sql).toContain("to_regclass('public.songwriting_projects')");
    expect(sql).toContain("information_schema.columns");
    expect(sql).toContain("v_song_columns <> 14 OR v_project_columns <> 8");
    expect(sql).toContain("EXECUTE $legacy$");

    const guard = sql.indexOf("v_song_columns <> 14 OR v_project_columns <> 8");
    const legacyInsert = sql.indexOf("INSERT INTO public.songs (\n            user_id");
    expect(guard).toBeGreaterThan(-1);
    expect(legacyInsert).toBeGreaterThan(guard);
  });

  it("preserves the original legacy function, trigger and backfill semantics", () => {
    expect(sql).toContain("create_song_from_completed_project");
    expect(sql).toContain("on_songwriting_project_complete");
    expect(sql).toContain("floor(random() * (420 - 140 + 1) + 140)::int");
    expect(sql).toContain("GREATEST(30, COALESCE(NEW.quality_score, 50))");
    expect(sql).toContain("WHERE sp.status = 'completed' AND s.id IS NULL");
  });

  it("keeps the unrelated self-producer schema fix active on clean databases", () => {
    expect(sql).toContain("ALTER TABLE recording_sessions ALTER COLUMN producer_id DROP NOT NULL");
  });
});
