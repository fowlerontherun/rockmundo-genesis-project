import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFestivalMomentFeed, parseFestivalMomentMutationResult } from "../attendance/festivalMoments";

const migration = readFileSync("supabase/migrations/20260825132000_festival_c7_social_random_events.sql", "utf8");
const accessFix = readFileSync("supabase/migrations/20260825132100_festival_c7_context_ticket_fix.sql", "utf8");
const shell = readFileSync("src/features/festival-company/attendance/FestivalModeShell.tsx", "utf8");
const ui = readFileSync("src/features/festival-company/attendance/FestivalModeMoments.tsx", "utf8");
const repository = readFileSync("src/features/festival-company/attendance/festivalMomentsRepository.ts", "utf8");

const attendanceId = "11111111-1111-4111-8111-111111111111";
const editionId = "22222222-2222-4222-8222-222222222222";
const momentId = "33333333-3333-4333-8333-333333333333";

const feed = {
  attendanceId,
  festivalEditionId: editionId,
  serverNow: "2030-07-01T21:00:00Z",
  items: [{
    id: momentId,
    category: "social",
    title: "You recognise another festival-goer",
    body: "Someone nearby seems to be enjoying the same part of the festival.",
    options: [
      { id: "say_hello", label: "Say hello", description: "Have a friendly chat.", delayMinutes: 0 },
      { id: "give_space", label: "Give them space", description: "Enjoy the shared moment.", delayMinutes: 0 },
    ],
    status: "pending",
    chosenOption: null,
    outcome: null,
    relatedProfileId: "44444444-4444-4444-8444-444444444444",
    availableAt: "2030-07-01T20:55:00Z",
    expiresAt: "2030-07-01T22:55:00Z",
    outcomeDueAt: null,
    resolvedAt: null,
    context: { recentActivity: "free_time", localHour: 21 },
  }],
};

describe("Festival C7 server authority", () => {
  it("stores moments behind RPC authority with replay protection", () => {
    expect(migration).toContain("CREATE TABLE public.festival_attendee_moments");
    expect(migration).toContain("idempotency_key uuid NOT NULL UNIQUE");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON TABLE public.festival_attendee_moments FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("festival_moment_idempotency_conflict");
  });

  it("rate limits generation and prevents stacked unresolved moments", () => {
    expect(migration).toContain("v_recent_count >= 6");
    expect(migration).toContain("interval '90 minutes'");
    expect(migration).toContain("festival_moment_pending");
  });

  it("respects social blocks before selecting another attendee", () => {
    expect(migration).toContain("NOT public.are_profiles_blocked(v_context.profile_id, other.profile_id)");
    expect(migration).not.toContain("INSERT INTO public.friendships");
    expect(migration).not.toContain("UPDATE public.friendships");
  });

  it("uses the canonical C5 admission product chain for camping and VIP access", () => {
    expect(accessFix).toContain("v_attendance.admission_ticket_id");
    expect(accessFix).toContain("ticket.festival_ticket_product_id");
    expect(accessFix).toContain("product.includes_camping");
    expect(accessFix).toContain("product.includes_vip_area");
  });

  it("keeps outcomes bounded to Festival condition state", () => {
    expect(migration).toContain("UPDATE public.festival_attendee_conditions");
    expect(migration).toContain("least(100, greatest(0");
    expect(migration).not.toContain("experience_points");
    expect(migration).not.toContain("action_points");
    expect(migration).not.toContain("finance_debit");
  });

  it("supports delayed outcomes without allowing a second choice", () => {
    expect(migration).toContain("festival_moment_choice_locked");
    expect(migration).toContain("outcome_due_at = now() + make_interval");
    expect(migration).toContain("festival_moment_outcome_not_ready");
  });
});

describe("Festival C7 client", () => {
  it("strictly parses the moment feed", () => {
    expect(parseFestivalMomentFeed(feed)).toMatchObject({ attendanceId, items: [{ category: "social", status: "pending" }] });
    expect(() => parseFestivalMomentFeed({ ...feed, items: [{ ...feed.items[0], category: "unsafe" }] })).toThrow("malformed_festival_moment");
  });

  it("strictly parses mutation responses", () => {
    expect(parseFestivalMomentMutationResult({ id: momentId, status: "choice_made", outcomeDueAt: "2030-07-01T21:30:00Z", duplicate: false })).toMatchObject({ status: "choice_made", duplicate: false });
    expect(() => parseFestivalMomentMutationResult({ id: momentId, status: "rewarded", duplicate: false })).toThrow("malformed_festival_moment_result");
  });

  it("uses RPCs only and exposes the moments player journey", () => {
    expect(repository).toContain('festivalRpc("get_my_festival_moments"');
    expect(repository).toContain('festivalRpc("trigger_my_festival_moment"');
    expect(repository).toContain('festivalRpc("choose_festival_moment_option"');
    expect(repository).toContain('festivalRpc("resolve_festival_moment_outcome"');
    expect(repository).not.toContain('.from("festival_attendee_moments")');
    expect(shell).toContain('{ id: "moments", label: "Moments", mobileLabel: "Moments" }');
    expect(ui).toContain("Find a moment");
    expect(ui).toContain("See what happens");
    expect(ui).toContain("never create friendships automatically");
  });
});
