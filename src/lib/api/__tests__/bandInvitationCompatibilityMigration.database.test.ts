import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const historicalMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20251007130559_cab5223d-b43a-423b-9fb7-e102b362f61c.sql",
  ),
  "utf8",
);

const reconciliationMigration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20291218243520_reconcile_band_invitation_schema.sql",
  ),
  "utf8",
);

describe("band invitation compatibility migration", () => {
  it("extends the authoritative table instead of recreating it", () => {
    expect(historicalMigration).not.toMatch(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.band_invitations/i,
    );
    expect(historicalMigration).toContain(
      "ALTER TABLE public.band_invitations",
    );
  });

  it("adds and backfills every field used by the current invitation RPC", () => {
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS inviter_user_id",
    );
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS invited_user_id",
    );
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS instrument_role",
    );
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS vocal_role",
    );
    expect(historicalMigration).toContain(
      "ADD COLUMN IF NOT EXISTS message",
    );
    expect(historicalMigration).toContain(
      "inviter_user_id = COALESCE(inviter_user_id, inviter_id)",
    );
    expect(historicalMigration).toContain(
      "invited_user_id = COALESCE(invited_user_id, invitee_id)",
    );
    expect(historicalMigration).toContain(
      "NULLIF(btrim(role), '')",
    );
  });

  it("protects pending invitations and removes the public read policy", () => {
    expect(historicalMigration).toContain(
      "band_invitations_one_pending_per_user_band_idx",
    );
    expect(historicalMigration).toContain(
      'DROP POLICY IF EXISTS "Band invitations are viewable by everyone"',
    );
    expect(historicalMigration).not.toContain(
      'CREATE POLICY "Band invitations are viewable by everyone"',
    );
    expect(historicalMigration).toContain(
      'CREATE POLICY "Band members can view their band invitations"',
    );
  });

  it("reconciles deployed databases without deleting invitation data", () => {
    expect(reconciliationMigration).toContain(
      "ADD COLUMN IF NOT EXISTS invited_user_id",
    );
    expect(reconciliationMigration).toContain(
      "UPDATE public.band_invitations",
    );
    expect(reconciliationMigration).not.toMatch(/DELETE\s+FROM/i);
    expect(reconciliationMigration).not.toMatch(/DROP\s+TABLE/i);
  });
});
