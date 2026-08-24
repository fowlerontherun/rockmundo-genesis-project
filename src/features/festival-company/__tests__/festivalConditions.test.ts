import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseFestivalActivityResolution,
  parseFestivalConditions,
} from "../attendance/festivalConditions";

const migration = readFileSync("supabase/migrations/20291218255600_festival_condition_activities.sql", "utf8");
const hubSource = readFileSync("src/features/festival-company/attendance/FestivalModeActivityHub.tsx", "utf8");
const panelSource = readFileSync("src/features/festival-company/attendance/FestivalConditionPanel.tsx", "utf8");

const conditions = {
  attendanceId: "11111111-1111-4111-8111-111111111111",
  festivalEditionId: "22222222-2222-4222-8222-222222222222",
  energy: 76,
  hunger: 32,
  hydration: 75,
  mood: 70,
  intoxication: 0,
  social: 50,
  lastEvolvedAt: "2030-07-01T12:00:00Z",
  lastActivityAt: null,
  serverNow: "2030-07-01T12:05:00Z",
};

const completed = {
  planItemId: "33333333-3333-4333-8333-333333333333",
  attendanceId: "11111111-1111-4111-8111-111111111111",
  activityType: "eat",
  durationMinutes: 60,
  status: "completed",
  before: { energy: 70, hunger: 60, hydration: 55, mood: 65, intoxication: 0, social: 48 },
  effect: { energy: 8, hunger: -48, hydration: 6, mood: 4, intoxication: 0, social: 0 },
  after: { energy: 78, hunger: 12, hydration: 61, mood: 69, intoxication: 0, social: 48 },
  resolvedAt: "2030-07-01T12:10:00Z",
  duplicate: false,
};

describe("Festival condition authority", () => {
  it("stores a temporary one-per-attendee overlay with no browser table grants", () => {
    expect(migration).toContain("CREATE TABLE public.festival_attendee_conditions");
    expect(migration).toContain("attendance_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("UNIQUE (profile_id, festival_edition_id)");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON TABLE public.festival_attendee_conditions FROM PUBLIC, anon, authenticated");
  });

  it("seeds from permanent wellness without requiring the optional hydration column", () => {
    expect(migration).toContain("v_profile_json := to_jsonb(v_profile)");
    expect(migration).toContain("v_profile_json->>'energy'");
    expect(migration).toContain("v_profile_json->>'nutrition'");
    expect(migration).toContain("v_profile_json->>'hydration'");
    expect(migration).toContain("coalesce(nullif(v_profile_json->>'hydration', '')::integer, 75)");
  });

  it("evolves conditions in server-side 30-minute ticks", () => {
    expect(migration).toContain("v_ticks := floor(v_elapsed_minutes / 30.0)::integer");
    expect(migration).toContain("energy - (2 * v_ticks)");
    expect(migration).toContain("hunger + (3 * v_ticks)");
    expect(migration).toContain("hydration - (3 * v_ticks)");
    expect(migration).toContain("intoxication - (4 * v_ticks)");
  });

  it("resolves only Eat, Drink, Explore and Rest during their live block", () => {
    expect(migration).toContain("v_item.activity_type NOT IN ('eat', 'drink', 'explore', 'rest')");
    expect(migration).toContain("festival_activity_not_started");
    expect(migration).toContain("now() >= v_item.ends_at");
    expect(migration).toContain("SET status = 'missed'");
    expect(migration).toContain("SET status = 'completed'");
  });

  it("persists exactly one immutable result per plan item and blocks consumed overlap", () => {
    expect(migration).toContain("plan_item_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("before_state jsonb NOT NULL");
    expect(migration).toContain("after_state jsonb NOT NULL");
    expect(migration).toContain("other.status IN ('planned', 'completed')");
    expect(migration).not.toContain("experience_points");
    expect(migration).not.toContain("action_points");
    expect(migration).not.toContain("finance_debit");
  });
});

describe("Festival condition client contracts", () => {
  it("parses bounded condition state", () => {
    expect(parseFestivalConditions(conditions)).toMatchObject({
      energy: 76,
      hunger: 32,
      hydration: 75,
      intoxication: 0,
    });
    expect(() => parseFestivalConditions({ ...conditions, energy: 101 }))
      .toThrow("malformed_festival_conditions");
  });

  it("parses completed before/effect/after snapshots", () => {
    expect(parseFestivalActivityResolution(completed)).toMatchObject({
      status: "completed",
      activityType: "eat",
      effect: { hunger: -48 },
      after: { hunger: 12 },
    });
  });

  it("accepts authoritative missed results but rejects invented status or activity types", () => {
    expect(parseFestivalActivityResolution({
      planItemId: completed.planItemId,
      attendanceId: completed.attendanceId,
      activityType: "rest",
      durationMinutes: 30,
      status: "missed",
      reason: "activity_window_missed",
      resolvedAt: "2030-07-01T12:30:00Z",
      duplicate: false,
    }).status).toBe("missed");

    expect(() => parseFestivalActivityResolution({ ...completed, status: "rewarded" }))
      .toThrow("malformed_festival_activity_resolution");
    expect(() => parseFestivalActivityResolution({ ...completed, activityType: "watch_act" }))
      .toThrow("malformed_festival_activity_resolution");
  });

  it("exposes temporary condition UI and executable destination buttons", () => {
    expect(panelSource).toContain("Festival condition");
    expect(panelSource).toContain("Intoxication");
    expect(hubSource).toContain("Do now");
    expect(hubSource).toContain("useResolveFestivalPlanActivity");
  });
});
