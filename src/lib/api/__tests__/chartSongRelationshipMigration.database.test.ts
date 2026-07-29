import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251116160234_783ee2e7-9c14-427a-9bda-1e0841750618.sql",
  ),
  "utf8",
);

describe("chart song relationship migration", () => {
  it("checks the constraint catalogue before adding the foreign key", () => {
    expect(migration).toContain("FROM pg_constraint");
    expect(migration).toContain("chart_entries_song_id_fkey");
    expect(migration).toContain(
      "conrelid = 'public.chart_entries'::regclass",
    );
    expect(migration).toContain("IF NOT EXISTS");
  });

  it("keeps the song relationship cascading and schema-qualified", () => {
    expect(migration).toContain("ALTER TABLE public.chart_entries");
    expect(migration).toContain("REFERENCES public.songs(id)");
    expect(migration).toContain("ON DELETE CASCADE");
  });

  it("rebuilds both chart views without deleting chart data", () => {
    expect(migration).toContain("CREATE VIEW public.chart_singles");
    expect(migration).toContain("CREATE VIEW public.chart_albums");
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/DROP\s+TABLE/i);
  });
});
