import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialogSource = readFileSync("src/components/songwriting/SongwritingScheduleDialog.tsx", "utf8");
const hookSource = readFileSync("src/hooks/useSongwritingData.tsx", "utf8");
const scheduledSource = readFileSync("src/hooks/useScheduledActivities.ts", "utf8");
const migrationSource = readFileSync("supabase/migrations/20260713143000_authoritative_songwriting_scheduling.sql", "utf8");

const cardSource = readFileSync("src/components/songwriting/SimplifiedProjectCard.tsx", "utf8");
const projectPageSource = readFileSync("src/pages/Songwriting.tsx", "utf8");
const loaderSource = readFileSync("src/lib/songwritingResilientLoader.ts", "utf8");
const factorsMigration = readFileSync("supabase/migrations/20261021065500_songwriting_consistency_polish_progress.sql", "utf8");
const backfillMigration = readFileSync("supabase/migrations/20261021081000_songwriting_factors_legacy_backfill_guard.sql", "utf8");

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

describe("songwriting consistency and polish progression", () => {
  it("passes chosen focus through instant and scheduled sessions", () => {
    expect(cardSource).toContain('onStartSession(sessionFocus)');
    expect(cardSource).toContain('value="arrangement"');
    expect(cardSource).toContain('value="polish"');
    expect(projectPageSource).toContain("sessionType,");
    expect(hookSource).toContain("p_session_type: sessionType");
    expect(dialogSource).toContain("p_session_type: focus");
    expect(scheduledSource).toContain("activity.metadata?.session_type || 'balanced'");
  });

  it("loads and explains actual session awards instead of defaulting to zero", () => {
    expect(loaderSource).toContain("polish_gained, consistency_gained");
    expect(cardSource).toContain("latestFactorSession.polish_gained");
    expect(cardSource).toContain("latestFactorSession.consistency_gained");
  });

  it("stores capped server-side awards and applies quality bonuses once", () => {
    expect(factorsMigration).toContain("BEFORE UPDATE OF sessions_completed");
    expect(factorsMigration).toContain("AND polish_gained IS NULL");
    expect(factorsMigration).toContain("GREATEST(0, 500 - COALESCE(OLD.polish_progress,0))");
    expect(factorsMigration).toContain("v_bonus_polish");
    expect(factorsMigration).toContain("NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'");
  });

  it("prevents direct player edits and preserves historical song quality", () => {
    expect(backfillMigration).toContain("current_user IN ('authenticated','anon')");
    expect(backfillMigration).toContain("SONGWRITING_FACTORS_SERVER_CONTROLLED");
    expect(backfillMigration).toContain("legacy_estimate");
    expect(backfillMigration).not.toContain("UPDATE public.songs ");
  });
});
