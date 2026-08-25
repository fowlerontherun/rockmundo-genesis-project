import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseFestivalDayPlan,
  parseFestivalStageSchedule,
} from "../attendance/festivalDayPlanner";

const foundation = readFileSync("supabase/migrations/20291218255300_festival_day_planner.sql", "utf8");
const hardening = readFileSync("supabase/migrations/20291218255400_harden_festival_day_planner.sql", "utf8");
const conditionMigration = readFileSync("supabase/migrations/20291218255600_festival_condition_activities.sql", "utf8");
const c5Foundation = readFileSync("supabase/migrations/20291219110000_festival_c5_day_planner_foundation.sql", "utf8");
const c5StageBridge = readFileSync("supabase/migrations/20291219110100_festival_c5_stage_schedule_bridge.sql", "utf8");
const c5CommitProjection = readFileSync("supabase/migrations/20291219110200_festival_c5_day_plan_commit_projection.sql", "utf8");
const shellSource = readFileSync("src/features/festival-company/attendance/FestivalModeShell.tsx", "utf8");
const myDaySource = readFileSync("src/features/festival-company/attendance/FestivalModeMyDay.tsx", "utf8");
const stageSource = readFileSync("src/features/festival-company/attendance/FestivalModeStageSchedule.tsx", "utf8");
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
    title: "The Example Band",
    status: "planned",
    resolvedAt: null,
    createdAt: "2030-07-01T10:00:00Z",
    source: "stage_schedule",
    scheduleItemId: "44444444-4444-4444-8444-444444444444",
    stageId: "55555555-5555-4555-8555-555555555555",
    locationKey: "stage:55555555-5555-4555-8555-555555555555",
    locationLabel: "Main Stage",
    travelBeforeMinutes: 10,
    travelAfterMinutes: 15,
  }],
  nextActivity: {
    id: "33333333-3333-4333-8333-333333333333",
    festivalDate: "2030-07-01",
    startsAt: "2030-07-01T12:30:00Z",
    endsAt: "2030-07-01T13:30:00Z",
    durationMinutes: 60,
    activityType: "watch_act",
    title: "The Example Band",
    status: "planned",
    source: "stage_schedule",
    scheduleItemId: "44444444-4444-4444-8444-444444444444",
    stageId: "55555555-5555-4555-8555-555555555555",
    locationKey: "stage:55555555-5555-4555-8555-555555555555",
    locationLabel: "Main Stage",
    travelBeforeMinutes: 10,
    travelAfterMinutes: 15,
  },
  serverNow: "2030-07-01T11:30:00Z",
};

const stageSchedule = {
  attendanceId: "11111111-1111-4111-8111-111111111111",
  festivalEditionId: "22222222-2222-4222-8222-222222222222",
  revisionId: "66666666-6666-4666-8666-666666666666",
  scheduleState: "locked",
  scheduleAvailable: true,
  timezone: "Europe/London",
  days: dayPlan.days,
  items: [{
    id: "44444444-4444-4444-8444-444444444444",
    festivalDate: "2030-07-01",
    startsAt: "2030-07-01T12:30:00Z",
    endsAt: "2030-07-01T13:30:00Z",
    durationMinutes: 60,
    stageId: "55555555-5555-4555-8555-555555555555",
    stageName: "Main Stage",
    artistName: "The Example Band",
    title: "The Example Band",
    locationKey: "stage:55555555-5555-4555-8555-555555555555",
    isPlanned: true,
    plannedItemId: "33333333-3333-4333-8333-333333333333",
  }],
  serverNow: "2030-07-01T11:30:00Z",
};

