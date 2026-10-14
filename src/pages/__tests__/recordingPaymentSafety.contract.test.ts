import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../../", import.meta.url);
const source = (path: string) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");

describe("recording payments and completion regression contracts", () => {
  it("#4100 invokes atomic booking RPC from the wizard", () => {
    const wizard = source("src/components/recording/SessionConfigurator.tsx");
    expect(wizard).toContain('useCreateRecordingSession } from "@/hooks/useRecordingDataAtomic"');
    expect(wizard).not.toMatch(/useCreateRecordingSession[\s\S]*from "@\/hooks\/useRecordingData";/);
    expect(source("src/hooks/useRecordingDataAtomic.tsx")).toContain("confirmRecordingSessionAtomic({");
  });

  it("#4101 never executes legacy unverified cash deductions", () => {
    const oldHook = source("src/hooks/useRecordingData.tsx");
    expect(oldHook).toContain("Legacy recording booking is disabled");
    expect(oldHook).not.toContain(".update({ cash: currentCash - totalCost })");
    expect(oldHook).not.toContain("amount: -totalCost");
  });

  it("#4089 requires a chosen future recording start", () => {
    const atomic = source("src/hooks/useRecordingDataAtomic.tsx");
    expect(atomic).toContain('if (!input.scheduled_start)');
    expect(atomic).toContain("scheduledStart.getTime() <= Date.now()");
    expect(atomic).not.toContain("new Date(Date.now() + 60_000)");
  });

  it("#4087 reports an already paid booking as confirmed despite projection failures", () => {
    const atomic = source("src/hooks/useRecordingDataAtomic.tsx");
    expect(atomic).toContain("let session: { id: string } = { id: booking.bookingId }");
    expect(atomic).toContain("catch (projectionError)");
    expect(atomic).toContain("return session;");
  });

  it("#4102 refunds the original reservation before booking its replacement", () => {
    const page = source("src/pages/RecordingStudio.tsx");
    const cancellation = page.indexOf("reason: 'rescheduled_by_player'");
    const openWizard = page.indexOf("setWizardOpen(true)", cancellation);
    expect(cancellation).toBeGreaterThan(0);
    expect(openWizard).toBeGreaterThan(cancellation);
    expect(page).not.toContain("pendingReplacementId");
  });

  it("#4103 correctly parses Bearer tokens", () => {
    const worker = source("supabase/functions/complete-recording-sessions/index.ts");
    expect(worker).toContain(String.raw`replace(/^Bearer\s+/i, '')`);
    expect(worker).not.toContain(String.raw`replace(/^Bearer\\s+/i, '')`);
  });

  it("#4104 validates booked participant projections rather than later band membership", () => {
    const worker = source("supabase/functions/complete-recording-sessions/index.ts");
    expect(worker).toContain(".eq('linked_recording_id', session.id)");
    expect(worker).toContain("recording_booked_participants_missing");
    const locationStart = worker.indexOf("if (locationCityId)");
    const attendanceEnd = worker.indexOf("if (missingDetails.length", locationStart);
    expect(worker.slice(locationStart, attendanceEnd)).not.toContain(".from('band_members')");
  });

  it("#4105 refreshes recording sessions even on early completed return", () => {
    const dialog = source("src/components/recording/CompleteRecordingDialog.tsx");
    const success = dialog.indexOf('if (updated.status === "completed")');
    const invalidation = dialog.lastIndexOf('queryKey: ["recording-sessions"]', success);
    expect(invalidation).toBeGreaterThan(0);
    expect(invalidation).toBeLessThan(success);
    expect(dialog).not.toContain('queryKey: ["recording_sessions"]');
  });

  it("#4097/#4099 refund repair is gated by live function fingerprint and currency", () => {
    const sql = source("supabase/production-repairs/recording_refund_currency_permissions_MANUAL_ONLY.sql");
    expect(sql).toContain("recording_refund_repair_approved");
    expect(sql).toContain("pg_get_functiondef");
    expect(sql).toContain("AND currency_code = v_payment.currency_code");
    expect(sql).toContain("v_booking.profile_id IS DISTINCT FROM v_profile_id");
    expect(sql).toContain("b.leader_id = v_profile_id");
    expect(sql).toContain("v_booking.scheduled_start <= now()");
  });
});
