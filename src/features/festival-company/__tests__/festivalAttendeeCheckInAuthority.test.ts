import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20291218254500_festival_attendee_checkin_leave.sql",
  "utf8",
);
const repository = readFileSync(
  "src/features/festival-company/attendance/festivalAttendanceRepository.ts",
  "utf8",
);
const hooks = readFileSync(
  "src/features/festival-company/attendance/useFestivalAttendance.ts",
  "utf8",
);
const page = readFileSync(
  "src/features/festival-company/ui/PublicFestivalPage.tsx",
  "utf8",
);

describe("Festival attendee check-in authority", () => {
  it("keeps check-in server authoritative", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.check_in_to_festival");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("v_ticket.status <> 'valid'");
    expect(migration).toContain("v_local_date < v_edition.starts_on");
    expect(migration).toContain("v_local_date > v_edition.ends_on");
    expect(migration).toContain("v_is_traveling");
    expect(migration).toContain("v_current_city_id IS DISTINCT FROM v_edition.city_id");
    expect(migration).toContain("SET status = 'used'");
    expect(migration).toContain("SET status = 'attending'");
  });

  it("does not expose attendee mutations to anonymous callers", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.check_in_to_festival(uuid) FROM PUBLIC, anon;",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.check_in_to_festival(uuid) TO authenticated, service_role;",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.leave_festival_early(uuid) FROM PUBLIC, anon;",
    );
  });

  it("makes check-in and early exit retry-safe", () => {
    expect(migration).toContain("v_attendance.status = 'attending'");
    expect(migration).toContain("'alreadyCheckedIn', true");
    expect(migration).toContain("v_attendance.status = 'left_early'");
    expect(migration).toContain("'alreadyLeft', true");
  });

  it("routes browser actions through the attendee repository and mutation hooks", () => {
    expect(repository).toContain('attendanceRpc("check_in_to_festival"');
    expect(repository).toContain('attendanceRpc("leave_festival_early"');
    expect(hooks).toContain("festivalMemorabiliaKey");
    expect(hooks).toContain("festivalTicketWalletKey");
    expect(page).toContain("Check in to festival");
    expect(page).toContain("Leave festival early");
    expect(page).toContain("window.confirm");
  });
});
