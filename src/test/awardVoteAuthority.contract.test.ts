import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const voteSql = readFileSync(
  "supabase/migrations/20261019165131_atomic_authoritative_award_voting.sql",
  "utf8",
);
const bandSql = readFileSync(
  "supabase/migrations/20261019165415_permit_authorized_band_award_ballots.sql",
  "utf8",
);
const harness = readFileSync(
  "supabase/tests/award_votes_authority_4237_harness.sql",
  "utf8",
);
const hook = readFileSync("src/hooks/useAwards.ts", "utf8");
const page = readFileSync("src/pages/Awards.tsx", "utf8");

describe("authoritative music-award ballots (#4237)", () => {
  it("revokes ordinary-player direct voting and grants only the authenticated RPC", () => {
    expect(voteSql).toContain("REVOKE INSERT,UPDATE,DELETE ON public.award_votes FROM PUBLIC,anon,authenticated");
    expect(voteSql).toContain("DROP POLICY IF EXISTS \"Players can cast votes\"");
    expect(voteSql).toContain("REVOKE ALL ON FUNCTION public.cast_award_vote");
    expect(voteSql).toContain("TO authenticated");
    expect(voteSql).toContain("auth.uid()");
  });

  it("serializes every show-wide cap check and prevents identity-swap duplicate votes", () => {
    expect(voteSql).toContain("WHERE id=p_show_id FOR UPDATE");
    expect(voteSql).toContain("v.voter_account_id=v_user");
    expect(voteSql).toContain("IF v_count>=3 THEN");
    expect(voteSql).toContain("award_votes_nomination_account_unique");
    expect(voteSql).toContain("ON public.award_votes(nomination_id,voter_account_id)");
    expect(voteSql).toContain("WHERE voter_account_id IS NOT NULL");
  });

  it("does not accept caller-supplied weights or jury/movement role impersonation", () => {
    expect(voteSql).toContain("voter_account_id,weight");
    expect(voteSql).toContain("v_voter_id,v_user,1)");
    expect(voteSql).toContain("p_voter_type='player'");
    expect(voteSql).toContain("p_voter_type='band'");
    expect(voteSql).toContain("Only player or member-band votes are permitted");
    expect(bandSql).toContain("'player','band','npc','jury'");
    expect(page).not.toContain('<SelectItem value="movement"');
  });

  it("requires active owned characters or active band membership and an open ballot", () => {
    expect(voteSql).toContain("p.user_id=v_user");
    expect(voteSql).toContain("p.died_at IS NULL");
    expect(voteSql).toContain("bm.member_status='active'");
    expect(voteSql).toContain("bm.profile_id=p_profile_id");
    expect(voteSql).toContain("v_show.status <> 'voting_open'");
    expect(voteSql).toContain("now()>=v_show.ceremony_date");
    expect(voteSql).toContain("n.status='shortlisted'");
  });

  it("routes frontend votes through the SQL API and reads account-level remaining votes", () => {
    expect(hook).toContain('.rpc("cast_award_vote"');
    expect(hook).toContain("p_profile_id: userId");
    expect(hook).toContain("p_nomination_id: params.nomination_id");
    expect(hook).toContain('.rpc("award_show_account_vote_count"');
    const privacy = readFileSync(
      "supabase/migrations/20261019165720_restrict_award_ballot_account_identifiers.sql",
      "utf8",
    );
    expect(privacy).toContain("REVOKE ALL ON TABLE public.award_votes FROM PUBLIC,anon,authenticated");
    expect(privacy).toContain("GRANT SELECT (id,nomination_id,voter_type,voter_id,weight,created_at)");
    expect(privacy).not.toContain("GRANT SELECT (voter_account_id");
    expect(privacy).toContain("v.voter_account_id=v_user");
    expect(privacy).toContain("GRANT EXECUTE ON FUNCTION public.award_show_account_vote_count(uuid)");

    const cast = hook.slice(hook.indexOf("  // Cast vote"), hook.indexOf("  const respondToInvite"));
    expect(cast).not.toContain('.insert({');
    expect(cast).not.toContain("params.weight");
  });

  it("contains production rollback-only spoof, cap, band and total-counter checks", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    expect(harness).toContain("jury_identity_spoof_allowed");
    expect(harness).toContain("same_nomination_via_band_accepted");
    expect(harness).toContain("fourth_vote_accepted");
    expect(harness).toContain("award_nomination_totals_not_synchronized");
    expect(harness).toContain("closed_ballot_accepted");
  });
});
