import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chooseActiveBandMembership } from "@/utils/activeBandMembership";

const sql = readFileSync(new URL("../../supabase/migrations/20260820200000_release_finance_stabilisation.sql", import.meta.url), "utf8");

describe("release finance recovery contract", () => {
  it("accepts modern and legacy active membership but rejects former and touring members", () => {
    const bandIds = new Set(["band"]);
    const base = { band_id: "band", joined_at: null };
    expect(chooseActiveBandMembership([{ ...base, profile_id: "profile", user_id: null, member_status: "active", is_touring_member: false }], bandIds, "profile")).not.toBeNull();
    expect(chooseActiveBandMembership([{ ...base, profile_id: null, user_id: "user", member_status: null, is_touring_member: null }], bandIds, "profile")).not.toBeNull();
    expect(chooseActiveBandMembership([{ ...base, profile_id: "profile", user_id: null, member_status: "departed", is_touring_member: false }], bandIds, "profile")).toBeNull();
    expect(chooseActiveBandMembership([{ ...base, profile_id: "profile", user_id: null, member_status: "active", is_touring_member: true }], bandIds, "profile")).toBeNull();
  });

  it("uses one database authorization helper and explicit cost recording", () => {
    expect(sql).toContain("FUNCTION public.is_authorized_band_member");
    expect(sql.match(/is_authorized_band_member\(/g)?.length).toBeGreaterThan(6);
    expect(sql).toContain("DROP TRIGGER IF EXISTS capture_release_format_cost_trigger");
    expect(sql).not.toContain("now()-interval '5 seconds'");
  });

  it("recovers independent historical allocation and retains one revenue-share deal", () => {
    expect(sql).toContain("r.label_contract_id IS NULL THEN rs.net_revenue");
    expect(sql).toContain("revenue_share_enabled=revenue_share_enabled OR p_revenue_share_deal");
    expect(sql).toContain("THEN 10 ELSE revenue_share_percentage");
  });
});
