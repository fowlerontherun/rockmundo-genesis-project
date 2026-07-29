import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251005110929_18de365f-86e9-4c43-8e45-c58505b495ea.sql",
  ),
  "utf8",
);
const forwardMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243500_reconcile_jam_activity_compatibility.sql",
  ),
  "utf8",
);

describe("jam and activity compatibility migration", () => {
  it("keeps profile activity status compatibility fields", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.profile_activity_statuses",
    );
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS activity_type");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS completed_at");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS metadata");
  });

  it("makes activity policies and its temporary trigger replay-safe", () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Users can view their own activity statuses"',
    );
    expect(migration).toContain(
      "DROP TRIGGER IF EXISTS update_profile_activity_statuses_updated_at",
    );
  });

  it("does not recreate or redefine the authoritative jam system", () => {
    expect(migration).not.toContain(
      "CREATE TABLE IF NOT EXISTS public.jam_sessions",
    );
    expect(migration).not.toContain("CREATE POLICY \"Jam sessions");
    expect(migration).not.toContain(
      "CREATE TRIGGER update_jam_sessions_updated_at",
    );
    expect(migration).not.toContain(
      "EXECUTE FUNCTION public.update_updated_at_column();\n\n-- The 20250916153000 bundle owns",
    );
  });

  it("adds only the missing jam status field", () => {
    expect(migration).toContain("ALTER TABLE public.jam_sessions");
    expect(migration).toContain(
      "ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'active'",
    );
    expect(forwardMigration).toContain(
      "ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'active'",
    );
  });

  it("does not rewrite deployed jam or activity rows", () => {
    expect(forwardMigration).not.toContain("UPDATE public.jam_sessions");
    expect(forwardMigration).not.toContain(
      "DELETE FROM public.profile_activity_statuses",
    );
    expect(forwardMigration).not.toContain("CREATE POLICY");
    expect(forwardMigration).not.toContain("CREATE TRIGGER");
  });
});
