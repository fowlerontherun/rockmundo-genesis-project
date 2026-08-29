import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getGigCancellationPlayerError } from "@/hooks/useGigCancellation";

describe("gig cancellation authority boundary", () => {
  const hookSource = readFileSync(
    resolve(process.cwd(), "src/hooks/useGigCancellation.ts"),
    "utf8",
  );
  const databaseSource = readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260829125413_gig_day_rules_and_cancellation.sql"),
    "utf8",
  );

  it("previews and cancels through authoritative RPCs", () => {
    expect(hookSource).toContain('supabase.rpc("preview_gig_cancellation"');
    expect(hookSource).toContain('supabase.rpc("cancel_gig"');
  });

  it("does not directly mutate gigs, bands, finance, or event tables", () => {
    expect(hookSource).not.toMatch(/\.from\(["']gigs["']\)/);
    expect(hookSource).not.toMatch(/\.from\(["']bands["']\)/);
    expect(hookSource).not.toMatch(/\.from\(["']band_earnings["']\)/);
    expect(hookSource).not.toMatch(/\.from\(["']band_fame_events["']\)/);
    expect(hookSource).not.toMatch(/\.from\(["']band_sentiment_events["']\)/);
  });

  it("calculates terms from booking_fee and exact notice hours on the server", () => {
    expect(databaseSource).toContain("v_gig.scheduled_date - p_as_of");
    expect(databaseSource).toContain("COALESCE(v_gig.booking_fee, 0)");
    expect(databaseSource).not.toContain("COALESCE(v_gig.payment");
    expect(databaseSource).toContain("v_notice_hours >= 336");
    expect(databaseSource).toContain("v_notice_hours >= 24");
  });

  it("settles cancellation, penalties, and schedule release in one transaction", () => {
    expect(databaseSource).toContain("FOR UPDATE");
    expect(databaseSource).toContain("gig-cancellation-refund:");
    expect(databaseSource).toContain("status = 'cancelled'");
    expect(databaseSource).toContain("linked_gig_id = v_gig.id");
    expect(databaseSource).toContain("already_cancelled");
  });

  it("gives actionable cancellation errors", () => {
    expect(getGigCancellationPlayerError({ message: "gig_cancellation_not_cancellable" }))
      .toContain("already started");
    expect(getGigCancellationPlayerError({ message: "gig_cancellation_finance_unavailable" }))
      .toContain("Nothing was cancelled");
  });
});
