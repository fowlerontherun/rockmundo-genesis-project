import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const performanceLawMigration = readFileSync(
  "supabase/migrations/20260822164000_enforce_gig_city_curfew_and_genres.sql",
  "utf8",
);
const legacySponsorshipMigration = readFileSync(
  "supabase/migrations/20251219092726_2e170998-8608-42d6-a15e-0474602440bc.sql",
  "utf8",
);

describe("authoritative City Hall gig performance laws", () => {
  it("enforces curfew and genre rules at the gigs table boundary", () => {
    expect(performanceLawMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.enforce_gig_city_performance_laws()",
    );
    expect(performanceLawMigration).toContain(
      "BEFORE INSERT OR UPDATE OF venue_id, band_id, setlist_id, scheduled_date, scheduled_end",
    );
    expect(performanceLawMigration).toContain("ON public.gigs");
    expect(performanceLawMigration).toContain("SECURITY DEFINER");
    expect(performanceLawMigration).toContain("SET search_path = public, pg_temp");
  });

  it("resolves the law effective at the scheduled gig start and snapshots it", () => {
    expect(performanceLawMigration).toContain("cl.effective_from <= NEW.scheduled_date");
    expect(performanceLawMigration).toContain(
      "cl.effective_until IS NULL OR cl.effective_until > NEW.scheduled_date",
    );
    expect(performanceLawMigration).toContain("ORDER BY cl.effective_from DESC");
    expect(performanceLawMigration).toContain("NEW.booking_city_law_id := v_city_law_id");
  });

  it("uses venue-local time and permits a show ending exactly at curfew", () => {
    expect(performanceLawMigration).toContain("COALESCE(c.timezone, 'UTC')");
    expect(performanceLawMigration).toContain("make_interval(hours => v_noise_curfew_hour)");
    expect(performanceLawMigration).toContain("IF v_effective_end > v_curfew_at THEN");
    expect(performanceLawMigration).toContain("gig_city_noise_curfew_violation");
    expect(performanceLawMigration).not.toContain("v_effective_end >= v_curfew_at");
  });

  it("blocks both a banned primary genre and banned songs in the selected setlist", () => {
    expect(performanceLawMigration).toContain("b.primary_genre");
    expect(performanceLawMigration).toContain("b.genre");
    expect(performanceLawMigration).toContain("unnest(v_prohibited_genres)");
    expect(performanceLawMigration).toContain("FROM public.setlist_songs ss");
    expect(performanceLawMigration).toContain("JOIN public.songs s ON s.id = ss.song_id");
    expect(performanceLawMigration).toContain("WHERE ss.setlist_id = NEW.setlist_id");
    expect(performanceLawMigration).toContain("gig_city_prohibited_genre");
  });
});

describe("clean database sponsorship migration compatibility", () => {
  it("does not require the optional legacy sponsorship table to exist", () => {
    expect(legacySponsorshipMigration).toContain(
      "to_regclass('public.sponsorship_payments') IS NOT NULL",
    );
    expect(legacySponsorshipMigration).toContain(
      "Skipping legacy sponsorship_payments status upgrade; table is not present",
    );
    expect(legacySponsorshipMigration).toContain(
      "to_regclass('public.cron_job_config') IS NOT NULL",
    );
  });
});
