import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20260906063000_reconcile_active_university_enrollments.sql",
  ),
  "utf8",
);

describe("active university enrolment reconciliation", () => {
  it("recalculates active schedules from current course and university duration rules", () => {
    expect(migration).toContain("course.base_duration_days");
    expect(migration).toContain("university.quality_of_learning");
    expect(migration).toContain("make_interval(days => recalculated.adjusted_days)");
    expect(migration).toContain("WHERE enrollment.status IN ('enrolled', 'in_progress')");
  });

  it("completes enrolments that have already attended enough days", () => {
    expect(migration).toContain("recalculated.days_attended >= recalculated.adjusted_days");
    expect(migration).toContain("THEN 'completed'::public.enrollment_status");
    expect(migration).toContain("actual_completion_date");
    expect(migration).toContain("auto_attend = CASE");
  });

  it("preserves earned XP and attendance history", () => {
    expect(migration).not.toMatch(/UPDATE\s+public\.player_university_attendance/i);
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.player_university_attendance/i);
    expect(migration).not.toContain("total_xp_earned =");
  });
});
