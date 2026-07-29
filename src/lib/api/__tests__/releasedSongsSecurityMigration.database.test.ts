import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251216100444_38966a62-40f7-466f-8ab8-411e57a91a19.sql",
  ),
  "utf8",
);
const reconciliationMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243650_reconcile_released_songs_and_security_policies.sql",
  ),
  "utf8",
);

describe("released songs and security policy migration", () => {
  it("preserves the released_songs user_id contract through artist_id", () => {
    expect(historicalMigration).toContain("s.artist_id AS user_id");
    expect(historicalMigration).not.toContain("s.user_id");
    expect(historicalMigration).not.toContain("songs.user_id");
    expect(historicalMigration).toContain("WITH (security_invoker = true)");
  });

  it("recreates protected-table policies safely", () => {
    const policyNames = [
      "Band members can view audience memory",
      "Band members can view band conflicts",
      "Band members can view gig analytics",
      "Band members can view gig offers",
      "Band leaders can update gig offers",
      "Everyone can view multiplayer events",
      "Users can view own daily cats",
      "Users can insert own daily cats",
      "Users can update own daily cats",
      "Everyone can view promoters",
      "Band members can view stage events",
      "Band members can view tour gigs",
      "Band leaders can manage tour gigs",
      "Band members can view tour logistics",
      "Band leaders can manage tour logistics",
      "Band members can view venue relationships",
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

  it("uses membership and profile existence checks", () => {
    expect(historicalMigration).toContain("FROM public.band_members bm");
    expect(historicalMigration).toContain("bm.user_id = auth.uid()");
    expect(historicalMigration).toContain("FROM public.profiles p");
    expect(historicalMigration).toContain("p.user_id = auth.uid()");
  });

  it("adds with-check enforcement to mutable policies", () => {
    expect(historicalMigration).toMatch(
      /CREATE POLICY "Band leaders can update gig offers"[\s\S]*?WITH CHECK \(/,
    );
    expect(historicalMigration).toMatch(
      /CREATE POLICY "Users can update own daily cats"[\s\S]*?WITH CHECK \(/,
    );
    expect(historicalMigration).toMatch(
      /CREATE POLICY "Band leaders can manage tour logistics"[\s\S]*?WITH CHECK \(/,
    );
  });

  it("reconciles deployed objects without deleting gameplay data", () => {
    expect(reconciliationMigration).toContain("s.artist_id AS user_id");
    expect(reconciliationMigration).toContain(
      'DROP POLICY IF EXISTS "Band members can view audience memory"',
    );
    expect(reconciliationMigration).not.toMatch(/DELETE\s+FROM/i);
    expect(reconciliationMigration).not.toMatch(/DROP\s+TABLE/i);
  });
});
