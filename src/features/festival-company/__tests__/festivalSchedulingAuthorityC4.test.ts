import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const c4Migration = readFileSync(
  "supabase/migrations/20291219100000_festival_c4_schedule_activity_authority.sql",
  "utf8",
);
const c2Migration = readFileSync(
  "supabase/migrations/20291219090000_festival_c2_attendee_lifecycle.sql",
  "utf8",
);
const completionMigration = readFileSync(
  "supabase/migrations/20291218255200_festival_attendee_completion_recovery.sql",
  "utf8",
);
const atomicBookingsMigration = readFileSync(
  "supabase/migrations/20260823183500_finance_a1_atomic_bookings.sql",
  "utf8",
);

describe("Festival attendee C4 scheduling authority", () => {
  it("treats admission-backed pre-check-in state as a real schedule commitment", () => {
    expect(c4Migration).toContain(
      "attendance.status IN ('ticketed', 'ready_to_check_in', 'attending')",
    );
    expect(c4Migration).toContain("edition.starts_on::timestamp AT TIME ZONE");
    expect(c4Migration).toContain("(edition.ends_on + 1)::timestamp AT TIME ZONE");
    expect(c4Migration).toContain("_festival_profile_commitment_conflict");
  });

  it("defines the only schedule overlaps allowed during a festival commitment", () => {
    expect(c4Migration).toContain(
      "WHEN p_activity_type = 'festival_attendance' THEN true",
    );
    expect(c4Migration).toContain(
      "p_activity_type IN ('festival_performance', 'gig')",
    );
    expect(c4Migration).toContain("p_metadata, '{}'::jsonb");
    expect(c4Migration).toContain("festival_edition_id");
    expect(c4Migration).toContain("canonical_edition_id");
  });

  it("blocks new generic schedule rows before Festival Mode check-in", () => {
    expect(c4Migration).toContain(
      "CREATE OR REPLACE FUNCTION public._enforce_festival_attendance_schedule_reservation()",
    );
    expect(c4Migration).toContain(
      "BEFORE INSERT OR UPDATE OF profile_id, activity_type, scheduled_start, scheduled_end, status, metadata",
    );
    expect(c4Migration).toContain("festival_attendance_schedule_locked");
  });

  it("guards rehearsal, recording, gig and travel authoritative domain writes", () => {
    for (const triggerName of [
      "enforce_festival_rehearsal_commitment",
      "enforce_festival_recording_commitment",
      "enforce_festival_gig_commitment",
      "enforce_festival_travel_commitment",
    ]) {
      expect(c4Migration).toContain(triggerName);
    }

    for (const tableName of [
      "public.band_rehearsals",
      "public.recording_sessions",
      "public.gigs",
      "public.player_travel_history",
    ]) {
      expect(c4Migration).toContain(tableName);
    }
  });

  it("checks every active real band member rather than only the booking actor", () => {
    expect(c4Migration).toContain("_festival_band_active_profiles");
    expect(c4Migration).toContain("coalesce(member.member_status, 'active') = 'active'");
    expect(c4Migration).toContain("coalesce(member.is_touring_member, false) = false");
    expect(c4Migration).toContain("profile.id = band.leader_id");
    expect(c4Migration).toContain("profile.user_id = band.leader_id");
  });

  it("makes check-in see authoritative commitments even when a schedule projection is missing", () => {
    expect(c4Migration).toContain("FROM public.band_rehearsals rehearsal");
    expect(c4Migration).toContain("FROM public.recording_sessions session");
    expect(c4Migration).toContain("FROM public.gigs gig");
    expect(c4Migration).toContain("FROM public.player_travel_history travel");
    expect(c4Migration).toContain("FROM public.player_scheduled_activities activity");
    expect(c2Migration).toContain("v_block_reason := 'schedule_conflict'");
  });

  it("fails paid rehearsal and recording bookings inside the same database transaction", () => {
    const rehearsalDebit = atomicBookingsMigration.indexOf(
      "v_payment := public._debit_atomic_booking_payment(\n    p_band_id,\n    v_profile_id,\n    p_payment_source,\n    v_total_cost::bigint * 100,\n    'rehearsal_payment'",
    );
    const rehearsalInsert = atomicBookingsMigration.indexOf(
      "INSERT INTO public.band_rehearsals",
      rehearsalDebit,
    );
    const recordingDebit = atomicBookingsMigration.indexOf(
      "v_payment := public._debit_atomic_booking_payment(\n    p_band_id,\n    v_profile_id,\n    p_payment_source,\n    v_total_cost::bigint * 100,\n    'recording_studio_payment'",
    );
    const recordingInsert = atomicBookingsMigration.indexOf(
      "INSERT INTO public.recording_sessions",
      recordingDebit,
    );

    expect(rehearsalDebit).toBeGreaterThan(-1);
    expect(rehearsalInsert).toBeGreaterThan(rehearsalDebit);
    expect(recordingDebit).toBeGreaterThan(-1);
    expect(recordingInsert).toBeGreaterThan(recordingDebit);
    expect(c4Migration).toContain(
      "BEFORE INSERT OR UPDATE OF band_id, scheduled_start, scheduled_end, status",
    );
    expect(c4Migration).toContain(
      "BEFORE INSERT OR UPDATE OF band_id, profile_id, user_id, scheduled_start, scheduled_end, status",
    );
  });

  it("keeps existing commitments and releases only Festival-owned locks on terminal lifecycle changes", () => {
    expect(c2Migration).toContain("_festival_close_attendance_schedule_lock");
    expect(c2Migration).toContain("festival_lifecycle_close_reason");
    expect(c2Migration).toContain("admission_refunded");
    expect(c2Migration).toContain("festival_cancelled");
    expect(completionMigration).toContain("SET status = 'completed'");
    expect(completionMigration).toContain("activity_type = 'festival_attendance'");
    expect(c4Migration).toContain(
      "Existing rows are not retroactively cancelled",
    );
  });

  it("keeps all internal C4 SECURITY DEFINER helpers off the public API", () => {
    for (const signature of [
      "public._festival_band_active_profiles(uuid)",
      "public._festival_profile_commitment_conflict(uuid, timestamptz, timestamptz, text, jsonb)",
      "public._festival_attendee_has_schedule_conflict(uuid, uuid, timestamptz, timestamptz)",
      "public._enforce_festival_attendance_schedule_reservation()",
      "public._festival_guard_rehearsal_booking()",
      "public._festival_guard_recording_booking()",
      "public._festival_guard_gig_booking()",
      "public._festival_guard_travel_booking()",
    ]) {
      expect(c4Migration).toContain(`REVOKE ALL ON FUNCTION ${signature}`);
    }
    expect(c4Migration).toContain("SET search_path TO ''");
  });
});
