import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const legacy = readFileSync(resolve(process.cwd(),
  "supabase/migrations/20250919133739_add_venue_support_structures.sql"), "utf8");
const bandLoyalty = readFileSync(resolve(process.cwd(),
  "supabase/migrations/20251104065605_50284f5f-3a3a-4cdc-9f83-ade0cf8a0632.sql"), "utf8");

describe("venue loyalty migration replay", () => {
  it("handles the legacy user-to-venue table without deleting its user data", () => {
    expect(legacy).toContain("CREATE TABLE IF NOT EXISTS public.venue_relationships");
    expect(legacy).toContain("user_id uuid NOT NULL");
    expect(legacy).toContain("relationship_score integer");
    expect(bandLoyalty).toContain("ALTER COLUMN user_id DROP NOT NULL");
    expect(bandLoyalty).not.toContain("DROP TABLE public.venue_relationships");
    expect(bandLoyalty).not.toContain("TRUNCATE public.venue_relationships");
  });
  it("adds band-specific columns and uniqueness for trigger conflict handling", () => {
    expect(bandLoyalty).toContain("ADD COLUMN IF NOT EXISTS band_id uuid REFERENCES public.bands(id)");
    expect(bandLoyalty).toContain("ADD COLUMN IF NOT EXISTS loyalty_points integer");
    expect(bandLoyalty).toContain("ADD CONSTRAINT venue_relationships_band_id_venue_id_key");
    expect(bandLoyalty).toContain("UNIQUE (band_id,venue_id)");
    expect(bandLoyalty).toContain("ON CONFLICT (band_id, venue_id)");
  });
});
