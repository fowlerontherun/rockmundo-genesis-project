import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(file), "utf8");

const prematureMigration = read(
  "supabase/migrations/20250214120000_add_costs_to_tour_venues.sql",
);
const tourSchemaMigration = read(
  "supabase/migrations/20250916081629_c5c74efe-b5cd-4bd7-9b25-0cda3f8be4d6.sql",
);
const completionMigration = read(
  "supabase/migrations/20291218242900_complete_tour_venue_cost_fields.sql",
);

describe("tour venue cost migration order", () => {
  it("keeps the pre-table February migration dependency-free", () => {
    expect(prematureMigration).toContain("explicit no-op");
    expect(prematureMigration).not.toContain("ALTER TABLE public.tour_venues");
    expect(prematureMigration).toContain("Deferred tour venue cost fields");
  });

  it("confirms tour venues are created by the later MMO schema", () => {
    expect(tourSchemaMigration).toContain("CREATE TABLE public.tour_venues");
    expect(tourSchemaMigration).toContain("tour_id uuid NOT NULL REFERENCES public.tours(id)");
    expect(tourSchemaMigration).toContain("venue_id uuid NOT NULL REFERENCES public.venues(id)");
  });

  it("adds all cost fields idempotently after table creation", () => {
    expect(completionMigration).toContain("to_regclass('public.tour_venues')");
    expect(completionMigration).toContain("ADD COLUMN IF NOT EXISTS travel_cost integer NOT NULL DEFAULT 0");
    expect(completionMigration).toContain("ADD COLUMN IF NOT EXISTS lodging_cost integer NOT NULL DEFAULT 0");
    expect(completionMigration).toContain("ADD COLUMN IF NOT EXISTS misc_cost integer NOT NULL DEFAULT 0");
    expect(completionMigration).toContain("UPDATE public.tour_venues");
  });

  it("protects every tour cost from negative values", () => {
    expect(completionMigration).toContain("tour_venues_travel_cost_nonnegative");
    expect(completionMigration).toContain("tour_venues_lodging_cost_nonnegative");
    expect(completionMigration).toContain("tour_venues_misc_cost_nonnegative");
    expect(completionMigration).toContain("CHECK (travel_cost >= 0) NOT VALID");
    expect(completionMigration).toContain("VALIDATE CONSTRAINT tour_venues_misc_cost_nonnegative");
  });
});