import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const funding = source("src/components/gig/GigBookingDialog.tsx");
const booking = source("src/pages/GigBooking.tsx");
const fundedBooking = source("supabase/migrations/20300106200000_atomic_personal_funded_gig_booking.sql");
const gigMigration = source("supabase/migrations/20261008193206_idempotent_gig_consequences.sql");
const dailyReconcile = source("supabase/migrations/20300106201000_controlled_random_event_backlog_reconciliation.sql");
const referral = source("supabase/migrations/20261008214500_referral_claim_boundary.sql");
const liveSongwritingRepair = source("supabase/production-repairs/20261014133000_songwriting_completion_live_schema_repair.sql");

describe("critical production repair contracts", () => {
  it("#4029 gig preview never deposits wallet funds before a booking is confirmed", () => {
    expect(funding).not.toContain("await payment.prepareFunds(");
    expect(funding).toContain("personalTopUpMinor,");
    expect(booking).toContain("rpc('book_gig_with_personal_funding'");
    expect(fundedBooking).toContain("PERFORM public.fund_my_band(");
    expect(fundedBooking).toContain("v_result:=public.book_gig(");
    expect(fundedBooking).not.toMatch(/EXCEPTION WHEN OTHERS/);
    expect(fundedBooking).toContain("SELECT 1 FROM public.gigs WHERE booking_request_id=p_request_id");
  });

  it("#4040 archives whole historical gig claims and does not silently schedule cron", () => {
    expect(gigMigration).toContain("CREATE TABLE IF NOT EXISTS public.gig_processing_claim_history");
    expect(gigMigration).toContain("original_row jsonb NOT NULL");
    expect(gigMigration).toContain("original_checksum text NOT NULL");
    expect(gigMigration).toContain("md5(to_jsonb(d)::text)=a.original_checksum");
    expect(gigMigration).toContain("RAISE EXCEPTION 'Cannot verify archival");
    expect(gigMigration).toContain("BEFORE UPDATE OR DELETE");
    expect(gigMigration).not.toContain("PERFORM cron.schedule(");
  });

  it("#3928 grants each referral milestone prestige to the original rewarded character", () => {
    expect(referral).toContain("rg.beneficiary_profile_id into v_owner_profile_id");
    expect(referral).toContain("rg.idempotency_key=v_idempotency_key");
    expect(referral).toContain("_grant_referral_promoter_prestige(v_owner_profile_id,v_threshold)");
    expect(referral).not.toContain("_grant_referral_promoter_prestige(p_profile_id,v_threshold)");
  });

  it("#4042 preserves live-schema songwriting completion and final-polish RPC definitions", () => {
    expect(liveSongwritingRepair).toContain("CREATE OR REPLACE FUNCTION public.start_songwriting_polish_session(");
    expect(liveSongwritingRepair).toContain("CREATE OR REPLACE FUNCTION public.skip_songwriting_polish(");
    expect(liveSongwritingRepair).toContain("CREATE OR REPLACE FUNCTION public.complete_songwriting_project(");
    expect(liveSongwritingRepair).toContain("FOR UPDATE");
  });

  it("#2598 reconciles old event outcomes only on an explicit service-role call", () => {
    expect(dailyReconcile).toContain("p_apply boolean DEFAULT false");
    expect(dailyReconcile).toContain("IF NOT p_apply THEN");
    expect(dailyReconcile).toContain("FOR UPDATE SKIP LOCKED");
    expect(dailyReconcile).toContain("public.apply_random_event_outcome(v_event.id)");
    expect(dailyReconcile).toContain("REVOKE ALL ON FUNCTION public.apply_random_event_outcome(uuid)");
    expect(dailyReconcile).toContain("TO service_role");
    expect(dailyReconcile).not.toContain("cron.schedule");
  });
});
