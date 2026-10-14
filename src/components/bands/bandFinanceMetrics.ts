/** Financial summaries shown on the dashboard are limited to 50 recent entries. */
export const RECENT_FINANCE_ENTRY_LIMIT = 50;
export const MONTHLY_EXPENSE_WINDOW_DAYS = 30;
export const MAX_MONTHLY_EXPENSE_ROWS = 100_000;

export function countActiveRegularBandMembers(
  members: readonly { member_status: string | null; is_touring_member: boolean | null }[],
): number {
  return members.filter((member) => member.member_status === "active" && member.is_touring_member !== true).length;
}

/** Expense rows are retrieved for the entire last 30 days, separately from 50-entry history. */
export function monthlyBandRunway(balance: number, last30DaysExpense: number | null): number | null {
  if (!Number.isFinite(balance) || !Number.isFinite(last30DaysExpense) || last30DaysExpense === null || last30DaysExpense <= 0) return null;
  return Math.max(0, Math.round((balance / last30DaysExpense) * 10) / 10);
}
