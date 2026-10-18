import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../../supabase/migrations/20250918174219_create_friendships_table.sql", import.meta.url),
  "utf8",
);

describe("historical friendship migration fresh replay", () => {
  it("creates friendship enum through a version-compatible schema-qualified guard", () => {
    expect(sql).not.toContain("CREATE TYPE IF NOT EXISTS");
    expect(sql).toContain("DO $friendship_enum$");
    expect(sql).toContain("t.typname='friendship_status'");
    expect(sql).toContain("n.nspname='public'");
    expect(sql).toContain("CREATE TYPE public.friendship_status AS ENUM");
  });

  it("does not expose other users' friendship data through definer-rights views", () => {
    expect(sql).toContain("CREATE OR REPLACE VIEW public.pending_friendships WITH (security_invoker=true) AS");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.accepted_friendships WITH (security_invoker=true) AS");
    expect(sql).toContain("ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY");
  });
});
