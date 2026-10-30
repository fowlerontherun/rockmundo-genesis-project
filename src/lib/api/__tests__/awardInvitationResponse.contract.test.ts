import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261030133000_atomic_award_invitation_responses.sql",
  "utf8",
);

describe("awards invite response authority", () => {
  it("locks and settles one performer booking before confirming the invitation", () => {
    expect(migration).toContain("WHERE id=p_invite_id FOR UPDATE");
    expect(migration).toContain("RETURN v_invite; -- Exact retry is a no-op");
    expect(migration).toContain("Invitation has already been answered");
    expect(migration).toContain("INSERT INTO public.award_performance_bookings");
    expect(migration.indexOf("INSERT INTO public.award_performance_bookings"))
      .toBeLessThan(migration.indexOf("SET response_status=p_response"));
    expect(migration).toContain("Performance booking has closed");
  });

  it("does not reopen a settled offer and denies trigger RPC grants", () => {
    expect(migration).toContain("WHERE public.award_show_invites.response_status='pending'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.award_show_respond_invite(uuid,text)");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.guard_award_nomination_submission()");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.award_votes_sync_count()");
    expect(migration).toContain("TO authenticated,service_role");
  });
});
