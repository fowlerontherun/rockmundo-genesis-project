import { supabase } from "@/integrations/supabase/client";

export type SavingsGoalFundingSource = {
  sourceKind: "wallet" | "bank";
  sourceAccountId: string | null;
  displayName: string;
  accountType: string;
  currencyCode: string;
  availableBalanceMinor: number;
  eligible: boolean;
  ineligibleReason?: string | null;
};

export type SavingsGoalSummary = {
  goalId: string;
  financialAccountId: string;
  currencyCode: string;
  targetMinor: number;
  currentMinor: number;
  idempotent: boolean;
};

export type SavingsGoalFundingSourcesResult = {
  status: "ok";
  goalId: string;
  goalName: string;
  currencyCode: string;
  targetMinor: number;
  currentMinor: number;
  sources: SavingsGoalFundingSource[];
};

export type SavingsGoalFundingPreview = {
  goalId: string;
  goalName: string;
  sourceKind: "wallet" | "bank";
  sourceAccountId: string | null;
  currencyCode: string;
  sourceBalanceMinor: number;
  amountMinor: number;
  resultingSourceBalanceMinor: number;
  goalBalanceMinor: number;
  resultingGoalBalanceMinor: number;
  targetMinor: number;
};

export type SavingsGoalFundingResult = {
  goalId: string;
  transactionId: string;
  currencyCode: string;
  sourceBalanceMinor?: number;
  goalBalanceMinor: number;
  targetMinor: number;
  completed: boolean;
  idempotent: boolean;
};

const throwRpcError = (error: { message?: string } | null, fallback: string) => {
  if (error) throw new Error(error.message || fallback);
};

export const createSavingsGoal = async ({
  name,
  targetMinor,
  targetDate,
  idempotencyKey = crypto.randomUUID(),
}: {
  name: string;
  targetMinor: number;
  targetDate?: string | null;
  idempotencyKey?: string;
}): Promise<SavingsGoalSummary> => {
  const { data, error } = await (supabase.rpc as any)("create_my_savings_goal", {
    p_name: name,
    p_target_minor: targetMinor,
    p_target_date: targetDate ?? null,
    p_idempotency_key: idempotencyKey,
  });

  throwRpcError(error, "Savings goal could not be created.");
  if (!data) throw new Error("savings_goal_empty_response");
  return data as SavingsGoalSummary;
};

export const getSavingsGoalFundingSources = async (
  goalId: string,
): Promise<SavingsGoalFundingSourcesResult> => {
  const { data, error } = await (supabase.rpc as any)(
    "get_my_savings_goal_funding_sources",
    { p_goal_id: goalId },
  );

  throwRpcError(error, "Savings goal funding sources could not be loaded.");
  if (!data) throw new Error("savings_goal_sources_empty_response");
  return data as SavingsGoalFundingSourcesResult;
};

export const previewSavingsGoalFunding = async ({
  goalId,
  sourceKind,
  sourceAccountId,
  amountMinor,
}: {
  goalId: string;
  sourceKind: "wallet" | "bank";
  sourceAccountId?: string | null;
  amountMinor: number;
}): Promise<SavingsGoalFundingPreview> => {
  const { data, error } = await (supabase.rpc as any)(
    "preview_my_savings_goal_funding",
    {
      p_goal_id: goalId,
      p_source_kind: sourceKind,
      p_source_account_id: sourceAccountId ?? null,
      p_amount_minor: amountMinor,
    },
  );

  throwRpcError(error, "Savings goal funding preview could not be prepared.");
  if (!data) throw new Error("savings_goal_preview_empty_response");
  return data as SavingsGoalFundingPreview;
};

export const fundSavingsGoal = async ({
  goalId,
  sourceKind,
  sourceAccountId,
  amountMinor,
  idempotencyKey,
}: {
  goalId: string;
  sourceKind: "wallet" | "bank";
  sourceAccountId?: string | null;
  amountMinor: number;
  idempotencyKey: string;
}): Promise<SavingsGoalFundingResult> => {
  const { data, error } = await (supabase.rpc as any)("fund_my_savings_goal", {
    p_goal_id: goalId,
    p_source_kind: sourceKind,
    p_source_account_id: sourceAccountId ?? null,
    p_amount_minor: amountMinor,
    p_idempotency_key: idempotencyKey,
  });

  throwRpcError(error, "Savings goal could not be funded.");
  if (!data) throw new Error("savings_goal_funding_empty_response");
  return data as SavingsGoalFundingResult;
};
