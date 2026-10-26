import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fn = readFileSync("supabase/functions/generate-daily-sales/index.ts", "utf8");
const claimMigration = readFileSync("supabase/migrations/20261026074600_shard_daily_release_sales_by_release.sql", "utf8");
const authMigration = readFileSync("supabase/migrations/20261026074500_repair_daily_record_sales_scheduler.sql", "utf8");

describe("daily record sales recovery (2026-10-26)", () => {
  it("authenticates cron callers from Vault before any work", () => {
    expect(fn).toContain('"verify_internal_cron_secret"');
    expect(fn).toContain('req.headers.get("x-cron-secret")');
    expect(fn).toContain('authenticated !== true');
    expect(fn.indexOf('"verify_internal_cron_secret"')).toBeLessThan(fn.indexOf('"claim_next_daily_release_sale"'));
    expect(authMigration).toContain("vault.decrypted_secrets");
    expect(authMigration).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  });

  it("shards by release and never starts the whole catalog as one job", () => {
    expect(fn).toContain('"claim_next_daily_release_sale"');
    expect(fn).toContain('.eq("id", claimedReleaseId)');
    expect(fn).toContain('"finish_daily_release_sale"');
    expect(claimMigration).toContain("PRIMARY KEY (sale_date,release_id)");
    expect(claimMigration).toContain("FOR UPDATE SKIP LOCKED");
    expect(claimMigration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(claimMigration).toContain("TO service_role");
    expect(claimMigration).toContain("'*/10 * * * *'");
  });

  it("batches per-song fame updates and posts a settlement once per release", () => {
    expect(fn).toContain("const songFameGains = new Map<string, number>()");
    expect(fn).toContain("for (const [songId, fameAmount] of songFameGains)");
    expect(fn).toContain('"credit_band_sales_with_carry"');
    expect(fn).toContain('"credit_label_revenue_atomic"');
    expect(fn.indexOf('p_status: "completed"')).toBeGreaterThan(fn.indexOf('"credit_label_revenue_atomic"'));
  });
});
