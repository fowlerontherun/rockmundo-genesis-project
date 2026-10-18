import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const load = (path: string) => readFileSync(resolve(process.cwd(),path),"utf8");
const sql = load("supabase/migrations/20261018103200_ai_queue_uncertain_dispatch_recovery.sql");
const worker = load("supabase/functions/process-ai-song-queue/index.ts");
const ui = load("src/components/recording/SongGenerationStatus.tsx");
const status = load("src/hooks/useSongGenerationStatus.ts");

describe("ambiguous paid AI song submissions (#4314)", () => {
  it("quarantines expired dispatches without requeuing or releasing the song reservation", () => {
    expect(sql).toContain("'needs_review'");
    expect(sql).toContain("state='dispatching' and lease_until<now()");
    expect(sql).toContain("state='needs_review',lease_until=null");
    expect(sql).toContain("timeout_at='infinity'::timestamptz");
    expect(sql).toContain("for update skip locked");
    expect(sql).not.toContain("state='queued',lease_until=null");
  });

  it("keeps all maintenance RPCs service-only", () => {
    expect(sql).toContain("from public,anon,authenticated");
    expect(sql).toContain("to service_role;");
    expect(sql).toContain("public.reconcile_expired_ai_song_dispatches()");
    expect(sql).toContain("public.flag_ai_song_dispatch_uncertain(uuid,text)");
  });

  it("scans expired leases before any new submission, even without provider credentials", () => {
    const check = worker.indexOf("reconcile_expired_ai_song_dispatches");
    const providerCheck = worker.indexOf("if (!providerToken)");
    const nextJob = worker.indexOf("claim_ai_song_generation");
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(providerCheck);
    expect(check).toBeLessThan(nextJob);
  });

  it("holds provider timeouts, ambiguous HTTP statuses and lost acknowledgements for review", () => {
    expect(worker).toContain("holdForReview");
    expect(worker).toContain('response.status===429');
    expect(worker).toContain("Provider responded without a prediction ID; no automatic retry");
    expect(worker).toContain("Ambiguous provider response; never automatically resubmit");
    expect(worker).toContain("Provider prediction created but database tracking was not confirmed");
    expect(worker).not.toContain('return await fail("Ambiguous provider response');
  });

  it("tells the player that further paid requests are blocked", () => {
    expect(status).toContain('queueState !== "needs_review"');
    expect(ui).toContain('if (queueState === "needs_review")');
    expect(ui).toContain("will not submit or");
    expect(ui).toContain("another attempt automatically.");
  });
});
