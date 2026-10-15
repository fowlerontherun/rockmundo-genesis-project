import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20261015124500_recording_refund_claims_and_unique_takes.sql");
const worker = read("supabase/functions/complete-recording-sessions/index.ts");

describe("recording refund and completion five-issue safety contracts", () => {
  it("#4097 requires the booking creator/payer or band leader for band recording cancellation", () => {
    expect(migration).toContain("v_profile_id IS DISTINCT FROM v_payment.profile_id");
    expect(migration).toContain("v_profile_id IS DISTINCT FROM v_booking.profile_id");
    expect(migration).toContain("leader_id=v_profile_id");
    expect(migration).toContain("recording_cancellation_not_authorized");
    expect(migration).toContain("v_booking.scheduled_start <= now()");
    expect(migration).toContain("booking_type='recording' AND booking_id=p_recording_id FOR UPDATE");
  });

  it("#4099 refunds only the original payment currency and never silently converts between treasuries", () => {
    expect(migration).toContain("band_id=v_payment.band_id AND currency_code=v_payment.currency_code");
    expect(migration).toContain("booking_refund_matching_currency_treasury_missing");
    expect(migration).toContain("IF v_treasury.is_primary THEN");
    expect(migration).toContain("p_idempotency_key || ':treasury'");
    expect(migration).toContain("refund_idempotency_key_reused");
  });

  it("#4104 calculates location and rewards from the same booked, noncancelled participants", () => {
    expect(worker).toContain(".eq('linked_recording_id', session.id)");
    expect(worker).toContain(".in('status', ['scheduled', 'in_progress', 'completed'])");
    expect(worker).toContain("const members = bookedParticipants");
    expect(worker).toContain("bookedParticipants.map((booked: any) => ({");
    expect(worker).toContain("profile_id: booked.profile_id");
    expect(worker).toContain("recording_booked_participants_missing");
    expect(worker).not.toContain("const participants = [...resolvedBandMembers, ...soloProfiles]");
  });

  it("#4107 claims before processing and finalizes morale plus session atomically", () => {
    expect(migration).toContain("FROM public.recording_sessions\n    WHERE id=p_session_id FOR UPDATE");
    expect(migration).toContain("completion_claim_expires_at > now()");
    expect(migration).toContain("public.finalize_recording_completion(");
    expect(migration).toContain("v_booking.completion_claim_id IS DISTINCT FROM p_claim_id");
    expect(migration).toContain("status='completed'");
    expect(worker).toContain("'claim_recording_completion'");
    expect(worker).toContain(".eq('completion_claim_id', completionClaimId)");
    expect(worker).toContain("'finalize_recording_completion'");
    expect(worker).toContain("'release_recording_completion'");
    expect(worker).not.toContain("await supabase.from('bands').update({ morale:");
  });

  it("#4114 keeps a separate song per acoustic/remix take, keyed to the originating recording", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS source_recording_session_id uuid");
    expect(migration).toContain("idx_songs_unique_source_recording");
    expect(worker).toContain(".eq('source_recording_session_id', session.id).maybeSingle()");
    expect(worker).toContain("source_recording_session_id: session.id");
    expect(worker).toContain("Take ${session.id.slice(0, 8)}");
    expect(worker).toContain("genre: recordingVersion === 'acoustic' ? 'acoustic' : originalSong.genre");
    expect(worker).not.toContain(".eq('parent_song_id', parentSongId).eq('version', recordingVersion)");
  });

  it("keeps the three worker-only claim functions inaccessible to clients", () => {
    for (const name of [
      "claim_recording_completion",
      "release_recording_completion",
      "finalize_recording_completion",
    ]) expect(migration).toContain("public." + name);
    expect((migration.match(/TO service_role;/g) || []).length).toBe(3);
    expect(migration).toContain("FROM PUBLIC,anon,authenticated");
    expect(migration).toContain("COMMIT;");
  });
});
