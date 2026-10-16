import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../../", import.meta.url);
const source = (path: string) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");

describe("recording payment, completion and scope safety", () => {
  it("#4100 keeps the booking wizard on the server-authoritative atomic RPC", () => {
    const wizard = source("src/components/recording/SessionConfigurator.tsx");
    const atomic = source("src/hooks/useRecordingDataAtomic.tsx");
    expect(wizard).toContain('useCreateRecordingSession, type CreateRecordingSessionInput } from "@/hooks/useRecordingDataAtomic"');
    expect(atomic).toContain("confirmRecordingSessionAtomic({");
    expect(wizard).not.toContain('useCreateRecordingSession } from "@/hooks/useRecordingData"');
  });

  it("#4101 removes all dangerous direct client-side completion and wallet writes", () => {
    const legacy = source("src/hooks/useRecordingData.tsx");
    expect(legacy).toContain("Legacy recording booking is disabled");
    expect(legacy).not.toContain("useCompleteRecordingSession");
    expect(legacy).not.toContain(".from('player_xp_wallet')");
    expect(legacy).not.toContain(".from('experience_ledger')");
    expect(legacy).not.toContain(".update({ status: 'completed'");
    expect(legacy).not.toContain("currentCash - totalCost");
  });

  it("#4102 requires a server-acknowledged cancellation and refund before replacement", () => {
    const cancel = source("src/hooks/useCancelRecordingSession.ts");
    const studio = source("src/pages/RecordingStudio.tsx");
    const confirmation = source("src/components/recording/SessionConfigurator.tsx");
    expect(cancel).toContain("data.bookingId !== sessionId || !data.refund?.refundId");
    expect(studio.indexOf("reason: 'rescheduled_by_player'")).toBeLessThan(
      studio.indexOf("setWizardOpen(true)", studio.indexOf("reason: 'rescheduled_by_player'")),
    );
    expect(confirmation).toContain("await cancelSession.mutateAsync({");
    expect(confirmation).toContain('if (mode === "reschedule")');
  });

  it("#4087 returns paid booking receipts and exposes strictly no-charge repair", () => {
    const atomic = source("src/hooks/useRecordingDataAtomic.tsx");
    const wizard = source("src/components/recording/SessionConfigurator.tsx");
    const receipt = source("src/components/recording/RecordingBookingConfirmation.tsx");
    expect(atomic).toContain("return { ...session, projectionPending };");
    expect(atomic).toContain("if (input.repairOnly && !isConfirmedRetry)");
    expect(atomic).toContain("if (input.band_id || !hasProjection)");
    expect(atomic).toContain("bookedProfileIds = [...new Set(");
    expect(atomic).toContain("includeProfileIds: bookedProfileIds");
    expect(wizard).toContain("booked_profile_ids: session.bookedProfileIds");
    expect(wizard).toContain("repairOnly: true");
    expect(wizard).toContain("repaired.id !== bookingSummary.sessionId");
    expect(receipt).toContain("Booking is paid — do not book again.");
    expect(receipt).toContain("Repair booking details");
  });

  it("#4105 refreshes every recording view even when the worker response fails", () => {
    const dialog = source("src/components/recording/CompleteRecordingDialog.tsx");
    expect(dialog).toContain('queryKey: ["recording-sessions"]');
    expect(dialog).not.toContain('queryKey: ["recording_sessions"]');
    expect(dialog).toContain('queryKey: ["recorded-songs-list"]');
    expect(dialog).toContain('queryKey: ["scheduled-activities"]');
    expect(dialog).toContain('queryKey: ["song-generation-status"]');
    expect(dialog).toContain("Even a timed-out worker response may have committed");
  });

  it("#4127 follow-up: new recording notices belong to the exact character", () => {
    const booking = source("src/hooks/useRecordingDataAtomic.tsx");
    const inbox = source("src/services/finance/atomicBookingClient.ts");
    const identity = source("src/utils/recordingNotificationIdentity.ts");
    expect(booking).toContain('metadata: {\n                  scope: "character",\n                  profile_id: input.profile_id,');
    expect(booking).toContain('profile_id: profile.id,');
    expect(inbox).toContain("recording_notification_character_scope_missing");
    expect(inbox).toContain("recordingInboxMessageId(sessionId, row.user_id, profileId)");
    expect(identity).toContain("recording:booking:profile:");
    expect(identity).toContain("rockmundo:recording:booking:");
  });

  it("keeps recording-session song embeds explicit after the reverse songs FK was added", () => {
    // songs.source_recording_session_id also points to recording_sessions.
    // Unqualified songs(...) embeds now return HTTP 300/PGRST201 in production.
    const recordingViews = [
      "src/hooks/useRecordingData.tsx",
      "src/pages/hubs/MusicOverview.tsx",
      "src/hooks/useProducerCareer.ts",
      "src/hooks/useScheduledActivities.ts",
      "src/components/band/BandRepertoireTab.tsx",
      "src/pages/BandRepertoire.tsx",
      "src/mobile/hooks/useMobileDaySchedule.ts",
    ];
    for (const path of recordingViews) {
      const contents = source(path);
      expect(contents, path).toContain("songs:songs!recording_sessions_song_id_fkey");
      expect(contents, path).not.toMatch(/songs:song_id\s*\(/);
    }
    // The mobile schedule has three independently scoped session queries.
    expect(
      source("src/mobile/hooks/useMobileDaySchedule.ts").match(
        /songs:songs!recording_sessions_song_id_fkey\(title\)/g,
      ),
    ).toHaveLength(3);
    // The band's recording-history query must use an existing column.
    expect(source("src/pages/BandRepertoire.tsx")).toContain(
      "quality_score:final_master_quality",
    );
  });
});
