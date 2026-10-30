import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261030194500_awards_winner_receipt_notifications.sql",
  "utf8",
);

describe("award winner notification receipts", () => {
  it("issues per-character notifications only for committed award wins", () => {
    expect(sql).toContain("AFTER INSERT ON public.award_wins");
    expect(sql).toContain("INSERT INTO public.notifications");
    expect(sql).toContain("p.user_id, p.id, 'awards', 'success'");
    expect(sql).toContain("bm.member_status='active'");
    expect(sql).toContain("p.deleted_at IS NULL AND p.died_at IS NULL");
    expect(sql).toContain("'/awards'");
    expect(sql).not.toContain("UPDATE public.bands");
    expect(sql).not.toContain("INSERT INTO public.award_wins");
  });

  it("deduplicates retries and limits trigger helper privileges", () => {
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS award_winner_notification_one_per_profile");
    expect(sql).toContain("metadata->>'award_win_id'");
    expect(sql).toContain("ON CONFLICT DO NOTHING");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.notify_award_winner_receipt()");
    expect(sql).toContain("FROM PUBLIC,anon,authenticated");
  });
});
