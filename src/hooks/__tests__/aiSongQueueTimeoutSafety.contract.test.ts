import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const read=(p:string)=>readFileSync(resolve(process.cwd(),p),"utf8");
const queued=read("supabase/migrations/20261018131500_ai_queue_indefinite_pending_timeout.sql");
const submission=read("supabase/migrations/20261018110000_ai_queue_timeout_watchdog_alignment.sql");
const callbacks=read("supabase/migrations/20261018105000_ai_queue_missing_callback_watchdog.sql");
const worker=read("supabase/functions/process-ai-song-queue/index.ts");
describe("queued AI song timeout safety",()=>{
 it("leaves unsubmitted work reserved indefinitely rather than losing a job during outages",()=>{
  expect(queued).toContain("'timeout_at=''infinity''::timestamptz'");
  expect(queued).toContain("q.state='queued'");
  expect(queued).toContain("a.prediction_id is null");
  expect(queued).toContain("a.status='generating'");
  expect(queued).not.toContain("timeout_at=now()+interval ''48 hours''");
 });
 it("keeps submitted jobs bounded and quarantines missing callbacks before generic cleanup",()=>{
  expect(submission).toContain("30 minutes");
  expect(callbacks).toContain("25 minutes");
  expect(callbacks).toContain("state='needs_review'");
  expect(worker).toContain('db.rpc("flag_stale_ai_song_predictions")');
  expect(worker).toContain('db.rpc("reconcile_expired_ai_song_dispatches")');
 });
});
