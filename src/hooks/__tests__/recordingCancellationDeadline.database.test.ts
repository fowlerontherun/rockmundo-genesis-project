import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// #4098: Finance RPC cutoff is server-authoritative. UI Date checks are not enough.
// Static migration contract; exercise this SQL on staging before deployment.
const migration = readFileSync(
  new URL("../../../supabase/migrations/20261016070000_recording_cancel_wall_clock_cutoff.sql", import.meta.url),
  "utf8",
);
const rpc = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.cancel_recording_session_atomic("));

describe("recording cancellation refund deadline (#4098)", () => {
  it("uses fresh wall time, not the frozen transaction start time", () => {
    expect(rpc).toMatch(
      /IF v_booking\.status='scheduled' AND v_booking\.scheduled_start <= clock_timestamp\(\) THEN\s+RAISE EXCEPTION 'recording_already_started';/,
    );
    expect(rpc).not.toContain("v_booking.scheduled_start <= now()");
  });

  it("checks the cutoff after locking the booking and payment but before crediting a refund", () => {
    const sessionLock = rpc.indexOf("WHERE id=p_recording_id FOR UPDATE");
    const paymentLock = rpc.indexOf("booking_id=p_recording_id FOR UPDATE");
    const cutoff = rpc.indexOf("v_booking.scheduled_start <= clock_timestamp()");
    const refund = rpc.indexOf("v_refund:=public._refund_atomic_booking_payment(");
    expect(sessionLock).toBeGreaterThan(-1);
    expect(paymentLock).toBeGreaterThan(sessionLock);
    expect(cutoff).toBeGreaterThan(paymentLock);
    expect(refund).toBeGreaterThan(cutoff);
  });

  it("retains cancellation authorization, non-cancellable states and replay protections", () => {
    expect(rpc).toContain("public._band_active_member");
    expect(rpc).toContain("recording_cancellation_not_authorized");
    expect(rpc).toContain("v_payment.profile_id IS DISTINCT FROM v_profile_id");
    expect(rpc).toContain("v_booking.status NOT IN ('scheduled','cancelled')");
    // Idempotent retries of an already-cancelled session must not fail the time cutoff.
    expect(rpc).toContain("v_booking.status='scheduled' AND");
    expect(rpc).toContain("'idempotent',v_booking.status='cancelled'");
  });

  it("fails on unreviewed live RPC drift and preserves the authenticated-only grant", () => {
    expect(migration).toContain("pg_get_functiondef('public.cancel_recording_session_atomic(uuid,text,text)'::regprocedure)");
    expect(migration).toContain("b334e7008fb6f56851ed196d04cddf96");
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.cancel_recording_session_atomic\(uuid,text,text\)\s+FROM PUBLIC,anon;/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.cancel_recording_session_atomic\(uuid,text,text\)\s+TO authenticated;/);
  });
});
