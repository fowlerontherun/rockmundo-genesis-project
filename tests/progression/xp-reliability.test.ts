import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20261009160000_atomic_university_and_passive_reconcile.sql", "utf8",
);
const worker = readFileSync("supabase/functions/university-attendance/index.ts", "utf8");
const daily = readFileSync(
  "supabase/migrations/20261009111500_daily_passive_skill_growth.sql", "utf8",
);

describe("XP reliability integration contracts", () => {
  it("university worker uses one atomic RPC and no separate reward writes", () => {
    expect(worker).toContain('client.rpc(\n          "record_university_attendance_reward"');
    expect(worker).not.toContain('.from("player_university_attendance")\n          .insert(');
    expect(worker).not.toContain('await awardSkillXp(');
    expect(worker).not.toContain('.from("experience_ledger").insert(');
  });

  it("university reward serializes enrollment and protects duplicate attendance", () => {
    expect(migration).toMatch(/FROM public\.player_university_enrollments\s+WHERE id=p_enrollment_id FOR UPDATE/);
    expect(migration).toContain("reason','already_attended'");
    expect(migration).toContain("INSERT INTO public.player_university_attendance");
    expect(migration).toContain("INSERT INTO public.experience_ledger");
    expect(migration).toContain("UPDATE public.skill_progress");
    expect(migration).toContain("UPDATE public.profiles SET experience=");
  });

  it("only the service role can invoke privileged university grants", () => {
    expect(migration).toContain("FROM PUBLIC,anon,authenticated");
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.record_university_attendance_reward[\s\S]*?TO service_role/);
  });

  it("passive growth is bounded and deduplicated across retries", () => {
    expect(daily).toContain("CONSTRAINT daily_skill_growth_grants_unique UNIQUE (profile_id, skill_slug, grant_date)");
    expect(daily).toContain("ON CONFLICT (profile_id, skill_slug, grant_date) DO NOTHING");
    expect(daily).toContain("FOR UPDATE SKIP LOCKED");
    expect(daily).toContain("v_level >= v_max_level");
    expect(migration).toContain("daily_passive_skill_growth_reconcile");
    expect(migration).toContain("cron.unschedule('daily_passive_skill_growth_reconcile')");
  });
});
