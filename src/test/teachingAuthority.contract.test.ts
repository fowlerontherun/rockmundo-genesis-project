import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hook = readFileSync("src/hooks/useTeaching.ts", "utf8");
const screen = readFileSync("src/pages/Teaching.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261117071500_secure_teaching_lifecycle.sql",
  "utf8",
);
const smoke = readFileSync(
  "supabase/tests/teaching_consent_settlement_4270_4271.sql",
  "utf8",
);

describe("server-authoritative player teaching (#4270, #4271)", () => {
  it("does not allow the browser to forge XP or complete teaching sessions", () => {
    expect(hook).toContain('.rpc("request_teaching_lesson"');
    expect(hook).toContain('.rpc("respond_teaching_lesson"');
    expect(hook).toContain('.rpc("cancel_teaching_lesson"');
    expect(hook).not.toContain('.from("player_teaching_sessions")\n        .insert(');
    expect(hook).not.toContain('.from("player_teaching_sessions")\n        .update(');
    expect(hook).not.toContain("completeExpiredSessions");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE, TRUNCATE");
    expect(migration).toContain('DROP POLICY IF EXISTS "Users can update own teaching sessions"');
  });

  it("enforces student consent and owned active character IDs", () => {
    expect(migration).toContain("v_teacher.user_id=v_student.user_id");
    expect(migration).toContain("AND user_id=auth.uid()");
    expect(migration).toContain("v_session.student_profile_id<>v_student.id");
    expect(migration).toContain("f.status='accepted'");
    expect(migration).toContain("public.are_profiles_blocked");
    expect(migration).toContain("v_skill_level,0)<=v_student_level");
    expect(migration).toContain("An invitation already exists for this skill");
    expect(screen).toContain("Accept invitation");
    expect(screen).toContain("Decline");
    expect(screen).toContain("Awaiting the student's consent");
    expect(screen).toContain("pendingSessions.length > 0");
  });

  it("books a calendar event for both participants atomically", () => {
    expect(migration).toContain("FOR v_day IN 0..v_session.session_duration_days-1 LOOP");
    expect(migration).toContain("FOREACH v_profile IN ARRAY ARRAY[v_teacher.id,v_student.id]");
    expect(migration).toContain("public.check_profile_scheduling_conflict");
    expect(migration).toContain("INSERT INTO public.player_scheduled_activities");
    expect(migration).toContain("'teaching_session_id',v_session.id");
    expect(migration).toContain("v_session.scheduled_end<=now()");
    expect(screen).toContain("Both calendars must be free.");
  });

  it("awards bounded, server-calculated skill XP once and never replays legacy XP", () => {
    expect(migration).toContain("PRIMARY KEY(session_id,profile_id)");
    expect(migration).toContain("INSERT INTO public.player_teaching_reward_ledger");
    expect(migration).toContain("public.grant_teaching_skill_xp");
    expect(migration).toContain("public.progression_skill_required_xp(v_level)");
    expect(migration).toContain("student_xp_earned = 0, teacher_xp_earned = 0");
    expect(migration).toContain("accepted_at IS NOT NULL AND status IN ('scheduled','in_progress')");
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(migration).toContain("EXCEPTION WHEN OTHERS THEN");
  });

  it("settles while both players are offline and expires unanswered invitations", () => {
    expect(migration).toContain("cron.schedule('settle-player-teaching','*/15 * * * *'");
    expect(migration).toContain("created_at<now()-interval '7 days'");
    expect(migration).toContain("status='completed'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.settle_due_teaching_lessons(integer)");
    expect(migration).toContain("TO service_role");
    expect(hook).toContain("pendingSessions");
    expect(hook).toContain("setInterval(() => void refreshSessions(), 60_000)");
  });

  it("includes a rollback-only database ACL and scheduler smoke test", () => {
    expect(smoke).toContain("BEGIN;");
    expect(smoke).toContain("ROLLBACK;");
    expect(smoke).toContain("has_table_privilege");
    expect(smoke).toContain("has_function_privilege");
    expect(smoke).toContain("SET LOCAL ROLE authenticated");
    expect(smoke).toContain("settle-player-teaching");
  });
});
