import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20261019111000_atomic_radio_submission_review.sql","utf8");
const harness = readFileSync("supabase/tests/radio_submission_atomic_review_4243.sql","utf8");
const retired = readFileSync("supabase/functions/process-radio-submissions/index.ts","utf8");
const config = readFileSync("supabase/config.toml","utf8");

describe("Radio submission review is an internal, atomic, due-only operation (#4243)", () => {
  it("retires the old unauthenticated Edge worker", () => {
    expect(retired).toContain("status: 410");
    expect(retired).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(retired).not.toContain("radio_submissions");
    expect(config).toMatch(/\[functions\.process-radio-submissions\]\s*verify_jwt = true/);
  });

  it("keeps the real 30-minute scheduler with no HTTP or stored JWT", () => {
    expect(migration).toContain("cron.alter_job(v_job");
    expect(migration).toContain("SELECT public.process_due_radio_submissions();");
    expect(migration).not.toContain("net.http_post");
    expect(migration).not.toContain("eyJhbGci");
    expect(migration).toContain("*/30 * * * *");
    expect(migration).toContain("allow_manual_trigger=false");
    expect(migration).toContain("is_active=false");
  });

  it("only reviews submissions older than one hour with a locked claim", () => {
    expect(migration).toContain("submitted_at <= now() - interval '1 hour'");
    expect(migration).toContain("FOR UPDATE OF sub SKIP LOCKED");
    expect(migration).toContain("SET status='processing'");
    expect(migration).toContain("AND review_claim_id=v_claim");
    expect(migration).toContain("status='accepted'");
    expect(migration).toContain("status='rejected'");
    expect(migration).toContain("review_claimed_at <");
  });

  it("performs playlist, morale, reputation and review in one rollbackable transaction", () => {
    expect(migration).toContain("INSERT INTO public.radio_playlists");
    expect(migration).toContain("ON CONFLICT (show_id,song_id,week_start_date)");
    expect(migration).toContain("UPDATE public.bands");
    expect(migration).toContain("INSERT INTO public.band_health_events");
    expect(migration).toContain("EXCEPTION WHEN OTHERS THEN");
    expect(migration).toContain("RADIO_REVIEW_FINALIZE_FAILED");
    expect(migration).toContain("v_song.band_id IS DISTINCT FROM v_item.band_id");
  });

  it("denies browsers and anonymous callers access to the privileged batch RPC", () => {
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.process_due_radio_submissions(integer)");
    expect(migration).toContain("FROM PUBLIC,anon,authenticated");
    expect(migration).toContain("TO service_role");
  });

  it("retains a live rollback harness covering early, crash, retry and duplicate award paths", () => {
    expect(harness).toContain("BEGIN;");
    expect(harness).toContain("ROLLBACK;");
    for (const name of [
      "due_only_one_hour","injected_failure_counted","failed_claim_rolled_back",
      "failed_submission_safely_retried","exactly_two_terminal",
      "recent_submission_still_pending","replay_no_extra_playlist",
      "replay_no_extra_morale","replay_no_extra_reputation",
      "browser_worker_denied","live_internal_cron_preserved",
    ]) expect(harness).toContain(name);
  });
});
