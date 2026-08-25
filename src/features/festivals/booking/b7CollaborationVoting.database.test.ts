import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20291219070000_festival_b7_collaboration_voting_closure.sql",
  ),
  "utf8",
);
const client = readFileSync(
  join(
    process.cwd(),
    "src/features/festivals/booking/b7CollaborationVoting.ts",
  ),
  "utf8",
);

describe("B7 festival collaboration and fan-voting authority", () => {
  it("requires explicit accepted obligations for guest and featured performers", () => {
    expect(migration).toContain("festival_performance_collaborations");
    expect(migration).toContain("accepted_obligations jsonb");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.respond_festival_performance_collaborator",
    );
    expect(migration).toContain("status = p_response");
    expect(migration).toContain(
      "accepted_obligations = CASE WHEN p_response = 'accepted' THEN obligations ELSE NULL END",
    );
    expect(migration).toContain("trg_enforce_festival_guest_obligation");
    expect(migration).toContain("festival_guest_obligation_not_accepted");
    expect(migration).toContain("guest_performer_issues");
  });

  it("snapshots accepted collaborators into canonical performance attendance", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.festival_snapshot_expected_performers",
    );
    expect(migration).toContain("festival_performance_attendance");
    expect(migration).toContain("guest_profile_id");
    expect(migration).toContain("collaboration.status = 'accepted'");
  });

  it("resolves rivalries only from canonical final performance outcomes", () => {
    expect(migration).toContain("festival_rivalry_objectives");
    expect(migration).toContain("outperform_overall_score");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.resolve_festival_rivalry_objectives",
    );
    expect(migration).toContain("public.festival_performance_outcomes");
    expect(migration).toContain("challenger_outcome.overall_score");
    expect(migration).toContain("rival_outcome.overall_score");
    expect(migration).not.toContain("p_rivalry_score_modifier");
  });

  it("keeps fan voting advisory behind organiser-approved canonical eligibility", () => {
    expect(migration).toContain("festival_fan_vote_windows");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public._festival_b7_vote_candidate_eligibility",
    );
    expect(migration).toContain("application_row.eligibility_snapshot");
    expect(migration).toContain("slot_row.canonical_contract_id IS NOT NULL");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.cast_festival_fan_vote",
    );
    expect(migration).toContain("'booking_authority', 'none'");
    expect(migration).toContain("'organiser_must_issue_canonical_offer'");
  });

  it("does not expose new authoritative tables for direct authenticated writes", () => {
    expect(migration).toContain(
      "ALTER TABLE public.festival_performance_collaborations ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "ALTER TABLE public.festival_fan_votes ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "REVOKE ALL ON public.festival_performance_collaborations FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "REVOKE ALL ON public.festival_fan_votes FROM PUBLIC, anon, authenticated",
    );
  });

  it("adds lineup/performance notifications and realtime cache invalidation", () => {
    expect(migration).toContain("trg_notify_festival_lineup_change");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.process_festival_performance_reminders",
    );
    expect(migration).toContain("festival_b7_runtime_job");
    expect(client).toContain("useFestivalBookingRealtime");
    expect(client).toContain('"festival_artist_invitations"');
    expect(client).toContain('"festival_contract_setlists"');
    expect(client).toContain('"festival_contracts"');
    expect(client).toContain('"festival_stage_slots"');
  });
});