describe("Festival day planner authority", () => {
  it("keeps the original planner RLS-protected and server-owned", () => {
    expect(foundation).toContain("CREATE TABLE public.festival_attendee_plan_items");
    expect(foundation).toContain("ENABLE ROW LEVEL SECURITY");
    expect(foundation).toContain("REVOKE ALL ON TABLE public.festival_attendee_plan_items FROM PUBLIC, anon, authenticated");
  });

  it("derives the Festival clock from the edition city timezone", () => {
    expect(foundation).toContain("now() AT TIME ZONE v_timezone");
    expect(foundation).toContain("'festivalLocalDate'");
    expect(foundation).toContain("'festivalLocalTime'");
  });

  it("requires the active character to still be attending", () => {
    expect(foundation).toContain("public.current_profile_id()");
    expect(foundation).toContain("attendance.profile_id = v_profile_id");
    expect(foundation).toContain("v_attendance.status <> 'attending'");
  });

  it("preserves replay and per-day serialization from the hardened planner", () => {
    expect(hardening).toContain("':festival-plan:' || p_idempotency_key::text");
    expect(hardening).toContain("':festival-date:' || p_festival_date::text");
    expect(hardening).toContain("festival_plan_idempotency_conflict");
    expect(c5CommitProjection).toContain("':festival-plan:' || p_idempotency_key::text");
    expect(c5CommitProjection).toContain("':festival-date:' || p_festival_date::text");
  });

  it("keeps completed/missed/cancelled history rather than deleting plans", () => {
    expect(hardening).toContain("SET status = 'missed'");
    expect(foundation).toContain("SET status = 'cancelled'");
    expect(conditionMigration).toContain("'planned', 'completed', 'missed', 'cancelled'");
    expect(foundation).not.toContain("DELETE FROM public.festival_attendee_plan_items");
  });
});

describe("Festival C5 day planner and stage timetable", () => {
  it("adds practical planning blocks without inventing another activity authority", () => {
    expect(c5Foundation).toContain("'camping', 'vip', 'vendor', 'free_time'");
    expect(c5Foundation).toContain("source IN ('manual', 'stage_schedule')");
    expect(c5CommitProjection).toContain("festival_plan_watch_act_requires_stage_schedule");
  });

  it("projects only the canonical published or locked public performance timetable", () => {
    expect(c5Foundation).toContain("public.festival_public_legacy_bridges");
    expect(c5StageBridge).toContain("revision.state IN ('published', 'locked')");
    expect(c5StageBridge).toContain("item.item_type = 'performance_slot'");
    expect(c5StageBridge).toContain("item.public_visible = true");
    expect(c5StageBridge).toContain("public.get_my_festival_stage_schedule");
  });

  it("makes travel time part of feasibility rather than display-only advice", () => {
    expect(c5Foundation).toContain("_festival_plan_travel_minutes");
    expect(c5Foundation).toContain("festival_plan_travel_conflict");
    expect(c5Foundation).toContain("v_previous.ends_at + make_interval(mins => v_travel_before) > p_start_at");
    expect(c5Foundation).toContain("p_end_at + make_interval(mins => v_travel_after) > v_next.starts_at");
    expect(c5CommitProjection).toContain("public.preview_festival_day_plan_item");
  });

  it("checks campsite and VIP access from the authoritative admission product", () => {
    expect(c5Foundation).toContain("public.festival_issued_tickets");
    expect(c5Foundation).toContain("public.festival_ticket_products");
    expect(c5Foundation).toContain("festival_plan_camping_not_included");
    expect(c5Foundation).toContain("festival_plan_vip_not_included");
  });

  it("serializes canonical performance commits and prevents duplicate active selections", () => {
    expect(c5Foundation).toContain("festival_attendee_plan_items_active_schedule_uidx");
    expect(c5StageBridge).toContain("':festival-stage-plan:' || p_idempotency_key::text");
    expect(c5StageBridge).toContain("':festival-date:' || v_item.festival_date::text");
    expect(c5StageBridge).toContain("public.preview_festival_stage_plan_item");
  });

  it("does not introduce rewards, finance settlement or social-event authority", () => {
    const c5 = `${c5Foundation}\n${c5StageBridge}\n${c5CommitProjection}`;
    expect(c5).not.toContain("experience_points");
    expect(c5).not.toContain("action_points");
    expect(c5).not.toContain("finance_debit");
    expect(c5).not.toContain("random_events");
  });
});

