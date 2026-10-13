import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migration = readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261013120000_daily_activity_xp_atomic.sql", import.meta.url)), "utf8");
const worker = readFileSync(fileURLToPath(new URL("../../../supabase/functions/process-daily-activity-xp/index.ts", import.meta.url)), "utf8");

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
});
