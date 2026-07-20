import { supabase } from "@/integrations/supabase/client";

export type FinancialObligation = {
  id: string;
  obligation_type: string;
  owner_type: string;
  owner_id: string;
  linked_asset_type: string | null;
  linked_asset_id: string | null;
  amount_minor: number;
  currency_code: string;
  frequency: string;
  next_due_date: string;
  grace_period_days: number;
  status: string;
  missed_payment_count: number;
  outstanding_balance_minor: number;
};

export type ObligationScheduleLine = { id: string; obligation_id: string; due_date: string; amount_minor: number; currency_code: string; status: string; paid_at: string | null; first_missed_at?: string | null; next_retry_at?: string | null; resolved_at?: string | null };
export type DebtRecord = { id: string; obligation_id: string | null; original_amount_minor: number; outstanding_balance_minor: number; currency_code: string; collection_stage: string; status: string; updated_at: string };
export type CreditHistoryEvent = { id: string; event_type: string; event_date: string; amount_minor: number; currency_code: string | null; score_delta: number };
export type CreditScore = { credit_score: number; credit_band: string; calculated_at: string };

export async function loadFinancialObligationsDashboard() {
  const { data, error } = await (supabase as any).rpc("get_my_financial_obligations_dashboard");
  if (error) throw error;

  const dashboard = (data ?? {}) as {
    obligations?: FinancialObligation[];
    schedule?: ObligationScheduleLine[];
    debts?: DebtRecord[];
    creditProfile?: { score?: number; band?: string; lastCalculatedAt?: string; history?: CreditHistoryEvent[] } | null;
  };

  return {
    obligations: dashboard.obligations ?? [],
    schedule: dashboard.schedule ?? [],
    debts: dashboard.debts ?? [],
    creditHistory: dashboard.creditProfile?.history ?? [],
    creditScore: dashboard.creditProfile
      ? {
          credit_score: dashboard.creditProfile.score ?? 600,
          credit_band: dashboard.creditProfile.band ?? "Building",
          calculated_at: dashboard.creditProfile.lastCalculatedAt ?? new Date(0).toISOString(),
        }
      : null,
  };
}
