import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260822170000_promoted_genre_gig_demand.sql",
  "utf8",
);
const compactMigration = migration.replace(/\s+/g, " ");

describe("City Hall promoted genre gig demand", () => {
  it("keeps city development demand in the latest ticket-sales authority", () => {
    expect(compactMigration).toContain(
      "LEFT JOIN LATERAL public.city_gameplay_modifiers(v.city_id) m ON true",
    );
    expect(migration).toContain("m.audience_demand_multiplier");
    expect(migration).toContain("city_development_demand_multiplier");
  });

  it("uses the booked law snapshot before the historical fallback", () => {
    expect(compactMigration).toContain(
      "g.booking_city_law_id IS NOT NULL AND cl.id = g.booking_city_law_id",
    );
    expect(migration).toContain("g.booking_city_law_id IS NULL");
    expect(migration).toContain("cl.effective_from <= g.scheduled_date");
    expect(compactMigration).toContain(
      "cl.effective_until IS NULL OR cl.effective_until > g.scheduled_date",
    );
  });

  it("gives primary promoted genres a bounded ten-percent demand bonus", () => {
    expect(compactMigration).toContain(
      "WHEN primary_promotion.is_match THEN 1.1000::numeric",
    );
    expect(migration).toContain("'primary_genre'");
  });

  it("gives mixed promoted setlists a smaller proportional bonus capped at five percent", () => {
    expect(compactMigration).toContain(
      "setlist_promotion.promoted_share * 0.0500::numeric",
    );
    expect(migration).toContain("LEAST(0.0500::numeric");
    expect(compactMigration).toContain("FROM public.setlist_songs ss");
    expect(compactMigration).toContain("JOIN public.songs s ON s.id = ss.song_id");
  });

  it("still hard-caps demand at the booked effective capacity and never reduces sold tickets", () => {
    expect(compactMigration).toContain(
      "COALESCE(NULLIF(g.effective_capacity, 0), v.capacity, 1)",
    );
    expect(compactMigration).toContain("WHEN p.target <= p.sold THEN p.sold");
    expect(compactMigration).toContain("GREATEST( p.sold,");
  });

  it("persists the exact demand multipliers and promotion basis for audit", () => {
    expect(migration).toContain("city_genre_demand_multiplier");
    expect(migration).toContain("city_genre_promotion_basis");
    expect(migration).toContain("t.genre_multiplier");
    expect(migration).toContain("t.promotion_basis");
  });
});
