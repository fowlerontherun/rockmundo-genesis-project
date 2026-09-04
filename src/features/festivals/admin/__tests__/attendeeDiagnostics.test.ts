import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { attendeeDiagnosticsSchema } from "../service";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/reconciliation/festival/20260904_festival_attendee_admin_diagnostics.sql",
  ),
  "utf8",
);

describe("Festival attendee admin diagnostics", () => {
  it("keeps recovery admin-only, audited, idempotent and version guarded", () => {
    expect(sql).toContain("festival_attendee_repair_audit");
    expect(sql).toContain("UNIQUE(actor_user_id,idempotency_key)");
    expect(sql).toContain("a.lifecycle_version<>p_expected_lifecycle_version");
    expect(sql).toContain("FESTIVAL_ATTENDEE_REPAIR_STALE");
    expect(sql).toContain("FESTIVAL_ATTENDEE_REPAIR_ACTION_MISMATCH");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("p_apply boolean DEFAULT false");
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.admin_repair_festival_attendee",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.admin_repair_festival_attendee",
    );
  });

  it("only exposes explicit one-way repair commands", () => {
    expect(sql).toContain(
      "'sync_lifecycle','complete_expired','repair_attending_evidence','close_terminal_schedule'",
    );
    expect(sql).toContain("_festival_repair_attendance_ticket_used");
    expect(sql).not.toMatch(/SET\s+status\s*=\s*'valid'/i);
    expect(sql).not.toMatch(/SET\s+checked_in_at\s*=/i);
    expect(sql).not.toMatch(
      /DELETE\s+FROM\s+public\.player_scheduled_activities/i,
    );
  });

  it("parses the strict admin response contract", () => {
    const parsed = attendeeDiagnosticsSchema.parse({
      editionId: "edition-1",
      generatedAt: "2026-09-04T06:00:00Z",
      summary: { total: 1, healthy: 0, repairable: 1, blocked: 0 },
      orphanTickets: [],
      rows: [
        {
          attendanceId: "attendance-1",
          editionId: "edition-1",
          profileId: "profile-1",
          ticketId: "ticket-1",
          ticketReference: "FEST-1",
          attendanceStatus: "attending",
          ticketStatus: "valid",
          lifecycleVersion: 3,
          checkedInAt: "2026-09-04T05:00:00Z",
          leftAt: null,
          completedAt: null,
          wristbandCount: 1,
          activeScheduleLocks: 1,
          health: "repairable",
          issues: [
            { code: "attending_ticket_not_used", severity: "repairable" },
          ],
          recommendedRepair: "repair_attending_evidence",
          lastTransition: {
            source: "check_in_to_festival",
            reason: "server_authoritative_check_in",
            at: "2026-09-04T05:00:00Z",
          },
        },
      ],
    });
    expect(parsed.rows[0].lifecycleVersion).toBe(3);
  });
});
