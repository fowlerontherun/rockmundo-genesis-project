export type RecruitmentStatus = "pending" | "accepted" | "rejected" | "withdrawn" | "cancelled" | "declined" | "expired";

export type RecruitmentStatusMeta = {
  label: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  actionable: boolean;
  final: boolean;
};

export const RECRUITMENT_STATUS: Record<RecruitmentStatus, RecruitmentStatusMeta> = {
  pending: { label: "Pending", badgeVariant: "secondary", actionable: true, final: false },
  accepted: { label: "Accepted", badgeVariant: "default", actionable: false, final: true },
  rejected: { label: "Rejected", badgeVariant: "outline", actionable: false, final: true },
  withdrawn: { label: "Withdrawn", badgeVariant: "outline", actionable: false, final: true },
  cancelled: { label: "Cancelled", badgeVariant: "outline", actionable: false, final: true },
  declined: { label: "Declined", badgeVariant: "outline", actionable: false, final: true },
  expired: { label: "Expired", badgeVariant: "outline", actionable: false, final: true },
};

export const RECRUITMENT_STATUS_FALLBACK: RecruitmentStatusMeta = {
  label: "Unknown status",
  badgeVariant: "outline",
  actionable: false,
  final: true,
};

export function getRecruitmentStatusMeta(status: unknown): RecruitmentStatusMeta {
  if (typeof status !== "string") return RECRUITMENT_STATUS_FALLBACK;
  return RECRUITMENT_STATUS[status.toLowerCase() as RecruitmentStatus] ?? {
    ...RECRUITMENT_STATUS_FALLBACK,
    label: status.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
  };
}

export function isRecruitmentFinal(status: unknown) {
  return getRecruitmentStatusMeta(status).final;
}

export function isRecruitmentActionable(status: unknown) {
  return getRecruitmentStatusMeta(status).actionable;
}
