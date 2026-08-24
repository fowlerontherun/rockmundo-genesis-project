import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20291219040000_festival_organiser_lifecycle_audit.sql",
  "utf8",
);
const lifecycleUi = readFileSync(
  "src/features/festivals/admin/components/FestivalLifecycleControls.tsx",
  "utf8",
);


describe("festival organiser lifecycle B5 database contract", () => {
  it("keeps every edition status mutation inside the canonical transition graph", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public._festival_edition_lifecycle_guard_b5");
    expect(migration).toContain("public.validate_festival_edition_transition(OLD.status,NEW.status)");
    expect(migration).toContain("FESTIVAL_EDITION_INVALID_TRANSITION");
    expect(migration).toContain("newrow:=public.transition_festival_edition");
    expect(migration).not.toContain("UPDATE public.festival_editions SET status=p_target_status");
  });

  it("enforces regional blackout facts server-side and projects them into the existing lifecycle UI", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.festival_regional_blackouts");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.festival_edition_blackout_conflicts");
    expect(migration).toContain("FESTIVAL_BLACKOUT_CONFLICT");
    expect(migration).toContain("set_config('app.festival_blackout_override','on',true)");
    expect(migration).toContain("Regional blackout conflict requires an administrator override and reason.");
    expect(lifecycleUi).toContain("option.blockers");
    expect(lifecycleUi).toContain("option.warnings");
    expect(lifecycleUi).toContain("Use administrator override");
  });

  it("makes organiser actions traceable through one append-only audit stream", () => {
    expect(migration).toContain("festival_admin_audit_manager_read");
    expect(migration).toContain("festival_admin_audit_immutable");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public._festival_record_organiser_audit");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.get_festival_edition_audit_log");
    expect(migration).toContain("edition_'||NEW.to_status::text");
  });

  it("turns postponement and cancellation into authoritative downstream consequences", () => {
    expect(migration).toContain("status='amendment_required'");
    expect(migration).toContain("cancelled_by_side='organiser'");
    expect(migration).toContain("festival_ticket_refund_obligations");
    expect(migration).toContain("reason_code");
    expect(migration).toContain("'festival_cancelled'");
    expect(migration).toContain("'Festival cancelled'");
    expect(migration).toContain("'Festival postponed'");
    expect(migration).toContain("festival_issued_tickets");
  });

  it("enforces application fame, genre, artist type and lineup-size rules on the server", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.festival_artist_application_eligibility");
    expect(migration).toContain("minimum_fame_not_met");
    expect(migration).toContain("maximum_fame_exceeded");
    expect(migration).toContain("genre_excluded");
    expect(migration).toContain("genre_not_eligible_for_window");
    expect(migration).toContain("minimum_band_members_not_met");
    expect(migration).toContain("maximum_band_members_exceeded");
    expect(migration).toContain("festival_artist_not_eligible");
    expect(migration).toContain("'eligibility',eligibility");
  });

  it("atomically converges accepted artist bookings on a canonical contract and stage slot", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.festival_artist_booking_canonical_links");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.finalise_festival_artist_booking_slot");
    expect(migration).toContain("festival_artist_canonical_band_required");
    expect(migration).toContain("FESTIVAL_SLOT_CONFLICT");
    expect(migration).toContain("INSERT INTO public.festival_contracts");
    expect(migration).toContain("INSERT INTO public.festival_contract_versions");
    expect(migration).toContain("canonical_contract_id=contract.id");
    expect(migration).toContain("festival_stage_slot_reservations");
    expect(migration).toContain("idempotency_key text NOT NULL UNIQUE");
  });
});
