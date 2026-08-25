import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const c2Migration = readFileSync(
  "supabase/migrations/20291219090000_festival_c2_attendee_lifecycle.sql",
  "utf8",
);
const checkInMigration = readFileSync(
  "supabase/migrations/20291218255000_festival_mode_schedule_lock.sql",
  "utf8",
);
const completionMigration = readFileSync(
  "supabase/migrations/20291218255200_festival_attendee_completion_recovery.sql",
  "utf8",
);
const c1Migration = readFileSync(
  "supabase/migrations/20291219080000_festival_c1_wristband_inventory.sql",
  "utf8",
);
const repositorySource = readFileSync(
  "src/features/festival-company/attendance/festivalAttendanceRepository.ts",
  "utf8",
);

describe("Festival attendee C2 lifecycle authority", () => {
  it("persists ready_to_check_in only after canonical time, location and schedule checks pass", () => {
    expect(c2Migration).toContain("v_target_status := CASE WHEN v_block_reason IS NULL");
    expect(c2Migration).toContain("THEN 'ready_to_check_in'");
    expect(c2Migration).toContain("v_ticket_status <> 'valid'");
    expect(c2Migration).toContain("v_local_date < v_starts_on");
    expect(c2Migration).toContain("v_local_date > v_ends_on");
    expect(c2Migration).toContain("v_is_traveling");
    expect(c2Migration).toContain("v_current_city_id IS DISTINCT FROM v_city_id");
    expect(c2Migration).toContain("_festival_attendee_has_schedule_conflict");
  });

  it("keeps check-in server-authoritative and rejects invalid or wrong-edition admission", () => {
    expect(checkInMigration).toContain("CREATE OR REPLACE FUNCTION public.check_in_to_festival");
    expect(checkInMigration).toContain("SECURITY DEFINER");
    expect(checkInMigration).toContain("IF v_ticket.status <> 'valid'");
    expect(checkInMigration).toContain("v_product_class <> 'admission'");
    expect(checkInMigration).toContain(
      "v_product_edition_id IS DISTINCT FROM v_attendance.festival_edition_id",
    );
    expect(checkInMigration).toContain("v_current_city_id IS DISTINCT FROM v_edition.city_id");
    expect(c2Migration).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON public.festival_player_attendance",
    );
  });

  it("propagates refunds and cancellations and releases only Festival-owned schedule locks", () => {
    expect(c2Migration).toContain("v_ticket_status = 'refunded'");
    expect(c2Migration).toContain("SET status = 'refunded'");
    expect(c2Migration).toContain("v_ticket_status IN ('cancelled', 'transferred')");
    expect(c2Migration).toContain("v_launch_status = 'cancelled_before_event'");
    expect(c2Migration).toContain("v_edition_status = 'cancelled'");
    expect(c2Migration).toContain("SET status = 'cancelled'");
    expect(c2Migration).toContain("activity.activity_type = 'festival_attendance'");
    expect(c2Migration).toContain("festival_lifecycle_close_reason");
    expect(c2Migration).not.toContain("DELETE FROM public.player_scheduled_activities");
  });

  it("retains existing idempotent early-leave and Festival-local completion authorities", () => {
    expect(checkInMigration).toContain("CREATE OR REPLACE FUNCTION public.leave_festival_early");
    expect(checkInMigration).toContain("IF v_attendance.status = 'left_early'");
    expect(checkInMigration).toContain("'alreadyLeft', true");
    expect(completionMigration).toContain("_festival_complete_attendance_if_expired");
    expect(completionMigration).toContain("v_edition.ends_on + 1");
    expect(completionMigration).toContain("SET status = 'completed'");
    expect(completionMigration).toContain("complete_expired_festival_attendance");
  });

  it("audits each actual transition once and does not create duplicate retry events", () => {
    expect(c2Migration).toContain("CREATE TABLE IF NOT EXISTS public.festival_player_attendance_events");
    expect(c2Migration).toContain("UNIQUE (attendance_id, lifecycle_version)");
    expect(c2Migration).toContain("NEW.lifecycle_version := OLD.lifecycle_version + 1");
    expect(c2Migration).toContain("WHEN (OLD.status IS DISTINCT FROM NEW.status)");
    expect(c2Migration).toContain("ON CONFLICT (attendance_id, lifecycle_version) DO NOTHING");
    expect(c2Migration).toContain("REVOKE ALL ON public.festival_player_attendance_events");
  });

  it("pushes ticket, launch and edition terminal changes through the same lifecycle synchronizer", () => {
    expect(c2Migration).toContain("festival_attendance_sync_ticket_lifecycle");
    expect(c2Migration).toContain("festival_attendance_sync_launch_lifecycle");
    expect(c2Migration).toContain("festival_attendance_sync_edition_lifecycle");
    expect(c2Migration.match(/_festival_sync_attendance_lifecycle/g)?.length ?? 0).toBeGreaterThan(5);
  });

  it("refreshes lifecycle state before attendance, eligibility and check-in projections", () => {
    const syncCall = 'attendanceRpc("sync_my_festival_attendance_lifecycle")';
    expect(repositorySource).toContain(syncCall);
    expect(repositorySource.indexOf("await syncMyFestivalAttendanceLifecycle();")).toBeLessThan(
      repositorySource.indexOf('attendanceRpc("reconcile_my_festival_attendance")'),
    );
    expect(repositorySource.indexOf("await syncMyFestivalAttendanceLifecycle();", repositorySource.indexOf("getMyFestivalCheckInEligibility"))).toBeLessThan(
      repositorySource.indexOf('attendanceRpc("get_my_festival_check_in_eligibility")'),
    );
    expect(repositorySource.indexOf("await syncMyFestivalAttendanceLifecycle();", repositorySource.indexOf("checkInToFestival"))).toBeLessThan(
      repositorySource.indexOf('attendanceRpc("check_in_to_festival")'),
    );
  });

  it("preserves C1 admission-issued wristbands instead of re-awarding them at check-in", () => {
    expect(c1Migration).toContain("AFTER INSERT ON public.festival_player_attendance");
    expect(c1Migration).toContain("admission_ticket_id");
    expect(c2Migration).not.toContain("DELETE FROM public.festival_player_memorabilia");
    expect(c2Migration).not.toContain("DROP TRIGGER IF EXISTS festival_attendance_issue_wristband_on_ticket");
  });
});
