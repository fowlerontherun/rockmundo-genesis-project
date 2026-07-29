import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251107080453_3624df0a-5779-4d30-aef5-236f9155a5a2.sql",
  ),
  "utf8",
);

const reconciliationMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243610_reconcile_label_schema_compatibility.sql",
  ),
  "utf8",
);

describe("label schema compatibility migration", () => {
  it("extends the canonical label schema instead of recreating it", () => {
    expect(historicalMigration).not.toMatch(/CREATE\s+TABLE/i);
    expect(historicalMigration).not.toMatch(/CREATE\s+POLICY/i);
    expect(historicalMigration).not.toMatch(/CREATE\s+TRIGGER/i);
    expect(historicalMigration).toContain(
      "ALTER TABLE public.label_deal_types",
    );
  });

  it("provides the active deal-range aliases used by the UI", () => {
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS royalty_artist_pct integer",
    );
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS advance_min integer",
    );
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS advance_max integer",
    );
    expect(historicalMigration).toContain(
      "round(default_artist_royalty)::integer",
    );
  });

  it("seeds templates through canonical and compatibility fields", () => {
    expect(historicalMigration).toContain("default_artist_royalty");
    expect(historicalMigration).toContain("default_label_royalty");
    expect(historicalMigration).toContain("royalty_artist_pct");
    expect(historicalMigration).toContain("WHERE NOT EXISTS");
    expect(historicalMigration).not.toContain("ON CONFLICT (name)");
  });

  it("uses non-validating checks for legacy deal data", () => {
    expect(historicalMigration).toContain(
      "label_deal_types_royalty_artist_pct_check",
    );
    expect(historicalMigration).toContain(
      "label_deal_types_advance_range_check",
    );
    expect(historicalMigration).toContain("NOT VALID");
  });

  it("reconciles aliases without deleting label data or replacing RLS", () => {
    expect(reconciliationMigration).toContain(
      "ALTER TABLE public.label_deal_types",
    );
    expect(reconciliationMigration).not.toMatch(/DELETE\s+FROM/i);
    expect(reconciliationMigration).not.toMatch(/DROP\s+TABLE/i);
    expect(reconciliationMigration).not.toMatch(/CREATE\s+POLICY/i);
  });
});
