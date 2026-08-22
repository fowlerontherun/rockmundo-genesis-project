import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20251219111642_75fba685-3747-4558-9e54-f95b4064365f.sql",
  "utf8",
);

describe("legacy label catalogue clean bootstrap", () => {
  it("uses the existing system catalogue owner instead of migration auth.uid()", () => {
    expect(migration).toContain("created_by");
    expect(migration).toContain(
      "'00000000-0000-0000-0000-00000000a11e'::uuid",
    );
  });

  it("uses the same deterministic label ids as the canonical catalogue seed", () => {
    expect(migration).toContain(
      "md5('rockmundo:system-label:' || seed.name)::uuid",
    );
    expect(migration).toContain("ON CONFLICT (id) DO NOTHING");
  });

  it("does not rely on an authenticated migration session", () => {
    expect(migration).not.toContain("auth.uid()");
  });
});
