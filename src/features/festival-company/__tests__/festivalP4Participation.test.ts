import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FestivalPlayerAttendance } from "../attendance/festivalAttendance";
import type { FestivalMemorabiliaItem } from "../attendance/festivalAttendeeExtras";
import {
  estimateFestivalServerTime,
  getFestivalPassportProofs,
  getMemorabiliaForAttendance,
  rewardSummaryBelongsToAttendance,
} from "../attendance/festivalParticipation";
import type { FestivalRewardSummary } from "../attendance/festivalRewards";

const attendanceId = "11111111-1111-4111-8111-111111111111";
const editionId = "22222222-2222-4222-8222-222222222222";
const launchId = "33333333-3333-4333-8333-333333333333";

const attendance: FestivalPlayerAttendance = {
  id: attendanceId, festivalLaunchId: launchId, festivalEditionId: editionId,
  festivalName: "RockMundo", festivalSlug: "rockmundo-2030", startsOn: "2030-07-01",
  endsOn: "2030-07-03", cityId: null, admissionTicketId: "44444444-4444-4444-8444-444444444444",
  ticketReference: "TICKET-1", ticketType: "general", includesCamping: false,
  includesVipArea: false, status: "completed", checkedInAt: "2030-07-01T08:00:00Z",
  leftAt: null, completedAt: "2030-07-03T23:00:00Z", createdAt: "2030-06-01T10:00:00Z",
};

const summary: FestivalRewardSummary = {
  attendanceId, festivalEditionId: editionId, attendanceStatus: "completed",
  settled: true, skillXp: 325, attributePoints: 2, completedActivities: 4,
  watchedActs: 2, resolvedMoments: 1, distinctActivityTypes: 3,
  inspiration: 75, settledAt: "2030-07-04T00:00:00Z", breakdown: {}, serverNow: "2030-07-04T01:00:00Z",
};

const wristband: FestivalMemorabiliaItem = {
  id: "55555555-5555-4555-8555-555555555555", festivalLaunchId: launchId,
  festivalEditionId: editionId, attendanceId, itemType: "wristband", itemKey: "admission-2030",
  displayName: "RockMundo wristband", description: null, rarity: "common", metadata: {},
  issuedAt: "2030-07-01T08:00:00Z",
};

describe("Festival P4 verified passport and personal progress", () => {
  it("uses server-backed participation evidence, without per-click reward or stamp issuance", () => {
    expect(getFestivalPassportProofs(attendance, summary).map(proof => [proof.key, proof.verified])).toEqual([
      ["entry", true], ["activity", true], ["performance", true], ["moment", true], ["completion", true],
    ]);
    const afterRefresh = getFestivalPassportProofs(attendance, summary);
    expect(afterRefresh).toEqual(getFestivalPassportProofs(attendance, summary));
    expect(afterRefresh).toHaveLength(5);
  });

  it("never mixes rewards from another attendance, edition or lifecycle status", () => {
    expect(rewardSummaryBelongsToAttendance(attendance, summary)).toBe(true);
    for (const tampered of [
      { ...summary, attendanceId: "66666666-6666-4666-8666-666666666666" },
      { ...summary, festivalEditionId: "77777777-7777-4777-8777-777777777777" },
      { ...summary, attendanceStatus: "attending" },
    ]) {
      expect(rewardSummaryBelongsToAttendance(attendance, tampered)).toBe(false);
      expect(getFestivalPassportProofs(attendance, tampered)).toEqual([]);
    }
  });

  it("does not claim check-in, viewing or completion for ticketed, refunded or cancelled visits", () => {
    for (const status of ["ticketed", "refunded", "cancelled"] as const) {
      const unadmitted = { ...attendance, status, checkedInAt: null, completedAt: null };
      const proofs = getFestivalPassportProofs(unadmitted, { ...summary, attendanceStatus: status, settled: false });
      expect(proofs.every(proof => !proof.verified)).toBe(true);
    }
  });

  it("never calls an unsettled completion a settled passport proof", () => {
    const proofs = getFestivalPassportProofs(attendance, { ...summary, settled: false });
    expect(proofs.find(proof => proof.key === "completion")?.verified).toBe(false);
    expect(proofs.find(proof => proof.key === "performance")?.verified).toBe(true);
  });

  it("only shows memorabilia issued for the exact admission, edition and launch", () => {
    const otherAttendance = { ...wristband, id: "66666666-6666-4666-8666-666666666666", attendanceId: "66666666-6666-4666-8666-666666666666" };
    const otherEdition = { ...wristband, id: "77777777-7777-4777-8777-777777777777", festivalEditionId: "77777777-7777-4777-8777-777777777777" };
    const otherLaunch = { ...wristband, id: "88888888-8888-4888-8888-888888888888", festivalLaunchId: "88888888-8888-4888-8888-888888888888" };
    expect(getMemorabiliaForAttendance([otherAttendance, otherEdition, wristband, otherLaunch], attendance)).toEqual([wristband]);
  });
});

describe("Festival P4 social and vendor boundaries", () => {
  it("anchors delayed social outcomes to fetched server time, not a skewed local clock", () => {
    // Local clock says 14:00, server says 13:00 when the response arrives.
    const fetchedAt = Date.parse("2030-07-01T14:00:00Z");
    expect(estimateFestivalServerTime("2030-07-01T13:00:00Z", fetchedAt, fetchedAt)).toBe(Date.parse("2030-07-01T13:00:00Z"));
    expect(estimateFestivalServerTime("2030-07-01T13:00:00Z", fetchedAt, fetchedAt + 45_000)).toBe(Date.parse("2030-07-01T13:00:45Z"));
    expect(estimateFestivalServerTime("2030-07-01T13:00:00Z", fetchedAt, fetchedAt - 10_000)).toBe(Date.parse("2030-07-01T13:00:00Z"));
    expect(estimateFestivalServerTime("not-a-date", fetchedAt, fetchedAt)).toBeNaN();
  });

  it("only uses an edition-scoped public festival guide for food discovery", () => {
    const hub = readFileSync("src/features/festival-company/attendance/FestivalModeActivityHub.tsx", "utf8");
    expect(hub).toContain('usePublicFestival(kind === "food-drink" ? attendance.festivalSlug : undefined)');
    expect(hub).toContain("publicFestival.data?.editionId === attendance.festivalEditionId");
    expect(hub).toContain("publicFestival.data.slug === attendance.festivalSlug");
    expect(hub).toContain("visitorGuide?.sections.foodAndDrink");
    expect(hub).toContain("Sales and settlement must go through the server-authoritative economy.");
    expect(hub).not.toContain("supabase.from");
  });
});
