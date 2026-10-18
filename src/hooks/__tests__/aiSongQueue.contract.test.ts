import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read = (path:string) => readFileSync(resolve(process.cwd(),path),"utf8");
const sql = read("supabase/migrations/20261018091000_ai_song_durable_queue.sql");
const schedule = read("supabase/migrations/20261018092500_schedule_ai_song_dispatch.sql");
const worker = read("supabase/functions/process-ai-song-queue/index.ts");
const player = read("supabase/functions/generate-song-audio/index.ts");
const admin = read("supabase/functions/admin-generate-song-audio/index.ts");
const ui = read("src/components/recording/SongGenerationStatus.tsx");
const status = read("src/hooks/useSongGenerationStatus.ts");

describe("global durable AI song queue (#4305)", () => {
  it("routes player and admin requests through the durable queue instead of a paid HTTP POST", () => {
    for(const source of [player, admin]) {
      expect(source).toContain('rpc("enqueue_ai_song_generation"');
      expect(source).toContain('queued:true');
      expect(source).not.toContain("https://api.replicate.com/v1/models/");
      expect(source).toContain("reserve_song_generation_atomic");
    }
  });

  it("limits provider concurrency and avoids a second paid submission after ambiguous errors", () => {
    expect(worker).toContain("claim_ai_song_generation");
    expect(worker).toContain("mark_ai_song_submitted");
    expect(worker).toContain("requeue_ai_song_throttled");
    expect(worker).toContain("response.status===429");
    expect(worker).toContain("Ambiguous provider response; never automatically resubmit");
    expect(worker).toContain("verify_internal_cron_secret");
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain("max_in_flight integer not null default 2");
    expect(sql).toContain("submission_interval_seconds integer not null default 15");
    expect(sql).toContain("if in_flight>=gate.max_in_flight");
    expect(sql).toContain("job.dispatch_count>=4");
  });

  it("keeps queue inaccessible to unauthenticated users and read-only for owners", () => {
    expect(sql).toContain("alter table public.ai_song_generation_queue enable row level security");
    expect(sql).toContain("revoke all on public.ai_song_generation_queue from PUBLIC,anon,authenticated");
    expect(sql).toContain("grant select on public.ai_song_generation_queue to authenticated");
    expect(sql).toContain("((select auth.uid())=user_id)");
    expect(sql).toContain("grant execute on function public.claim_ai_song_generation() to service_role");
  });

  it("runs from a Vault-authenticated minute cron without a stored JWT", () => {
    expect(schedule).toContain("'dispatch-ai-song-queue','* * * * *'");
    expect(schedule).toContain("vault.decrypted_secrets");
    expect(schedule).not.toContain("Bearer eyJ");
  });

  it("does not time out a song before it leaves the queue", () => {
    expect(status).toContain("queueState !== \"queued\"");
    expect(status).toContain("queue.data?.submitted_at");
    expect(ui).toContain("Queued for AI song generation");
    expect(ui).toContain("Waiting for the provider rate-limit cooldown.");
  });
});
