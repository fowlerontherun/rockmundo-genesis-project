import type { FestivalPlayerAttendance } from "./festivalAttendance";
import type { FestivalMemorabiliaItem } from "./festivalAttendeeExtras";
import type { FestivalRewardSummary } from "./festivalRewards";

export interface FestivalPassportProof {
  key: "entry" | "activity" | "performance" | "moment" | "completion";
  label: string;
  verified: boolean;
  evidence: string;
}

export const rewardSummaryBelongsToAttendance = (
  attendance: FestivalPlayerAttendance,
  summary: FestivalRewardSummary,
): boolean => summary.attendanceId === attendance.id
  && summary.festivalEditionId === attendance.festivalEditionId
  && summary.attendanceStatus === attendance.status;

// These are read-only evidence indicators, not collectible issuance, awardable
// stamps or additional rewards. Only the server can settle those resources.
export const getFestivalPassportProofs = (
  attendance: FestivalPlayerAttendance,
  summary: FestivalRewardSummary,
): FestivalPassportProof[] => {
  if (!rewardSummaryBelongsToAttendance(attendance, summary)) return [];

  const admitted = attendance.checkedInAt !== null
    && ["attending", "left_early", "completed"].includes(attendance.status);
  return [
    { key: "entry", label: "Festival entry", verified: admitted, evidence: "Verified check-in" },
    { key: "activity", label: "Festival activity", verified: admitted && summary.completedActivities > 0, evidence: "Completed day-plan activity" },
    { key: "performance", label: "Live performance", verified: admitted && summary.watchedActs > 0, evidence: "Completed watch-act activity" },
    { key: "moment", label: "Festival moment", verified: admitted && summary.resolvedMoments > 0, evidence: "Server-resolved moment" },
    { key: "completion", label: "Festival completion", verified: admitted && attendance.status === "completed" && attendance.completedAt !== null && summary.settled, evidence: "Completed attendance and settled reward" },
  ];
};

export const getMemorabiliaForAttendance = (
  items: FestivalMemorabiliaItem[],
  attendance: FestivalPlayerAttendance,
): FestivalMemorabiliaItem[] => items.filter(item => item.attendanceId === attendance.id
  && item.festivalEditionId === attendance.festivalEditionId
  && item.festivalLaunchId === attendance.festivalLaunchId);

// React Query stores the time of the last successful server response. Anchoring
// elapsed time to that timestamp avoids interpreting the user's clock as the
// authoritative server's clock (which may be minutes or hours apart).
export const estimateFestivalServerTime = (serverNowIso: string, fetchedAtMs: number, localNowMs: number): number => {
  const serverMs = Date.parse(serverNowIso);
  if (!Number.isFinite(serverMs)) return Number.NaN;
  if (!Number.isFinite(fetchedAtMs) || fetchedAtMs <= 0 || !Number.isFinite(localNowMs)) return serverMs;
  return serverMs + Math.max(0, localNowMs - fetchedAtMs);
};
