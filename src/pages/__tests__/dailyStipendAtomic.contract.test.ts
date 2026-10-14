import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, new URL("../../../", import.meta.url))), "utf8");

const sql = source("supabase/migrations/20261013113000_atomic_daily_stipend.sql");
const code = source("supabase/functions/progression/handlers.ts");

describe("daily stipend production compatibility and integrity", () => {
  it("#3877 writes the actual live grant columns and stipend source", () => {
    expect(sql).toContain("xp_amount, source, attribute_points_amount, metadata");
    expect(sql).toContain("'daily_stipend'");
    expect(sql).not.toContain("xp_awarded");
    expect(sql).toContain("attribute_points_earned = coalesce(attribute_points_earned, 0) + v_ap");
  });

  it("#3878 serializes simultaneous claims and prevents only duplicate stipends", () => {
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS profile_daily_xp_grants_one_stipend_per_day");
    expect(sql).toContain("WHERE source = 'daily_stipend'");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("DAILY_STIPEND_ALREADY_CLAIMED");
    expect(sql).toContain("UPDATE public.player_xp_wallet SET");
    expect(sql).toContain("INSERT INTO public.profile_daily_xp_grants(");
  });

  it("#3879 uses UTC calendar boundaries for consecutive streaks", () => {
    expect(sql).toContain("AT TIME ZONE 'UTC'");
    expect(sql).toContain("last_stipend_claim_date = v_today - 1");
  });

  it("rejects client-controlled SXP, AP, VIP and streak values", () => {
    expect(sql).toContain("claim_daily_stipend_atomic(\n  p_profile_id uuid\n)");
    expect(sql).toContain("FROM public.vip_subscriptions");
    expect(sql).toContain("user_id = v_user_id");
    expect(sql).toContain("least(2000");
    expect(sql).toContain("least(30");
    expect(sql).not.toContain("p_sxp");
    expect(sql).not.toContain("p_ap");
    expect(sql).not.toContain("p_metadata");
    expect(code).toContain('client.rpc("claim_daily_stipend_atomic"');
    expect(code).toContain("p_profile_id: profileId");
    expect(code).not.toContain("p_sxp: totalSxp");
    expect(code).not.toContain("p_ap: totalAp");
    expect(code).not.toContain("rollDailyBaseAp");
  });

  it("restricts stipend grants to living active caller-owned characters", () => {
    expect(sql).toContain("user_id = v_user_id");
    expect(sql).toContain("is_active IS TRUE");
    expect(sql).toContain("died_at IS NULL");
    expect(sql).toContain("deleted_at IS NULL");
    expect(sql).toContain("FROM PUBLIC, anon");
    expect(sql).toContain("TO authenticated");
  });
});
