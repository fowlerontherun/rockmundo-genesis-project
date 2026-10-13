import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261013112500_coma_health_freshness.sql", import.meta.url)), "utf8");
describe("coma health checks", () => {
  it("#3865 marks blocked returning accounts unhealthy", () => {
    expect(sql).toContain("AND v_recent_returners_in_coma = 0");
    expect(sql).toContain("'recent_returners_in_coma', v_recent_returners_in_coma");
  });
  it("#3866 checks the last scheduler run is recent, not merely successful", () => {
    expect(sql).toContain("v_last_cron_started_at >= now() - interval '36 hours'");
    expect(sql).toContain("AND v_scheduler_fresh");
    expect(sql).toContain("'fresh', v_scheduler_fresh");
  });
});
