import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261030180000_authoritative_awards_settlement.sql",
  "utf8",
);
const admin = readFileSync("src/pages/admin/AwardsAdmin.tsx", "utf8");

describe("authoritative awards settlement", () => {
  it("previews only real ballot totals, with explicit unawarded categories", () => {
    expect(migration).toContain("public.award_admin_preview_results");
    expect(migration).toContain("LEFT JOIN public.award_votes v ON v.nomination_id=n.id");
    expect(migration).toContain("coalesce(sum(v.weight),0)");
    expect(migration).toContain("row_number() OVER");
    expect(migration).toContain("'unawarded_categories'");
    expect(migration).toContain("r.ballots > 0 AND r.points > 0");
    expect(migration).toContain("ORDER BY t.points DESC,t.ballots DESC,t.created_at ASC,t.id ASC");
  });

  it("settles once, inside a show lock, using the existing band ledger", () => {
    expect(migration).toContain("public.award_admin_finalize_show");
    expect(migration).toContain("WHERE id=p_show_id FOR UPDATE");
    expect(migration).toContain("IF v_show.status='completed' THEN");
    expect(migration).toContain("SELECT * INTO v_show FROM public.award_shows");
    expect(migration).toContain("INSERT INTO public.award_wins");
    expect(migration).toContain("INSERT INTO public.band_earnings");
    expect(migration).toContain("'award_show_prize'");
    expect(migration).toContain("band_earnings_one_awards_prize_per_win");
    expect(migration).not.toContain("SET band_balance=band_balance+");
    expect(migration).toContain("UPDATE public.award_shows SET status='completed'");
  });

  it("blocks anonymous execution, early settlement and invalid ballots", () => {
    expect(migration).toContain("public.has_role(auth.uid(),'admin')");
    expect(migration).toContain("v_show.ceremony_date <= now()");
    expect(migration).toContain("v_pending=0 AND v_disputed_votes=0 AND v_invalid=0");
    expect(migration).toContain("IF NOT coalesce((v_preview->>'ready')::boolean,false)");
    expect(migration).toContain("v.weight <= 0");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.award_admin_finalize_show(uuid)");
    expect(migration).toContain("FROM PUBLIC,anon,authenticated;");
  });

  it("requires an explicit preview and confirmation; preserves legacy ballots", () => {
    expect(admin).toContain('rpc("award_admin_preview_results"');
    expect(admin).toContain('rpc("award_admin_finalize_show"');
    expect(admin).toContain("checked={confirmPayouts}");
    expect(admin).toContain("!resultPreview.ready || !confirmPayouts");
    expect(admin).toContain("Legacy votes: shortlist to preserve ballots");
    expect(migration).toContain("Cannot reject a nomination with existing ballots");
  });
});
