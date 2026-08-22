import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20251219113305_06f9d02c-a9d8-4098-94ee-afaa74acde78.sql",
  "utf8",
);

describe("legacy regional label catalogue clean bootstrap", () => {
  it("normalises historical inserts through the canonical system catalogue identity", () => {
    expect(migration).toContain(
      "NEW.id := md5('rockmundo:system-label:' || NEW.name)::uuid",
    );
    expect(migration).toContain(
      "NEW.created_by := '00000000-0000-0000-0000-00000000a11e'::uuid",
    );
  });

  it("skips names already seeded by the earlier deterministic catalogue", () => {
    expect(migration).toContain("FROM public.labels existing");
    expect(migration).toContain(
      "lower(trim(existing.name)) = lower(trim(NEW.name))",
    );
    expect(migration).toContain("RETURN NULL;");
  });

  it("removes the compatibility trigger and helper after the historical seed", () => {
    expect(migration).toContain(
      "DROP TRIGGER IF EXISTS normalise_legacy_regional_label_seed ON public.labels;",
    );
    expect(migration).toContain(
      "DROP FUNCTION IF EXISTS public._normalise_legacy_regional_label_seed();",
    );
  });
});
