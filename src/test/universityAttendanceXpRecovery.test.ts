import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regression for the live 2026-10-10 to 2026-10-20 university XP outage.
const migration = readFileSync(
  "supabase/migrations/20261021123300_fix_university_attendance_enum_and_historical_completion.sql",
  "utf8",
);
const worker = readFileSync("supabase/functions/university-attendance/index.ts", "utf8");

describe("university auto-attendance XP recovery", () => {
  it("casts enrolment status CASE branches to the Postgres enum", () => {
    expect(migration).toContain("'completed'::public.enrollment_status");
    expect(migration).toContain("'in_progress'::public.enrollment_status");
    expect(migration).not.toContain("THEN 'completed' ELSE 'in_progress' END");
  });

  it("does not prematurely complete an expired enrolment on its first backdated day", () => {
    expect(migration).toContain("e.scheduled_end_date <= now()");
    expect(migration).toContain("p_attendance_date >=");
    expect(migration).toContain("AT TIME ZONE COALESCE(");
    expect(migration).toContain("WHERE u.id=e.university_id");
  });

  it("preserves service-only settlement permission and unique per-day ledger semantics", () => {
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("already_attended");
    expect(migration).toContain("ON CONFLICT (profile_id,skill_slug) DO NOTHING");
    expect(migration).toContain("FROM PUBLIC,anon,authenticated");
    expect(migration).toContain("TO service_role");
  });

  it("reports per-enrolment failures as a failed cron run, never success with zero XP", () => {
    expect(worker).toContain("let failedCount = 0;");
    expect(worker).toContain("failedCount += 1;");
    expect(worker).toContain("if (failedCount > 0)");
    expect(worker).toContain("await failJobRun({");
    expect(worker).toContain("errorCount: failedCount");
    expect(worker).toContain("status: 500");
    expect(worker).toContain("errorCount: 0");
    expect(worker).toContain("resultSummary");
  });
});
