import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFestivalAttendanceReconciliation } from "../attendance/festivalAttendance";

const migration = readFileSync(
  "supabase/migrations/20291218255200_festival_attendee_completion_recovery.sql",
  "utf8",
);
const repositorySource = readFileSync(
  "src/features/festival-company/attendance/festivalAttendanceRepository.ts",
  "utf8",
);
const hookSource = readFileSync(
  "src/features/festival-company/attendance/useFestivalAttendance.ts",
  "utf8",
);

const attendance = {
  id: "11111111-1111-4111-8111-111111111111",
  festivalLaunchId: "22222222-2222-4222-8222-222222222222",
  festivalEditionId: "33333333-3333-4333-8333-333333333333",
  festivalName: "Shock Festival",
  festivalSlug: "shock-festival",
  startsOn: "2030-07-01",
  endsOn: "2030-07-03",
  cityId: "44444444-4444-4444-8444-444444444444",
  admissionTicketId: "55555555-5555-4555-8555-555555555555",
  ticketReference: "SHOCK-2030-001",
  ticketType: "full_festival",
  includesCamping: true,
  includesVipArea: false,
  status: "completed",
  checkedInAt: "2030-07-01T09:00:00Z",
  leftAt: null,
  completedAt: "2030-07-04T00:00:00Z",
  createdAt: "2030-06-01T10:00:00Z",
};

describe("Festival attendee completion authority", () => {
  it("completes attendance after the Festival-local end boundary", () => {
    expect(migration).toContain("_festival_complete_attendance_if_expired");
    expect(migration).toContain("v_edition.ends_on + 1");
    expect(migration).toContain("AT TIME ZONE v_timezone");
    expect(migration).toContain("SET status = 'completed'");
    expect(migration).toContain("completed_at = coalesce(completed_at, v_festival_end_at)");
  });

  it("runs completion independently of a browser session", () => {
    expect(migration).toContain("complete_expired_festival_attendance");
    expect(migration).toContain("cron.schedule");
    expect(migration).toContain("'festival-attendee-completion'");
    expect(migration).toContain("'*/5 * * * *'");
    expect(migration).toContain("SELECT public.complete_expired_festival_attendance();");
  });

  it("keeps ticket recovery one-way and never restores reusable admission", () => {
    expect(migration).toContain("v_ticket.status = 'valid'");
    expect(migration).toContain("SET status = 'used'");
    expect(migration).toContain("RETURN 'attention_required'");
    expect(migration).not.toContain("SET status = 'valid'");
  });

  it("repairs only safe Festival schedule state without cancelling unrelated commitments", () => {
    expect(migration).toContain("_festival_attendee_has_schedule_conflict");
    expect(migration).toContain("RETURN 'schedule_conflict'");
    expect(migration).toContain("activity_type = 'festival_attendance'");
    expect(migration).toContain("festival_recovery_superseded");
    expect(migration).not.toContain("DELETE FROM public.player_scheduled_activities");
  });

  it("reuses one idempotent wristband issuance rule for check-in and recovery", () => {
    expect(migration).toContain("_festival_ensure_attendance_wristband");
    expect(migration).toContain("_festival_issue_wristband_on_attendance");
    expect(migration).toContain("ON CONFLICT DO NOTHING");
    expect(migration).toContain("v_attendance.checked_in_at IS NULL");
  });

  it("limits reconnect reconciliation to the active character", () => {
    expect(migration).toContain("public.current_profile_id()");
    expect(migration).toContain("attendance.profile_id = v_profile_id");
    expect(migration).toContain("reconcile_my_festival_attendance");
  });
});

describe("Festival attendee reconnect contract", () => {
  it("strictly parses authoritative reconciliation counters and attendance", () => {
    expect(parseFestivalAttendanceReconciliation({
      attendance: [attendance],
      completedCount: 1,
      repairedCount: 0,
      attentionCount: 0,
      reconciled: [],
    })).toMatchObject({
      completedCount: 1,
      repairedCount: 0,
      attentionCount: 0,
      attendance: [{ status: "completed" }],
    });
  });

  it("rejects malformed reconciliation payloads", () => {
    expect(() => parseFestivalAttendanceReconciliation({
      attendance: [attendance],
      completedCount: -1,
      repairedCount: 0,
      attentionCount: 0,
    })).toThrow("malformed_festival_attendance_reconciliation");

    expect(() => parseFestivalAttendanceReconciliation({
      attendance: "completed",
      completedCount: 1,
      repairedCount: 0,
      attentionCount: 0,
    })).toThrow("malformed_festival_attendance_reconciliation");
  });

  it("reconciles before returning attendance to Festival Mode", () => {
    expect(repositorySource).toContain('attendanceRpc("reconcile_my_festival_attendance")');
    expect(repositorySource).toContain("parseFestivalAttendanceReconciliation(data).attendance");
  });

  it("refreshes authoritative state after focus, reconnect and during an open Festival session", () => {
    expect(hookSource).toContain('refetchOnWindowFocus: "always"');
    expect(hookSource).toContain('refetchOnReconnect: "always"');
    expect(hookSource).toContain("refetchInterval: 60_000");
    expect(hookSource).toContain("refetchIntervalInBackground: false");
  });
});
