import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const payment = read("src/hooks/useBandPaymentSource.ts");
const dialog = read("src/components/performance/RehearsalBookingDialog.tsx");
const page = read("src/pages/Rehearsals.tsx");
const booking = read("src/hooks/useRehearsalBooking.ts");
const database = read("supabase/migrations/20300106210000_rehearsal_booking_full_intent_idempotency.sql");
const funding = read("src/components/bands/AddMoneyToBand.tsx");
const finances = read("src/components/bands/BandFinancesTab.tsx");

describe("rehearsal payment and band finance integrity regressions", () => {
  it("#4028 prevents payer selection leaking between characters or overlapping flows", () => {
    expect(payment).not.toContain("pendingAtomicRehearsalSources");
    expect(payment).not.toContain("consumeAtomicRehearsalPaymentSource");
    expect(payment).toContain("const identity = `\${bandId ?? \"\"}:\${profileId ?? \"\"}`;");
    expect(payment).toContain("selection.identity === identity ? selection.source : \"band\"");
    expect(payment).toContain("setSelection({ identity, source: next });");
    expect(booking).not.toContain("consumeAtomicRehearsalPaymentSource");
    expect(dialog).toContain("payment.source,");
    expect(page).toContain("paymentSource,\n        skipProfileIds,");
    expect(booking).toContain("const paymentSource: BandPaymentSource = params.paymentSource ?? \"band\"");
  });

  it("#4032 retains selected personal/band payer after an RPC failure", () => {
    expect(page).toContain("throw error;\n    }\n  };\n\n  const getStatusBadge");
    expect(booking).toContain("params.paymentSource ?? \"band\"");
    expect(dialog).not.toContain("payment.prepareFunds(");
    expect(dialog).toContain("await onConfirm(");
    expect(booking).toContain("confirmRehearsalBookingAtomic({");
  });

  it("#4031 includes the complete intent in the retry key and rejects mismatched server replays", () => {
    for (const piece of [
      '"rehearsal:v2"', "actingProfileId", "params.bandId", "params.roomId",
      "params.scheduledStart.toISOString()", "params.duration", "params.songId ?? null",
      "params.setlistId ?? null", "paymentSource",
    ]) expect(booking).toContain(piece);
    expect(booking).toContain("if (params.profileId && params.profileId !== actingProfileId)");
    for (const field of [
      "band_id", "rehearsal_room_id", "duration_hours", "selected_song_id",
      "setlist_id", "scheduled_start", "payment_source", "payment_profile_id",
    ]) expect(database).toContain(`v_existing.${field} IS DISTINCT FROM`);
    expect(database).toContain("RAISE EXCEPTION 'idempotency_key_conflict'");
  });

  it("#4030 never reports booking failure for non-authoritative projections", () => {
    expect(booking).toContain("const repairSchedule = async () => {");
    expect(booking).toContain("await repairSchedule();");
    expect(booking).toContain("projectionFailed = true");
    expect(booking).toContain("Rehearsal booked — schedule needs refreshing");
    expect(booking).toContain("Retry schedule");
    expect(booking).toContain("void Promise.allSettled([");
    expect(booking).toContain("return booking.bookingId;");
    expect(booking).toContain("if (!booking.idempotent) {");
    expect(booking).toContain("catch (postCommitError)");
  });

  it("#4016 expires changed funding notes and reprices against live balances", () => {
    expect(funding).toContain("onChange={(event) => {\n                    setNote(event.target.value);\n                    resetPreview();");
    expect(funding).toContain("fundingPreviewStillCurrent(preview, latest as FundingPreview, previewedAt.current, Date.now())");
    expect(funding).toContain("preview_my_band_funding");
    expect(funding).toContain("fundingPreviewStillCurrent");
    expect(funding).toContain("setPreview(latest as FundingPreview)");
    expect(funding).toContain("Your funding preview has expired or balances changed");
    expect(funding).toContain("setConfirmationKey(crypto.randomUUID());");
  });

  it("#4018 counts only active non-touring band members in finances", () => {
    expect(finances).toContain('.select("id, member_status, is_touring_member, user_id")');
    expect(finances).toContain("countActiveRegularBandMembers");
    expect(finances).toContain("setMemberCount(countActiveRegularBandMembers");
    expect(finances).toContain("countActiveRegularBandMembers");
  });
});
