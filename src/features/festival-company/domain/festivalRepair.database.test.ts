// @vitest-environment node
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20261119235427_6704504b-8195-442d-8799-80d6111d0e67.sql", "utf8");
const readinessFunction = migration.match(/CREATE FUNCTION public\._simplified_festival_run_readiness\([\s\S]*?\n\$\$;/)?.[0];

describe("festival final-local-day authority", () => {
  it("blocks new results on the final city day and permits them the following day", async () => {
    if (!readinessFunction) throw new Error("Missing final-day readiness function");
    const db = new PGlite();
    try {
      await db.exec(`CREATE TABLE public.cities(id uuid,timezone text); CREATE TABLE public.festival_editions_v2(id uuid,festival_company_id uuid,city_id uuid,ends_on date);
        CREATE FUNCTION public._simplified_festival_run_readiness_before_final_day_guard(uuid,uuid) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{"alreadyRun":false,"canRun":true,"blockers":[]}''::jsonb';
        INSERT INTO cities VALUES('11111111-1111-4111-8111-111111111111','UTC');
        INSERT INTO festival_editions_v2 VALUES('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',current_date);`);
      await db.exec(readinessFunction);
      const read = async () => (await db.query<{ result: { canRun: boolean; blockers: { code: string }[] } }>("SELECT public._simplified_festival_run_readiness('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222') AS result")).rows[0].result;
      expect((await read()).canRun).toBe(false);
      expect((await read()).blockers[0].code).toBe("festival_final_results_not_due");
      await db.exec("UPDATE festival_editions_v2 SET ends_on=current_date-1");
      expect((await read()).canRun).toBe(true);
      await db.exec("CREATE OR REPLACE FUNCTION public._simplified_festival_run_readiness_before_final_day_guard(uuid,uuid) RETURNS jsonb LANGUAGE sql AS 'SELECT ''{\"alreadyRun\":true,\"canRun\":true,\"blockers\":[]}''::jsonb'; UPDATE festival_editions_v2 SET ends_on=current_date+1;");
      expect((await read()).canRun).toBe(true);
    } finally { await db.close(); }
  });
});