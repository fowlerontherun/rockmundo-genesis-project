import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const foundation = readFileSync(
  "supabase/migrations/20291219040000_festival_organiser_lifecycle_audit.sql",
  "utf8",
);
const hardening = readFileSync(
  "supabase/migrations/20291219040100_festival_organiser_lifecycle_hardening.sql",
  "utf8",
);
const queueFix = readFileSync(
  "supabase/migrations/20291219040200_festival_artist_schedule_queue_fix.sql",
  "utf8",
);
const migration = `${foundation}\n${hardening}\n${queueFix}`;
const lifecycleUi = readFileSync(
  "src/features/festivals/admin/components/FestivalLifecycleControls.tsx",
  "utf8",
);
const scheduleUi = readFileSync(
  "src/features/festivals/scheduling/components/FestivalArtistScheduleFinaliser.tsx",
  "utf8",
);
const scheduleWorkspace = readFileSync(
  "src/features/festivals/scheduling/components/FestivalScheduleWorkspace.tsx",
  "utf8",
);
const auditUi = readFileSync(
  "src/features/festivals/admin/components/FestivalAuditLog.tsx",
  "utf8",
);
const client = readFileSync(
  "src/features/festivals/admin/lifecycleB5.ts",
  "utf8",
);

describe("festival organiser lifecycle B5 database contract", () => {
  it("keeps every edition status mutation inside the canonical transition graph", () => {
    expect(foundation).toContain("CREATE OR REPLACE FUNCTION public._festival_edition_lifecycle_guard_b5");
    expect(foundation).toContain("public.validate_festival_edition_transition(OLD.status,NEW.status)");
    expect(hardening).toContain("public.validate_festival_edition_transition(s,target::public.festival_edition_status)");
    expect(hardening).toContain("WHEN 'live' THEN ARRAY['settling','cancelled','abandoned']");
    expect(hardening).not.toContain("WHEN 'live' THEN ARRAY['settling','completed'");
    expect(hardening).toContain("newrow := public.transition_festival_edition");
    expect(hardening).not.toContain("UPDATE public.festival_editions SET status=p_target_status");
  });

  it("enforces regional blackouts and permits only an explicit admin blackout override", () => {
    expect(foundation).toContain("CREATE TABLE IF NOT EXISTS public.festival_regional_blackouts");
    expect(foundation).toContain("CREATE OR REPLACE FUNCTION public.festival_edition_blackout_conflicts");
    expect(foundation).toContain("FESTIVAL_BLACKOUT_CONFLICT");
    expect(hardening).toContain("FESTIVAL_BLACKOUT_OVERRIDE_NOT_APPLICABLE");
    expect(hardening).toContain("set_config('app.festival_blackout_override','on',true)");
    expect(hardening).toContain("'adminOverrideAllowed',admin AND legal AND blackout_blocks");
    expect(lifecycleUi).toContain("option.available || option.adminOverrideAllowed");
    expect(lifecycleUi).toContain("override && selected?.adminOverrideAllowed");
    expect(lifecycleUi).toContain("Confirm blackout override");
  });

  it("makes organiser actions traceable through one append-only edition audit stream", () => {
    expect(foundation).toContain("festival_admin_audit_manager_read");
    expect(foundation).toContain("festival_admin_audit_immutable");
    expect(foundation).toContain("CREATE OR REPLACE FUNCTION public._festival_record_organiser_audit");
    expect(foundation).toContain("CREATE OR REPLACE FUNCTION public.get_festival_edition_audit_log");
    expect(client).toContain("get_festival_edition_audit_log");
    expect(auditUi).toContain("fetchFestivalEditionAuditLog");
    expect(auditUi).toContain("Refresh canonical audit");
    expect(auditUi).toContain("Before / after evidence");
  });

  it("turns postponement and cancellation into authoritative downstream consequences", () => {
    expect(hardening).toContain("status='amendment_required'");
    expect(hardening).toContain("cancelled_by_side='organiser'");
    expect(hardening).toContain("festival_ticket_refund_obligations");
    expect(hardening).toContain("reason_code");
    expect(hardening).toContain("'festival_cancelled'");
    expect(hardening).toContain("festival_public_editions SET launch_status='cancelled'");
    expect(hardening).toContain("festival_city_calendar_events SET status='cancelled'");
    expect(hardening).toContain("festival_countdowns SET status='cancelled'");
    expect(hardening).toContain("festival_issued_tickets SET status='cancelled'");
    expect(hardening).toContain("'Festival cancelled'");
    expect(hardening).toContain("'Festival postponed'");
  });

  it("enforces application fame, genre, artist type and lineup-size rules on the server", () => {
    expect(foundation).toContain("CREATE OR REPLACE FUNCTION public.festival_artist_application_eligibility");
    expect(foundation).toContain("minimum_fame_not_met");
    expect(foundation).toContain("maximum_fame_exceeded");
    expect(foundation).toContain("genre_excluded");
    expect(foundation).toContain("genre_not_eligible_for_window");
    expect(foundation).toContain("minimum_band_members_not_met");
    expect(foundation).toContain("maximum_band_members_exceeded");
    expect(foundation).toContain("festival_artist_not_eligible");
    expect(foundation).toContain("'eligibility',eligibility");
  });

  it("atomically converges accepted band bookings on a canonical contract and stage slot", () => {
    expect(foundation).toContain("CREATE TABLE IF NOT EXISTS public.festival_artist_booking_canonical_links");
    expect(foundation).toContain("CREATE OR REPLACE FUNCTION public.finalise_festival_artist_booking_slot");
    expect(foundation).toContain("festival_artist_canonical_band_required");
    expect(foundation).toContain("FESTIVAL_SLOT_CONFLICT");
    expect(foundation).toContain("INSERT INTO public.festival_contracts");
    expect(foundation).toContain("INSERT INTO public.festival_contract_versions");
    expect(foundation).toContain("canonical_contract_id=contract.id");
    expect(foundation).toContain("festival_stage_slot_reservations");
    expect(foundation).toContain("idempotency_key text NOT NULL UNIQUE");
    expect(queueFix).toContain("CREATE OR REPLACE FUNCTION public.get_festival_artist_booking_schedule_queue");
    expect(client).toContain("finalise_festival_artist_booking_slot");
    expect(scheduleUi).toContain("Confirm slot");
    expect(scheduleUi).toContain("artist-schedule:${bookingId}:${stageSlotId}");
    expect(scheduleWorkspace).toContain("FestivalArtistScheduleFinaliser");
  });

  it("keeps unsupported solo/NPC bookings visible without fabricating a band contract", () => {
    expect(foundation).toContain("b.artist_type<>'band'");
    expect(queueFix).toContain("'supported',b.artist_type='band' AND b.band_id IS NOT NULL");
    expect(queueFix).toContain("Canonical festival performance contracts currently require a band.");
    expect(scheduleUi).toContain("unsupportedReason");
  });
});
