import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFestivalDayPlan } from "../attendance/festivalDayPlanner";

const foundation = readFileSync("supabase/migrations/20291218255300_festival_day_planner.sql", "utf8");
const hardening = readFileSync("supabase/migrations/20291218255400_harden_festival_day_planner.sql", "utf8");
const shellSource = readFileSync("src/features/festival-company/attendance/FestivalModeShell.tsx", "utf8");
const myDaySource = readFileSync("src/features/festival-company/attendance/FestivalModeMyDay.tsx", "utf8");
const homeSource = readFileSync("src/features/festival-company/attendance/FestivalModeHome.tsx", "utf8");
const hookSource = readFileSync("src/features/festival-company/attendance/useFestivalDayPlanner.ts", "utf8");
const repositorySource = readFileSync("src/features/festival-company/attendance/festivalDayPlannerRepository.ts", "utf8");

const dayPlan = {
  attendanceId: "11111111-1111-4111-8111-111111111111",
  festivalEditionId: "22222222-2222-4222-8222-222222222222",
  festivalName: "Shock Festival",
  startsOn: "2030-07-01",
  endsOn: "2030-07-03",
  timezone: "Europe/London",
  cityName: "London",
  festivalLocalDate: "2030-07-01",
  festivalLocalTime: "12:30:00",
  festivalLocalDateTime: "2030-07-01T12:30:00",
  festivalDayNumber: 1,
  totalFestivalDays: 3,
  days: [
    { date: "2030-07-01", dayNumber: 1 },
    { date: "2030-07-02", dayNumber: 2 },
    { date: "2030-07-03", dayNumber: 3 },
  ],
  items: [{
    id: "33333333-3333-4333-8333-333333333333",
    attendanceId: "11111111-1111-4111-8111-111111111111",
    festivalEditionId: "22222222-2222-4222-8222-222222222222",
    festivalDate: "2030-07-01",
    startsAt: "2030-07-01T12:30:00Z",
    endsAt: "2030-07-01T13:30:00Z",
    durationMinutes: 60,
    activityType: "watch_act",
    title: "Main Stage",
    status: "planned",
    resolvedAt: null,
    createdAt: "2030-07-01T10:00:00Z",
  }],
  nextActivity: {
    id: "33333333-3333-4333-8333-333333333333",
    festivalDate: "2030-07-01",
    startsAt: "2030-07-01T12:30:00Z",
    endsAt: "2030-07-01T13:30:00Z",
    durationMinutes: 60,
    activityType: "watch_act",
    title: "Main Stage",
    status: "planned",
  },
  serverNow: "2030-07-01T11:30:00Z",
};

describe("Festival day planner authority", () => {
  it("stores planning intent in an RLS-protected server-owned table", () => {
    expect(foundation).toContain("CREATE TABLE public.festival_attendee_plan_items");
    expect(foundation).toContain("ENABLE ROW LEVEL SECURITY");
    expect(foundation).toContain("REVOKE ALL ON TABLE public.festival_attendee_plan_items FROM PUBLIC, anon, authenticated");
    expect(foundation).toContain("duration_minutes IN (30, 60, 90)");
    expect(foundation).toContain("'watch_act', 'eat', 'drink', 'explore', 'rest'");
  });

  it("derives the Festival clock from the edition city timezone", () => {
    expect(foundation).toContain("now() AT TIME ZONE v_timezone");
    expect(foundation).toContain("'festivalLocalDate'");
    expect(foundation).toContain("'festivalLocalTime'");
    expect(foundation).toContain("'festivalDayNumber'");
    expect(foundation).toContain("'totalFestivalDays'");
  });

  it("requires the active character to still be attending", () => {
    expect(foundation).toContain("public.current_profile_id()");
    expect(foundation).toContain("attendance.profile_id = v_profile_id");
    expect(foundation).toContain("v_attendance.status <> 'attending'");
  });

  it("rejects invalid, past, cross-day and overlapping blocks", () => {
    expect(hardening).toContain("festival_plan_start_grid_invalid");
    expect(hardening).toContain("festival_plan_start_in_past");
    expect(hardening).toContain("festival_plan_crosses_day_boundary");
    expect(hardening).toContain("festival_plan_date_outside_event");
    expect(hardening).toContain("festival_plan_overlap");
    expect(hardening).toContain("tstzrange(item.starts_at, item.ends_at, '[)')");
  });

  it("serialises retries and overlap checks separately", () => {
    expect(hardening).toContain("':festival-plan:' || p_idempotency_key::text");
    expect(hardening).toContain("':festival-date:' || p_festival_date::text");
    expect(hardening).toContain("v_existing.starts_at <> v_start_at");
    expect(hardening).toContain("festival_plan_idempotency_conflict");
  });

  it("marks expired unresolved blocks missed and preserves cancelled history", () => {
    expect(hardening).toContain("SET status = 'missed'");
    expect(foundation).toContain("SET status = 'cancelled'");
    expect(foundation).not.toContain("DELETE FROM public.festival_attendee_plan_items");
  });

  it("does not add reward, finance or condition authority in the planner migration", () => {
    expect(foundation).not.toContain("experience_points");
    expect(foundation).not.toContain("action_points");
    expect(foundation).not.toContain("finance_debit");
    expect(foundation).not.toContain("hydration");
    expect(foundation).not.toContain("intoxication");
  });
});

describe("Festival day planner client", () => {
  it("strictly parses the server clock and multi-day timeline", () => {
    expect(parseFestivalDayPlan(dayPlan)).toMatchObject({
      festivalDayNumber: 1,
      totalFestivalDays: 3,
      timezone: "Europe/London",
      nextActivity: { title: "Main Stage" },
    });
  });

  it("rejects malformed day counts and unsupported activity types", () => {
    expect(() => parseFestivalDayPlan({ ...dayPlan, totalFestivalDays: 2 }))
      .toThrow("malformed_festival_day_plan");
    expect(() => parseFestivalDayPlan({
      ...dayPlan,
      items: [{ ...dayPlan.items[0], activityType: "free_xp" }],
    })).toThrow("malformed_festival_day_plan");
  });

  it("uses only RPCs for planner reads and writes", () => {
    expect(repositorySource).toContain('plannerRpc("get_my_festival_day_plan"');
    expect(repositorySource).toContain('plannerRpc("create_festival_day_plan_item"');
    expect(repositorySource).toContain('plannerRpc("cancel_festival_day_plan_item"');
    expect(repositorySource).not.toContain('.from("festival_attendee_plan_items")');
  });

  it("keeps server clock/missed state fresh during Festival Mode", () => {
    expect(hookSource).toContain("refetchInterval: 30_000");
    expect(hookSource).toContain('refetchOnWindowFocus: "always"');
    expect(hookSource).toContain('refetchOnReconnect: "always"');
  });

  it("enables My Day while keeping later gameplay areas disabled", () => {
    expect(shellSource).toContain('{ id: "my-day", label: "My Day", enabled: true }');
    expect(shellSource).toContain('{ id: "stages", label: "Stages", enabled: false }');
    expect(shellSource).toContain("<FestivalModeMyDay attendance={attendance} />");
    expect(myDaySource).toContain("30 minutes");
    expect(myDaySource).toContain("60 minutes");
    expect(myDaySource).toContain("90 minutes");
    expect(myDaySource).toContain("Activity outcomes, spending, condition effects and rewards are added in later Festival phases");
    expect(homeSource).toContain("Next plan");
    expect(homeSource).toContain("festivalLocalTime");
  });
});
