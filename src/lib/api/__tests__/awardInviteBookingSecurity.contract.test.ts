import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261030114500_private_award_invites_and_bookings.sql", "utf8",
);
const hook = readFileSync("src/hooks/useAwards.ts", "utf8");
const page = readFileSync("src/pages/Awards.tsx", "utf8");
const ceremony = readFileSync("src/components/awards/AwardCeremonyExperience.tsx", "utf8");

describe("award invitation privacy and booking authority", () => {
  it("removes both public invitation policies and both arbitrary invitee updates", () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "Award invites are viewable by everyone"');
    expect(sql).toContain('DROP POLICY IF EXISTS "Invites viewable by everyone"');
    expect(sql).toContain('DROP POLICY IF EXISTS "Invitees can respond to invites"');
    expect(sql).toContain('DROP POLICY IF EXISTS "Invitees respond to invites"');
    expect(sql).toContain("public.caller_can_act_for_band(invitee_band_id)");
    expect(sql).toContain("REVOKE SELECT ON public.award_show_invites FROM anon");
  });

  it("requires a server-controlled accepted performer invite to book without admin", () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "Users can book performances"');
    expect(sql).toContain('CREATE POLICY "Award admins can book performances"');
    expect(sql).toContain("public.has_role(auth.uid(), 'admin')");
    expect(hook).not.toContain('.from("award_performance_bookings")\n        .insert(');
    expect(page).not.toContain("bookPerformanceAsync");
    expect(ceremony).not.toContain("Book Performance Slot");
    expect(ceremony).toContain("Performance slots are confirmed through invitations");
  });
});
