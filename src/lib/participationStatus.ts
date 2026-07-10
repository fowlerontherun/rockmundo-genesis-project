export type ParticipationSemanticStatus = "neutral" | "success" | "warning" | "unknown";
export type ParticipationBadgeVariant = "default" | "secondary" | "outline" | "destructive";

export type StatusDisplay = {
  label: string;
  semantic: ParticipationSemanticStatus;
  badgeVariant: ParticipationBadgeVariant;
  final: boolean;
};

const fallback: StatusDisplay = {
  label: "Status unavailable",
  semantic: "unknown",
  badgeVariant: "outline",
  final: false,
};

export const rehearsalParticipantStatus = {
  invited: { label: "Expected", semantic: "neutral", badgeVariant: "secondary", final: false },
  attended: { label: "Attended", semantic: "success", badgeVariant: "default", final: true },
  missed: { label: "Missed", semantic: "warning", badgeVariant: "destructive", final: true },
} satisfies Record<string, StatusDisplay>;

export const gigLineupStatus = {
  selected: { label: "Selected", semantic: "neutral", badgeVariant: "secondary", final: false },
  performed: { label: "Performed", semantic: "success", badgeVariant: "default", final: true },
  missed: { label: "Missed", semantic: "warning", badgeVariant: "destructive", final: true },
} satisfies Record<string, StatusDisplay>;

export function getRehearsalParticipantStatusDisplay(status: string | null | undefined): StatusDisplay {
  return status ? rehearsalParticipantStatus[status] ?? fallback : fallback;
}

export function getGigLineupStatusDisplay(status: string | null | undefined): StatusDisplay {
  return status ? gigLineupStatus[status] ?? fallback : fallback;
}
