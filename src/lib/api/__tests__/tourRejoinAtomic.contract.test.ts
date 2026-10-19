import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261019084000_atomic_tour_rejoin_without_teleport.sql",
  "utf8",
);
const worker = readFileSync("supabase/functions/rejoin-tour-transport/index.ts", "utf8");
const harness = readFileSync("supabase/tests/tour_rejoin_no_teleport_4219.sql", "utf8");

describe("authoritative tour rejoin and no early teleport (#4219)", () => {
  it("does not write profile city from the Edge Function", () => {
    expect(worker).toContain("'schedule_tour_rejoin_atomic'");
    expect(worker).toContain("settlement?.success !== true");
    expect(worker).not.toContain("current_city_id: leg.from_city_id");
    expect(worker).not.toContain("current_city_id: leg.to_city_id");
    expect(worker).not.toContain(".from('player_travel_history').insert");
    expect(worker).not.toContain(".from('player_scheduled_activities').insert");
    expect(worker).toContain("not_in_departure_city");
    expect(worker).toContain("another_journey_active");
    expect(worker).toContain("leg_already_finished");
  });

  it("rejects premature arrival, wrong city, unauthorized bands and overlapping travel", () => {
    expect(sql).toContain("v_arrival<=v_now");
    expect(sql).toContain("v_profile.current_city_id IS DISTINCT FROM v_leg.from_city_id");
    expect(sql).toContain("not_in_departure_city");
    expect(sql).toContain("another_journey_active");
    expect(sql).toContain("not_tour_band_member");
    expect(sql).toContain("p_user_id AND is_active IS TRUE");
    expect(sql).toContain("p_profile_id FOR UPDATE");
    expect(sql).toContain("v_state='in_progress'");
    expect(sql).not.toMatch(/SET\s+current_city_id\s*=/i);
  });

  it("persists history, schedule and timeline in one locked SQL transaction", () => {
    expect(sql).toContain("player_travel_history_profile_leg_unique");
    expect(sql).toContain("player_scheduled_travel_profile_leg_unique");
    expect(sql).toContain("INSERT INTO public.player_travel_history");
    expect(sql).toContain("INSERT INTO public.player_scheduled_activities");
    expect(sql).toContain("INSERT INTO public.travel_timeline_events");
    expect(sql).toContain("v_history.id");
    expect(sql).toContain("v_schedule.id");
    expect(sql).toContain("v_existing");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.schedule_tour_rejoin_atomic");
    expect(sql).toContain("TO service_role");
  });

  it("ships the live rollback test for character location, retries and security", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    for (const check of [
      "wrong_city_rejected", "future_scheduled", "retry_idempotent",
      "one_future_schedule", "one_future_history", "one_rejoin_event",
      "past_leg_rejected", "another_account_rejected",
      "in_progress_leg_started", "no_city_teleport",
      "overlapping_journey_blocked", "browser_denied",
    ]) {
      expect(harness).toContain(check);
    }
  });
});
