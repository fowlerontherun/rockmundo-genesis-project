import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const admin = readFileSync("src/pages/admin/AwardsAdmin.tsx", "utf8");
const sql = readFileSync(
  "supabase/migrations/20261030143000_awards_admin_review_and_phase_gates.sql",
  "utf8",
);

describe("awards administration phase controls", () => {
  it("allows only server-authorised shortlist/reject and checks show phase", () => {
    expect(sql).toContain("public.award_admin_review_nomination");
    expect(sql).toContain("public.has_role(auth.uid(),'admin')");
    expect(sql).toContain("v_show_status <> 'nominations_open'");
    expect(sql).toContain("Voted or settled nominations cannot be reviewed");
    expect(admin).toContain('rpc("award_admin_review_nomination"');
    expect(admin).toContain('decision: "shortlisted"');
    expect(admin).toContain('decision: "rejected"');
  });

  it("freezes the ballot at voting and blocks premature completion", () => {
    expect(sql).toContain("Review all pending nominations before voting");
    expect(sql).toContain("At least one shortlist is required before voting");
    expect(sql).toContain("WHEN 'voting_open' THEN 'live'");
    expect(sql).not.toContain("WHEN 'live' THEN 'completed'");
    expect(admin).toContain('rpc("award_admin_advance_show"');
    expect(admin).toContain("No completion until genuine winner settlement exists.");
  });

  it("does not expose these admin RPCs to anonymous callers", () => {
    expect(sql).toContain("FROM PUBLIC,anon,authenticated;");
    expect(sql).toContain("TO authenticated,service_role;");
  });
});
