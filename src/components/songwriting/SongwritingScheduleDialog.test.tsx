import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialogSource = readFileSync("src/components/songwriting/SongwritingScheduleDialog.tsx", "utf8");
const hookSource = readFileSync("src/hooks/useSongwritingData.tsx", "utf8");
const scheduledSource = readFileSync("src/hooks/useScheduledActivities.ts", "utf8");
const migrationSource = readFileSync("supabase/migrations/20260713143000_authoritative_songwriting_scheduling.sql", "utf8");

describe("authoritative songwriting scheduling flow", () => {
  it("offers only 1, 2, and 4 hour scheduled songwriting durations", () => {
    expect(dialogSource).toContain('<SelectItem value="1">1 hour</SelectItem>');
    expect(dialogSource).toContain('<SelectItem value="2">2 hours</SelectItem>');
    expect(dialogSource).toContain('<SelectItem value="4">4 hours</SelectItem>');
    expect(dialogSource).not.toContain('value="3"');
    expect(dialogSource).not.toContain('value="6"');
  });

  it("uses dedicated songwriting RPCs instead of generic scheduled activity creation", () => {
    expect(dialogSource).toContain('rpc("schedule_songwriting_session"');
    expect(dialogSource).not.toContain("createScheduledActivity");
    expect(hookSource).toContain("rpc('start_songwriting_session'");
    expect(hookSource).toContain("p_idempotency_key");
  });

  it("routes scheduled songwriting starts through the songwriting RPC lifecycle", () => {
    expect(scheduledSource).toContain("activity?.activity_type === 'songwriting'");
    expect(scheduledSource).toContain("p_activity_id: activityId");
    expect(migrationSource).toContain("status IN ('scheduled','in_progress','completed','missed','cancelled')");
  });

  it("repairs required schema drift and enforces supported durations server-side", () => {
    for (const column of ["profile_id", "is_locked", "locked_until", "duration_minutes", "idempotency_key"]) {
      expect(migrationSource).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(migrationSource).toContain("p_effort_hours NOT IN (1,2,4)");
    expect(migrationSource).toContain("schedule_songwriting_session");
  });

  it("preserves project/session/activity links and avoids early project locks for scheduled sessions", () => {
    expect(migrationSource).toContain("'project_id', p_project_id, 'session_id', v_session_id");
    const scheduleFunction = migrationSource.slice(migrationSource.indexOf("CREATE OR REPLACE FUNCTION public.schedule_songwriting_session"));
    expect(scheduleFunction).not.toContain("SET is_locked=true");
  });
});
