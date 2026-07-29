import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251116161634_a15e5fed-31f9-49bf-8005-e67b3fa2a8bf.sql",
  ),
  "utf8",
);
const reconciliationMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243640_reconcile_setlist_performance_policies.sql",
  ),
  "utf8",
);

describe("setlist performance policy migration", () => {
  it("targets the real public performance catalogue", () => {
    expect(historicalMigration).toContain(
      "ON public.performance_items_catalog",
    );
    expect(historicalMigration).not.toMatch(
      /ON\s+(?:public\.)?performance_items(?:\s|;)/i,
    );
    expect(historicalMigration).toContain(
      'DROP POLICY IF EXISTS "Everyone can view performance items catalog"',
    );
    expect(historicalMigration).toContain(
      'CREATE POLICY "Everyone can view performance items catalog"',
    );
  });

  it("limits setlist item management to members of the owning band", () => {
    expect(historicalMigration).toContain("FROM public.setlists s");
    expect(historicalMigration).toContain(
      "JOIN public.band_members bm ON bm.band_id = s.band_id",
    );
    expect(historicalMigration).toContain("bm.user_id = auth.uid()");
  });

  it("recreates all setlist policies safely", () => {
    const policyNames = [
      "Band members can view their setlist songs",
      "Band members can insert setlist songs",
      "Band members can update setlist songs",
      "Band members can delete setlist songs",
    ];

    for (const policyName of policyNames) {
      expect(historicalMigration).toContain(
        `DROP POLICY IF EXISTS "${policyName}"`,
      );
      expect(historicalMigration).toContain(
        `CREATE POLICY "${policyName}"`,
      );
    }

    expect(historicalMigration).toMatch(
      /CREATE POLICY "Band members can update setlist songs"[\s\S]*?WITH CHECK \(/,
    );
  });

  it("reconciles deployed policies without deleting setlists or catalogue items", () => {
    expect(reconciliationMigration).toContain(
      "ON public.performance_items_catalog",
    );
    expect(reconciliationMigration).toContain(
      "JOIN public.band_members bm ON bm.band_id = s.band_id",
    );
    expect(reconciliationMigration).not.toMatch(/DELETE\s+FROM/i);
    expect(reconciliationMigration).not.toMatch(/DROP\s+TABLE/i);
  });
});
