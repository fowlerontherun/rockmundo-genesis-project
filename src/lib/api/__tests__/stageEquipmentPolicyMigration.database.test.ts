import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251101120000_implement_stage_equipment_system.sql",
  ),
  "utf8",
);

const reconciliationMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243600_reconcile_stage_equipment_policies.sql",
  ),
  "utf8",
);

describe("stage equipment policy migration", () => {
  it("does not use unsupported policy or trigger syntax", () => {
    expect(historicalMigration).not.toContain("CREATE POLICY IF NOT EXISTS");
    expect(historicalMigration).not.toContain("CREATE TRIGGER IF NOT EXISTS");
  });

  it("recreates every policy safely", () => {
    const policyNames = [
      "Band members can view their vehicles",
      "Band members can manage their vehicles",
      "Band members can view equipment logs",
      "Band members can manage equipment logs",
    ];

    for (const policyName of policyNames) {
      expect(historicalMigration).toContain(
        `DROP POLICY IF EXISTS "${policyName}"`,
      );
      expect(historicalMigration).toContain(
        `CREATE POLICY "${policyName}"`,
      );
    }
  });

  it("uses membership existence checks for fleet and log access", () => {
    expect(historicalMigration).toContain("FROM public.band_members bm");
    expect(historicalMigration).toContain("bm.user_id = auth.uid()");
    expect(historicalMigration).not.toMatch(/band_id\s+IN\s*\(/i);
  });

  it("reconciles deployed policies without modifying equipment data", () => {
    expect(reconciliationMigration).toContain(
      "DROP TRIGGER IF EXISTS update_band_vehicles_updated_at",
    );
    expect(reconciliationMigration).toContain(
      "CREATE TRIGGER update_band_vehicles_updated_at",
    );
    expect(reconciliationMigration).not.toMatch(/DELETE\s+FROM/i);
    expect(reconciliationMigration).not.toMatch(/DROP\s+TABLE/i);
  });
});
