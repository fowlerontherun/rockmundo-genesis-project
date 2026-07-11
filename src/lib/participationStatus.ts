export type ParticipationSemanticStatus = "neutral" | "success" | "warning" | "unknown";
export type ParticipationBadgeVariant = "default" | "secondary" | "outline" | "destructive";

export type StatusDisplay = {
  label: string;
  semantic: ParticipationSemanticStatus;
  badgeVariant: ParticipationBadgeVariant;
  final: boolean;
  selfResponseAvailable: boolean;
};

const fallback: StatusDisplay = {
  label: "Status unavailable",
  semantic: "unknown",
  badgeVariant: "outline",
  final: false,
  selfResponseAvailable: false,
};

export const rehearsalParticipantStatus = {
  invited: { label: "Expected", semantic: "neutral", badgeVariant: "secondary", final: false, selfResponseAvailable: true },
  confirmed: { label: "Confirmed", semantic: "success", badgeVariant: "default", final: false, selfResponseAvailable: true },
  declined: { label: "Declined", semantic: "warning", badgeVariant: "outline", final: false, selfResponseAvailable: true },
  attended: { label: "Attended", semantic: "success", badgeVariant: "default", final: true, selfResponseAvailable: false },
  missed: { label: "Missed", semantic: "warning", badgeVariant: "destructive", final: true, selfResponseAvailable: false },
} satisfies Record<string, StatusDisplay>;

export const gigLineupStatus = {
  selected: { label: "Selected", semantic: "neutral", badgeVariant: "secondary", final: false, selfResponseAvailable: false },
  performed: { label: "Performed", semantic: "success", badgeVariant: "default", final: true, selfResponseAvailable: false },
  missed: { label: "Missed", semantic: "warning", badgeVariant: "destructive", final: true, selfResponseAvailable: false },
} satisfies Record<string, StatusDisplay>;

export function getRehearsalParticipantStatusDisplay(status: string | null | undefined): StatusDisplay {
  return status ? rehearsalParticipantStatus[status] ?? fallback : fallback;
}

export function getGigLineupStatusDisplay(status: string | null | undefined): StatusDisplay {
  return status ? gigLineupStatus[status] ?? fallback : fallback;
}


export type CorrectionRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export const rehearsalAttendanceCorrectionStatus = {
  pending: { label: "Pending review", final: false, actionable: true, badgeVariant: "secondary" },
  approved: { label: "Approved", final: true, actionable: false, badgeVariant: "default" },
  rejected: { label: "Rejected", final: true, actionable: false, badgeVariant: "destructive" },
  cancelled: { label: "Cancelled", final: true, actionable: false, badgeVariant: "outline" },
} satisfies Record<CorrectionRequestStatus, { label: string; final: boolean; actionable: boolean; badgeVariant: ParticipationBadgeVariant }>;

export function getRehearsalAttendanceCorrectionStatusDisplay(status: string | null | undefined) {
  return status && status in rehearsalAttendanceCorrectionStatus
    ? rehearsalAttendanceCorrectionStatus[status as CorrectionRequestStatus]
    : { label: "Status unavailable", final: false, actionable: false, badgeVariant: "outline" as ParticipationBadgeVariant };
}