describe("Festival day planner client", () => {
  it("strictly parses the richer persisted My Day timeline", () => {
    expect(parseFestivalDayPlan(dayPlan)).toMatchObject({
      festivalDayNumber: 1,
      totalFestivalDays: 3,
      timezone: "Europe/London",
      nextActivity: {
        title: "The Example Band",
        locationLabel: "Main Stage",
        travelBeforeMinutes: 10,
      },
    });
  });

  it("strictly parses the canonical stage projection", () => {
    expect(parseFestivalStageSchedule(stageSchedule)).toMatchObject({
      scheduleState: "locked",
      scheduleAvailable: true,
      items: [{ artistName: "The Example Band", isPlanned: true }],
    });
    expect(() => parseFestivalStageSchedule({ ...stageSchedule, scheduleState: "draft" }))
      .toThrow("malformed_festival_stage_schedule");
  });

  it("accepts completed history but rejects invented states and activity types", () => {
    expect(parseFestivalDayPlan({
      ...dayPlan,
      items: [{ ...dayPlan.items[0], status: "completed", resolvedAt: "2030-07-01T12:35:00Z" }],
    }).items[0].status).toBe("completed");
    expect(() => parseFestivalDayPlan({ ...dayPlan, totalFestivalDays: 2 }))
      .toThrow("malformed_festival_day_plan");
    expect(() => parseFestivalDayPlan({
      ...dayPlan,
      items: [{ ...dayPlan.items[0], activityType: "free_xp" }],
    })).toThrow("malformed_festival_day_plan");
    expect(() => parseFestivalDayPlan({
      ...dayPlan,
      items: [{ ...dayPlan.items[0], status: "rewarded" }],
    })).toThrow("malformed_festival_day_plan");
  });

  it("uses RPCs only for planner, timetable, condition and activity reads/writes", () => {
    expect(repositorySource).toContain('plannerRpc("get_my_festival_day_plan"');
    expect(repositorySource).toContain('plannerRpc("preview_festival_day_plan_item"');
    expect(repositorySource).toContain('plannerRpc("create_festival_day_plan_item"');
    expect(repositorySource).toContain('plannerRpc("cancel_festival_day_plan_item"');
    expect(repositorySource).toContain('plannerRpc("get_my_festival_stage_schedule"');
    expect(repositorySource).toContain('plannerRpc("preview_festival_stage_plan_item"');
    expect(repositorySource).toContain('plannerRpc("add_festival_stage_performance_to_day_plan"');
    expect(repositorySource).toContain('plannerRpc("get_my_festival_conditions"');
    expect(repositorySource).toContain('plannerRpc("resolve_festival_plan_activity"');
    expect(repositorySource).not.toContain('.from("festival_attendee_plan_items")');
    expect(repositorySource).not.toContain('.from("festival_schedule_items")');
  });

  it("keeps My Day and the stage timetable fresh during Festival Mode", () => {
    expect(hookSource).toContain("festivalStageScheduleKey");
    expect(hookSource).toContain("refetchInterval: 30_000");
    expect(hookSource).toContain('refetchOnWindowFocus: "always"');
    expect(hookSource).toContain('refetchOnReconnect: "always"');
  });

  it("enables Stages and requires a conflict preview before committing a plan", () => {
    expect(shellSource).toContain('{ id: "stages", label: "Stages", mobileLabel: "Stages" }');
    expect(shellSource).toContain("<FestivalModeStageSchedule attendance={attendance} />");
    expect(stageSource).toContain("Check fit");
    expect(stageSource).toContain("Add performance to My Day");
    expect(stageSource).toContain("walking time");
    expect(myDaySource).toContain("Check plan");
    expect(myDaySource).toContain('value: "camping"');
    expect(myDaySource).toContain('value: "vip"');
    expect(myDaySource).toContain('value: "vendor"');
    expect(myDaySource).toContain('value: "free_time"');
    expect(homeSource).toContain("FestivalConditionPanel");
  });
});
