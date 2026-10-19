import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const settlement = read("supabase/migrations/20261019072500_atomic_self_promotion_worker.sql");
const privileges = read("supabase/migrations/20261019073500_restrict_self_promotion_client_writes.sql");
const first = read("supabase/functions/process-self-promotion/index.ts");
const retired = read("supabase/functions/complete-self-promotions/index.ts");
const scheduler = read("supabase/functions/process-scheduled-activities/index.ts");
const panel = read("src/components/pr/SelfPromotionPanel.tsx");
const browser = read("src/pages/media/SelfPromotionBrowser.tsx");
const config = read("supabase/config.toml");
const harness = read("supabase/tests/self_promotion_atomic_4250.sql");

describe("Self-promotion atomic worker authorization (#4250)", () => {
  it("only allows trusted callers to settle and never exposes browser write permissions", () => {
    expect(settlement).toContain("REVOKE ALL ON FUNCTION public.settle_self_promotion_atomic(uuid)");
    expect(settlement).toContain("TO service_role");
    expect(settlement).toContain("REVOKE ALL ON FUNCTION public.process_due_self_promotions(integer)");
    expect(privileges).toContain("REVOKE INSERT, UPDATE, DELETE, TRUNCATE");
    expect(privileges).toContain("ON public.self_promotion_activities");
    expect(privileges).toContain("ALTER FUNCTION public.start_self_promotion(uuid,uuid,text,text)");
    expect(privileges).toContain("SECURITY DEFINER");
    expect(privileges).toContain("TO authenticated, service_role");
  });

  it("locks one due activity and makes rewards, event and cooldown one transaction", () => {
    expect(settlement).toMatch(/FROM public\.self_promotion_activities[\s\S]*?FOR UPDATE;/);
    expect(settlement).toContain("v_activity.status IS DISTINCT FROM 'in_progress'");
    expect(settlement).toContain("v_activity.scheduled_end > now()");
    expect(settlement).toContain("v_activity.status = 'completed'");
    expect(settlement).toContain("FROM public.bands WHERE id=v_activity.band_id FOR UPDATE");
    expect(settlement).toContain("CREATE UNIQUE INDEX IF NOT EXISTS band_fame_events_self_promotion_activity_once_idx");
    expect(settlement).toContain("INSERT INTO public.band_fame_events");
    expect(settlement).toContain("INSERT INTO public.self_promotion_cooldowns");
    expect(settlement).toContain("SET status='completed'");
    expect(settlement).toContain("v_fame_gain := ");
    expect(settlement).not.toContain("p_fame_gain");
  });

  it("moves the cron to database-only processing without changing its cadence", () => {
    expect(settlement).toContain("FOR UPDATE SKIP LOCKED");
    expect(settlement).toContain("cron.alter_job(v_id");
    expect(settlement).toContain("SELECT public.process_due_self_promotions();");
    expect(retired).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(retired).toContain("status: 410");
    expect(config).toMatch(/\[functions\.complete-self-promotions\]\s*verify_jwt = true/);
  });

  it("blocks public per-activity processing and ignores no RPC errors", () => {
    expect(first).toContain('authorization !== `Bearer ${serviceKey}`');
    expect(first).toContain("Scheduler authorization required");
    expect(first).toContain('client.rpc("settle_self_promotion_atomic"');
    expect(first).not.toContain('.from("bands")');
    expect(config).toMatch(/\[functions\.process-self-promotion\]\s*verify_jwt = true/);
    expect(scheduler).toContain("'settle_self_promotion_atomic'");
    expect(scheduler).toContain("if (promotionError) throw promotionError");
    expect(scheduler).not.toContain("functions.invoke('process-self-promotion'");
  });

  it("routes both player promotion starts through the existing paid RPC", () => {
    expect(panel).toContain('rpc("start_self_promotion"');
    expect(browser).toContain('rpc("start_self_promotion"');
    expect(panel).not.toContain('.from("self_promotion_activities")\n        .insert(');
    expect(panel).not.toContain('.update({ band_balance:');
    expect(panel).toContain('queryKey: ["self-promotion-character-cash", profileId]');
  });

  it("retains a live rollback harness for idempotency, cutoffs and role isolation", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    expect(harness).toContain("replay_denied");
    expect(harness).toContain("future_denied");
    expect(harness).toContain("one_fame_event");
    expect(harness).toContain("band_rewards_match");
    expect(harness).toContain("forged_client_insert_denied");
    expect(harness).toContain("cron_internal");
  });
});
