import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const path = fileURLToPath(new URL("../supabase/migrations/20250920204838_daily_login_attribute_bonus.sql", import.meta.url));
const sql = readFileSync(path, "utf8");

describe("daily-login pg_cron SQL quotation contract", () => {
  it("uses distinct literal quoting inside the outer PL/pgSQL DO block", () => {
    const start = sql.indexOf("DO $$");
    assert.ok(start >= 0, "cron DO block must exist");
    const inner = sql.slice(start);
    assert.match(inner, /\$cron_sql\$SELECT public\.process_daily_login_attribute_bonus\(\);\$cron_sql\$/);
    assert.doesNotMatch(inner, /\$\$SELECT public\.process_daily_login_attribute_bonus/);
    assert.match(inner, /END;\s*\$\$;/);
  });

  it("retains exactly one service job at 04:00 UTC and unschedules a previous entry", () => {
    assert.match(sql, /WHERE jobname = 'daily_login_attribute_bonus'/);
    assert.match(sql, /PERFORM cron\.unschedule\(v_job_id\)/);
    assert.match(sql, /'daily_login_attribute_bonus',\s*'0 4 \* \* \*'/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.process_daily_login_attribute_bonus\(\) TO service_role/);
  });
});
