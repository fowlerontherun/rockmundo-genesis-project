import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const code = readFileSync(resolve(process.cwd(), "supabase/functions/simulate-video-views/index.ts"), "utf8");
const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20261026100500_video_atomic_daily_receipts.sql"), "utf8");
const cron = readFileSync(resolve(process.cwd(), "supabase/migrations/20261026101500_video_daily_bounded_scheduler.sql"), "utf8");

describe("atomic daily music-video simulation", () => {
  it("claims and simulates at most one video per invocation", () => {
    expect(code).toContain('"claim_next_daily_video"');
    expect(code).toContain('.eq("id", claimedVideoId)');
    expect(code).not.toContain('"claim_video_simulation_day"');
    expect(code).toContain('"settle_daily_video"');
    expect(cron).toContain("schedule:='*/10 * * * *'");
  });

  it("is transactional across views, song hype, character payouts and band earnings", () => {
    expect(sql).toContain("PRIMARY KEY (run_date,video_id)");
    expect(sql).toContain("IF v_claim='completed' THEN RETURN false");
    expect(sql).toContain("UPDATE public.music_videos SET");
    expect(sql).toContain("UPDATE public.profiles SET cash");
    expect(sql).toContain("INSERT INTO public.band_earnings(");
    expect(sql).not.toMatch(/UPDATE public\.bands SET[\s\S]*?band_balance\s*=/);
    expect(code).not.toContain('.from("music_videos")\n        .update(');
    expect(code).not.toContain('.from("profiles")\n             .update(');
  });

  it("pays only the recorded song creator character and validates account ownership", () => {
    expect(sql).toContain("WHERE id=v_song.profile_id AND user_id=v_song.user_id");
    expect(sql).toContain("WHERE id=v_song.profile_id;");
    expect(code).not.toContain('.eq("user_id", song.user_id)');
  });

  it("carries fractional dollar royalties to future daily payouts", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.video_royalty_carry");
    expect(sql).toContain("creator_cents=(v_carry_creator+v_creator_cents) % 100");
    expect(sql).toContain("band_cents=(v_carry_band+v_band_cents) % 100");
  });

  it("does not replay legacy days with partial video writes", () => {
    expect(sql).toContain("SELECT 1 FROM public.video_simulation_day_claims WHERE run_date=p_day");
    expect(sql).toContain("RETURN NULL;");
    expect(code).toContain("alreadyProcessed: true");
  });

  it("requires Vault/service-role scheduler authentication and excludes public settlement access", () => {
    expect(code).toContain('req.headers.get("x-cron-secret")');
    expect(code).toContain('"verify_internal_cron_secret"');
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("IF auth.role() <> 'service_role'");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.settle_daily_video");
  });
});
