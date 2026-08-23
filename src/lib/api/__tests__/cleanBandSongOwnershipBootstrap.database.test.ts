import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20260116085559_2287f1c6-37b2-4e70-8e2b-80d72d44a392.sql",
);
const baselinePath = path.resolve(
  process.cwd(),
  "supabase/migrations/20250916075501_1adc3330-58fe-4fde-85d0-b13e1e788c85.sql",
);

const sql = fs.readFileSync(migrationPath, "utf8");
const baseline = fs.readFileSync(baselinePath, "utf8");

describe("band song ownership clean-bootstrap compatibility", () => {
  it("uses the canonical auth-user song owner column", () => {
    expect(baseline).toContain("artist_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE");
    expect(sql).toContain("s.artist_id = auth.uid()");
    expect(sql).not.toContain("s.user_id = auth.uid()");
  });

  it("preserves original-writer ownership as an allowed path", () => {
    expect(sql).toContain("s.original_writer_id = auth.uid()");
    expect(sql).toContain('CREATE POLICY "Song owners can insert ownership records"');
    expect(sql).toContain("ON band_song_ownership FOR INSERT");
  });

  it("keeps band membership and leader authorization intact", () => {
    expect(sql).toContain("WHERE bm.user_id = auth.uid()");
    expect(sql).toContain("WHERE b.id = band_id AND b.leader_id = auth.uid()");
  });
});
