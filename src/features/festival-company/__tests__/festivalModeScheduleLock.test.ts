import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scheduleMigration = readFileSync(
  "supabase/migrations/20291218255000_festival_mode_schedule_lock.sql",
  "utf8",
);
const boundaryMigration = readFileSync(
  "supabase/migrations/20291218255100_enforce_festival_schedule_reservation.sql",
  "utf8",
);
const layout = readFileSync("src/components/Layout.tsx", "utf8");
const shell = readFileSync(
  "src/features/festival-company/attendance/FestivalModeShell.tsx",
  "utf8",
);
const home = readFileSync(
  "src/features/festival-company/attendance/FestivalModeHome.tsx",
  "utf8",
);
const contracts = readFileSync(
  "src/features/festival-company/attendance/festivalAttendeeExtras.ts",
  "utf8",
);

describe("Festival Mode shell and schedule authority", () => {
  it("activates the reduced shell from authoritative attending state above desktop/mobile shells", () => {
    expect(layout).toContain("useMyFestivalAttendance");
    expect(layout).toContain('attendance.status === "attending"');
    expect(layout).toContain("<FestivalModeShell attendance={activeFestivalAttendance}>");
    expect(layout.indexOf("if (activeFestivalAttendance)")).toBeLessThan(layout.indexOf("if (isMobile)"));
  });

  it("provides the bounded Festival navigation without exposing unfinished gameplay", () => {
    for (const label of [
      "Festival Home",
      "My Day",
      "Stages",
      "Food & Drink",
      "Activities",
      "Social",
      "Campsite",
      "Festival Map",
      "My Character",
    ]) {
      expect(shell).toContain(`"${label}"`);
    }
    expect(shell).toContain("disabled={index !== 0}");
    expect(shell).toContain("Leave festival");
    expect(home).toContain("normal RockMundo schedule is reserved");
  });

  it("creates one server-owned canonical schedule reservation during check-in", () => {
    expect(scheduleMigration).toContain("schedule_activity_id uuid");
    expect(scheduleMigration).toContain("'festival_attendance'");
    expect(scheduleMigration).toContain("'in_progress'");
    expect(scheduleMigration).toContain("'server_owned', true");
    expect(scheduleMigration).toContain("schedule_activity_id = v_schedule_activity_id");
  });

  it("blocks check-in instead of silently cancelling a conflicting normal commitment", () => {
    expect(scheduleMigration).toContain("_festival_attendee_has_schedule_conflict");
    expect(scheduleMigration).toContain("THEN 'schedule_conflict'");
    expect(scheduleMigration).toContain("RAISE EXCEPTION 'festival_schedule_conflict'");
    expect(contracts).toContain('| "schedule_conflict"');
  });

  it("keeps Festival schedule rows server-owned through RLS", () => {
    expect(scheduleMigration).toContain("activity_type <> 'festival_attendance'");
    expect(scheduleMigration).toContain('DROP POLICY IF EXISTS "Users can update their own scheduled activities"');
    expect(scheduleMigration).toContain('DROP POLICY IF EXISTS "Users can delete their own scheduled activities"');
  });

  it("enforces the reservation at the schedule table boundary", () => {
    expect(boundaryMigration).toContain("BEFORE INSERT OR UPDATE OF");
    expect(boundaryMigration).toContain("festival_attendance_schedule_locked");
    expect(boundaryMigration).toContain("lock.activity_type = 'festival_attendance'");
    expect(boundaryMigration).toContain("NEW.activity_type IN ('festival_performance', 'gig')");
  });

  it("releases the canonical reservation when the attendee leaves early", () => {
    expect(scheduleMigration).toContain("SET status = 'cancelled'");
    expect(scheduleMigration).toContain("'festival_left_early', true");
    expect(scheduleMigration).toContain("v_attendance.schedule_activity_id");
  });
});
