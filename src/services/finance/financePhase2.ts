import { financeService, type FinanceTransactionCategory } from "./financeService";

export type BandFinancePermission =
  | "view_band_balance" | "view_transaction_history" | "view_detailed_income_expenses" | "create_member_contribution_requests"
  | "make_voluntary_contributions" | "request_reimbursement" | "approve_reimbursements" | "schedule_payments"
  | "pay_band_expenses" | "change_revenue_split_rules" | "withdraw_band_funds" | "perform_emergency_payments";
export type RevenueSplitMethod = "equal" | "custom_percentage" | "role_weighted" | "retain_all" | "reserve_then_distribute";
export type RecurringFrequency = "daily" | "weekly" | "monthly" | "custom_interval";

export const ELIGIBLE_DISTRIBUTION_CATEGORIES = new Set<FinanceTransactionCategory>(["gig_payment", "ticket_sale", "festival_payment", "merchandise_revenue", "streaming_royalty"]);
export const INELIGIBLE_DISTRIBUTION_CATEGORIES = new Set<FinanceTransactionCategory>(["band_contribution", "refund", "administrative_adjustment", "tax_placeholder"]);

export interface MemberShareInput { profileId: string; role?: string; active?: boolean; percentageBasisPoints?: number }
export interface DistributionPlanInput { amountMinor: number; members: MemberShareInput[]; method: RevenueSplitMethod; reserveMinor?: number; reserveBasisPoints?: number; customPercentages?: Record<string, number>; roleWeights?: Record<string, number> }
export interface DistributionAllocation { profileId: string; amountMinor: number; percentageBasisPoints: number }

const assertMinor = (amountMinor: number) => {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) throw new Error("Money amounts must be non-negative integer minor units");
};

export function calculateDistributionAllocations(input: DistributionPlanInput) {
  assertMinor(input.amountMinor);
  const eligibleMembers = input.members.filter((m) => m.active !== false);
  if (input.method === "retain_all") return { reserveRetainedMinor: input.amountMinor, distributableAmountMinor: 0, allocations: [] as DistributionAllocation[] };
  if (eligibleMembers.length === 0) throw new Error("At least one eligible member is required");

  const reserveByPercent = input.reserveBasisPoints ? Math.floor(input.amountMinor * input.reserveBasisPoints / 10000) : 0;
  const reserveRetainedMinor = input.method === "reserve_then_distribute" ? Math.min(input.amountMinor, input.reserveMinor ?? reserveByPercent) : 0;
  const distributableAmountMinor = input.amountMinor - reserveRetainedMinor;

  let basisPoints: Record<string, number> = {};
  if (input.method === "custom_percentage") {
    basisPoints = input.customPercentages ?? {};
    const total = eligibleMembers.reduce((sum, m) => sum + (basisPoints[m.profileId] ?? 0), 0);
    if (total !== 10000) throw new Error("Custom split percentages must total 100%");
  } else if (input.method === "role_weighted") {
    const weights = eligibleMembers.map((m) => Math.max(0, input.roleWeights?.[m.role ?? "member"] ?? 1));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight <= 0) throw new Error("Role weights must be positive");
    eligibleMembers.forEach((m, i) => { basisPoints[m.profileId] = Math.floor(weights[i] * 10000 / totalWeight); });
  } else {
    const equal = Math.floor(10000 / eligibleMembers.length);
    eligibleMembers.forEach((m) => { basisPoints[m.profileId] = equal; });
  }

  const allocations = eligibleMembers.map((m) => ({ profileId: m.profileId, percentageBasisPoints: basisPoints[m.profileId] ?? 0, amountMinor: Math.floor(distributableAmountMinor * (basisPoints[m.profileId] ?? 0) / 10000) }));
  let remainder = distributableAmountMinor - allocations.reduce((sum, a) => sum + a.amountMinor, 0);
  for (const allocation of allocations) {
    if (remainder <= 0) break;
    allocation.amountMinor += 1;
    remainder -= 1;
  }
  return { reserveRetainedMinor, distributableAmountMinor, allocations };
}

export function nextDueDate(from: Date, frequency: RecurringFrequency, customIntervalDays?: number) {
  const due = new Date(from);
  if (frequency === "daily") due.setUTCDate(due.getUTCDate() + 1);
  if (frequency === "weekly") due.setUTCDate(due.getUTCDate() + 7);
  if (frequency === "monthly") due.setUTCMonth(due.getUTCMonth() + 1);
  if (frequency === "custom_interval") due.setUTCDate(due.getUTCDate() + (customIntervalDays ?? 1));
  return due.toISOString().slice(0, 10);
}

export async function contributeToBand(input: { profileId: string; bandId: string; amount: number; note?: string; category?: string; idempotencyKey: string }) {
  return financeService.transfer({
    source: { ownerType: "player", ownerId: input.profileId }, destination: { ownerType: "band", ownerId: input.bandId }, amount: input.amount,
    category: "band_contribution", description: input.note ?? "Band member contribution", idempotencyKey: input.idempotencyKey,
    relatedEntityType: "band", relatedEntityId: input.bandId, createdByProfileId: input.profileId, metadata: { contributionCategory: input.category ?? "voluntary", ownershipImplication: false },
  });
}

export async function payBandReimbursement(input: { bandId: string; profileId: string; amount: number; reimbursementId: string; idempotencyKey: string; approvedByProfileId: string }) {
  return financeService.transfer({
    source: { ownerType: "band", ownerId: input.bandId }, destination: { ownerType: "player", ownerId: input.profileId }, amount: input.amount,
    category: "band_reimbursement", description: "Approved band reimbursement", idempotencyKey: input.idempotencyKey,
    relatedEntityType: "band_reimbursement_request", relatedEntityId: input.reimbursementId, createdByProfileId: input.approvedByProfileId,
  });
}

export async function payDistributionAllocation(input: { bandId: string; profileId: string; amount: number; batchId: string; idempotencyKey: string }) {
  return financeService.transfer({
    source: { ownerType: "band", ownerId: input.bandId }, destination: { ownerType: "player", ownerId: input.profileId }, amount: input.amount,
    category: "band_distribution", description: "Band revenue distribution", idempotencyKey: input.idempotencyKey,
    relatedEntityType: "band_distribution_batch", relatedEntityId: input.batchId,
  });
}
