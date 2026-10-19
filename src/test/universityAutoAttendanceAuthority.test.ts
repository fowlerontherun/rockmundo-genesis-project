import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync("supabase/functions/university-attendance/index.ts", "utf8");
const scheduler = readFileSync("supabase/functions/process-scheduled-activities/index.ts", "utf8");
const browser = readFileSync("src/hooks/useAutoUniversityAttendance.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261019104917_secure_university_auto_attendance_due_and_cron.sql",
  "utf8",
);
const harness = readFileSync(
  "supabase/tests/university_auto_scheduler_and_class_window_harness.sql",
  "utf8",
);

describe("university auto attendance server authority (#4228)", () => {
  it("authenticates the scheduler before reading payload, logging or processing XP", () => {
    expect(worker).toContain('req.method !== "POST"');
    expect(worker).toContain('"x-cron-secret"');
    expect(worker).toContain('"verify_internal_cron_secret"');
    expect(worker).toContain("authorized !== true");
    expect(worker).toContain("status: 401");
    const auth = worker.indexOf('"verify_internal_cron_secret"');
    const parsed = worker.indexOf("await safeJson", auth);
    const logged = worker.indexOf("runId = await startJobRun", auth);
    const enrollment = worker.indexOf('.from("player_university_enrollments")', auth);
    expect(auth).toBeGreaterThan(-1);
    expect(parsed).toBeGreaterThan(auth);
    expect(logged).toBeGreaterThan(parsed);
    expect(enrollment).toBeGreaterThan(logged);
  });

  it("gates each auto-attendance award to the university-local finished class", () => {
    expect(worker).toContain('"university_auto_attendance_due"');
    expect(worker).toContain('if (!due?.due)');
    expect(worker).toContain('const attendanceDate: string = due.attendance_date');
    expect(worker).toContain('"record_university_auto_attendance_reward"');
    expect(worker).not.toContain('client.rpc(\n          "record_university_attendance_reward"');
    expect(migration).toContain("pg_catalog.pg_timezone_names");
    expect(migration).toContain("v_local_day:=(now() AT TIME ZONE v_tz)::date");
    expect(migration).toContain("v_start:=(v_local_day::timestamp");
    expect(migration).toContain("v_end:=(v_local_day::timestamp");
    expect(migration).toContain("IF now()<v_end THEN");
    expect(migration).toContain("PERFORM 1 FROM public.player_university_enrollments");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("public.record_university_attendance_reward(");
    expect(migration).toContain("TO service_role");
    expect(migration).toContain("FROM PUBLIC,anon,authenticated");
  });

  it("uses a Vault-backed hourly cron and preserves the original job identity", () => {
    expect(migration).toContain("'daily-university-attendance','5 * * * *'");
    expect(migration).toContain("vault.decrypted_secrets");
    expect(migration).toContain("'x-cron-secret'");
    expect(migration).toContain("v_new IS DISTINCT FROM v_old");
    expect(migration).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  });

  it("does not let browser or parallel schedule worker run worldwide university XP", () => {
    expect(browser).not.toContain("functions.invoke");
    expect(browser).toContain('invalidateQueries({ queryKey: ["player-skills"] })');
    expect(scheduler).not.toContain("invoke('university-attendance')");
    expect(scheduler).toContain("activity.activity_type === 'university') continue;");
    expect(worker).toContain("new Date(due.class_starts_at)");
    expect(worker).toContain("new Date(due.class_ends_at)");
  });

  it("keeps the old manual session endpoint unaffected", () => {
    expect(migration).not.toContain("CREATE OR REPLACE FUNCTION public.record_university_attendance_reward(");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.record_university_auto_attendance_reward(");
  });

  it("includes rollback-only negative tests and DST expectations", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    expect(harness).toContain("university_local_dst_window_wrong");
    expect(harness).toContain("unknown_enrollment_reward_accepted");
    expect(harness).toContain("early_or_wrong_day_university_auto_award");
  });
});
