import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260830175331_character_scoped_band_travel_duration.sql",
  "utf8",
);
const rejoin = readFileSync(
  "supabase/functions/rejoin-tour-transport/index.ts",
  "utf8",
);
const complete = readFileSync("supabase/functions/complete-travel/index.ts", "utf8");
const remainingDurations = readFileSync(
  "supabase/migrations/20260830181526_reduce_remaining_travel_options.sql",
  "utf8",
);
const tourRoundingCorrection = readFileSync(
  "supabase/migrations/20260830191000_preserve_tour_duration_rounding.sql",
  "utf8",
);
const charterFlight = readFileSync("src/utils/charterFlight.ts", "utf8");

describe("character-scoped band travel database contract", () => {
  it("lets any living band-following character prepare travel for ordinary gigs", () => {
    expect(migration).toContain("coalesce(bm.travels_with_band, false) AS travels_with_band");
    expect(migration).toContain("OR coalesce(bm.travels_with_band, false) = true");
    expect(migration).not.toContain("AND coalesce(p.is_active, true) = true");
    expect(migration).toContain("public.book_authoritative_travel_for_profile(");
  });

  it("stores fractional durations and reduces every server-side option by thirty minutes", () => {
    expect(migration).toContain("TYPE numeric(8,2)");
    expect(migration).toContain("duration_hours = greatest(0.5, duration_hours - 0.5)");
    expect(migration).toContain("v_raw_duration - 0.5");
    expect(migration).toContain("v_duration - 0.5");
    expect(migration).not.toContain("greatest(1, ceil(v_adjusted_duration)");
    expect(remainingDurations).toContain("v_arrival timestamptz := now() + interval '90 minutes'");
    expect(remainingDurations).toContain("v_duration_hours := greatest(0.5");
    expect(remainingDurations).toContain("greatest(0.5, ceil(");
    expect(remainingDurations).toContain("- 0.5");
    expect(tourRoundingCorrection).toContain("greatest(0.5, ceil(");
    expect(tourRoundingCorrection).toContain(") - 0.5);");
    expect(charterFlight).toContain("CHARTER_FLIGHT_DURATION_MINUTES = 90");
  });

  it("never treats future rejoin legs as in-progress", () => {
    expect(rejoin).toContain("departureTime > now ? 'scheduled' : 'in_progress'");
    expect(rejoin).toContain("A future leg is only scheduled");
    expect(rejoin).toContain("is_traveling: false");
    expect(rejoin).toContain("profile_id is required");
    expect(rejoin).toContain(".eq('id', requestedProfileId)");
    expect(complete).toContain("Skipping legacy travel");
    expect(complete).not.toContain('.eq("user_id", travel.user_id).eq("is_active", true)');
  });
});
