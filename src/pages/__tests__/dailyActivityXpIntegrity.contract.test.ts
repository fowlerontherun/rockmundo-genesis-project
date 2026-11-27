import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const migration = readFileSync("supabase/migrations/20261013120000_daily_activity_xp_atomic.sql", "utf8");
const worker = readFileSync("supabase/functions/process-daily-activity-xp/index.ts", "utf8");
const uncappedMigration = readFileSync("supabase/migrations/20261127080833_uncap_daily_activity_xp_and_complete_university_rewards.sql", "utf8");

describe("daily activity XP settlement contracts", () => {
  it("#3873 uses a separate bonus ledger instead of dropped stipend grant columns", () => {
    expect(migration).toContain("profile_activity_xp_bonuses");
    expect(worker).not.toContain('.from("profile_daily_xp_grants")');
  });
  it("#3874 atomically inserts grant before crediting the wallet", () => {
    expect(migration).toContain("ON CONFLICT(profile_id,grant_date) DO NOTHING");
    expect(migration).toContain("IF v_inserted=0 THEN RETURN false");
    expect(migration.indexOf("UPDATE public.player_xp_wallet SET")).toBeGreaterThan(migration.indexOf("IF v_inserted=0 THEN RETURN false"));
  });
  it("#3875 increments wallet balances rather than overwriting stale values", () => {
    expect(migration).toContain("xp_balance=coalesce(xp_balance,0)+p_xp");
    expect(migration).toContain("attribute_points_balance=coalesce(attribute_points_balance,0)+p_ap");
    expect(worker).not.toContain("currentSxpBalance + cappedSxp");
  });
  it("#3876 paginates through the entire dated activity ledger", () => {
    expect(worker).toContain("offset += 500");
    expect(worker).toContain(".range(offset, offset + 499)");
    expect(worker).toContain("if (!page || page.length < 500) break");
  });
  it("pays all earned activity XP, still caps AP, and skips source-paid course XP", () => {
    expect(worker).not.toContain("DAILY_ACTIVITY_XP_CAP");
    expect(worker).toContain("const earnedSxp = summary.totalXp");
    expect(worker).toContain("xp_wallet_credited === true");
    expect(worker).toContain("verifyInternalCronRequest(req, client, corsHeaders)");
    expect(worker).toContain("Math.min(DAILY_ACTIVITY_AP_CAP, summary.totalAp)");
    expect(uncappedMigration).not.toMatch(/p_xp NOT BETWEEN 1 AND 250/);
    expect(uncappedMigration).toContain("xp_awarded >= 0");
    expect(uncappedMigration).toContain("'xp_wallet_credited',true");
  });
});
