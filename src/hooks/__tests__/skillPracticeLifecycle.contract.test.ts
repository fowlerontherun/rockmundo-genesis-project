import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260820142500_skill_practice_lifecycle.sql", "utf8");
const repairMigration = readFileSync("supabase/migrations/20260822063000_repair_skill_practice_booking_runtime.sql", "utf8");
const processor = readFileSync("supabase/functions/process-scheduled-activities/index.ts", "utf8");

describe("authoritative skill-practice lifecycle contract", () => {
  it("books atomically by UTC date and profile", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("a.profile_id=p_profile_id");
    expect(migration).toContain("a.status IN ('scheduled','in_progress','completed')");
    expect(migration).toContain("check_profile_scheduling_conflict");
    expect(migration).toContain("tstzrange(a.scheduled_start, a.scheduled_end, '[)')");
    expect(migration).not.toMatch(/check_scheduling_conflict\s*\(/);
  });

  it("uses the shared training wellness vocabulary and validates unlocked skills", () => {
    expect(migration).toContain("evaluate_wellness_gate(p_profile_id, 'training')");
    expect(migration).toContain("sp.current_level >= 1");
    expect(migration).toContain("skill_definitions");
  });

  it("owns its immutable reward amount and never touches the SXP wallet", () => {
    expect(migration).toContain("v_reward constant integer := 5");
    expect(migration).toContain("UPDATE public.skill_progress");
    expect(migration).toContain("last_practiced_at=timezone('utc',now())");
    expect(migration).not.toContain("UPDATE public.player_xp_wallet");
    expect(migration).not.toContain("progression_spend_skill_xp");
  });

  it("enforces reward idempotency in the database", () => {
    expect(migration).toContain("UNIQUE (activity_id)");
    expect(migration).toContain("UNIQUE (idempotency_key)");
    expect(migration).toContain("'skill-practice:'||p_activity_id");
    expect(migration).toContain("'already_rewarded',true");
  });

  it("allows only the scheduler service to complete practice and retries failures", () => {
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.complete_skill_practice(uuid) TO service_role");
    expect(processor).toContain("case 'skill_practice'");
    expect(processor).toContain("completionError");
    expect(processor).toContain("continue;");
  });

  it("repairs the August runtime without depending on future skill catalogue relations", () => {
    expect(repairMigration).toContain("CREATE OR REPLACE FUNCTION public.schedule_skill_practice");
    expect(repairMigration).toContain("CREATE OR REPLACE FUNCTION public.complete_skill_practice");
    expect(repairMigration).toContain("FROM public.skill_progress sp");
    expect(repairMigration).toContain("to_regclass('public.skill_catalogue_view')");
    expect(repairMigration).not.toContain("FROM public.skill_definitions");
    expect(repairMigration).not.toContain("JOIN public.skill_definitions");
    expect(repairMigration).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it("keeps booking and completion on the same slug metadata contract", () => {
    expect(repairMigration).toContain("'skillSlug', p_skill_slug");
    expect(repairMigration).toContain("'skill_slug', p_skill_slug");
    expect(repairMigration).toContain("v_activity.metadata->>'skillSlug'");
    expect(repairMigration).toContain("v_activity.metadata->>'skill_slug'");
    expect(repairMigration).toContain("CREATE TABLE IF NOT EXISTS public.skill_practice_reward_ledger");
    expect(repairMigration).toContain("CONSTRAINT skill_practice_reward_activity_unique UNIQUE (activity_id)");
  });
});
