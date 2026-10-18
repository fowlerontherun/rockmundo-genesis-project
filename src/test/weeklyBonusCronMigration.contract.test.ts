import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20250918162309_replace_daily_conversion_with_weekly_bonus.sql", import.meta.url),
  "utf8",
);

describe("legacy weekly experience cron migration replay", () => {
  it("uses an independent delimiter inside its outer DO block", () => {
    const start = migration.lastIndexOf("DO $$");
    const end = migration.lastIndexOf("$$;");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = migration.slice(start, end);
    expect(body).toContain("$cron_command$SELECT public.process_weekly_experience_bonus();$cron_command$");
    expect(body).not.toContain("$$SELECT public.process_weekly_experience_bonus()");
    expect(body).toContain("cron.schedule(");
    expect(body).toContain("cron.unschedule(v_job_id)");
  });

  it("does not execute the weekly reward processor during migration setup", () => {
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.process_weekly_experience_bonus() TO service_role");
    const start = migration.lastIndexOf("DO $$");
    const body = migration.slice(start);
    expect(body).not.toContain("PERFORM public.process_weekly_experience_bonus()");
  });
});
